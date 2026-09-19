import { type Card } from './cards'
import { score } from './evaluator'
import { type HandRange, rangeCombos } from './range'

/**
 * Эквити — доля банка, которая достаётся руке в среднем. Ничья на двоих
 * стоит половины банка, на троих — трети: это не победа и не поражение.
 *
 * Там, где перебор достижим, он и делается: на тёрне вариантов сорок тысяч,
 * на флопе около миллиона — доли секунды, и точный ответ лучше приблизительного.
 * Монте-Карло включается, только когда перебор недостижим: до флопа против
 * диапазона это миллиарды вариантов.
 */

export interface EquityResult {
  win: number
  tie: number
  lose: number
  equity: number
  iterations: number
  isExact: boolean
}

export const ZERO_EQUITY: EquityResult = {
  win: 0, tie: 0, lose: 0, equity: 0, iterations: 0, isExact: false,
}

export type OpponentModel = { kind: 'random' } | { kind: 'range'; range: HandRange }

export interface EquityQuery {
  hero: Card[]
  board: Card[]
  opponents: number
  model: OpponentModel
}

/** Ниже этого порога считаем перебором. */
export const EXACT_LIMIT = 3_000_000

/**
 * mulberry32: быстрый 32-разрядный генератор. 64-разрядный xoshiro из нативной
 * версии здесь потребовал бы BigInt и был бы на порядок медленнее, а качество
 * нужно статистическое, не криптографическое.
 */
function makeRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function combinations(n: number, k: number): number {
  if (k < 0 || k > n) return 0
  let result = 1
  for (let i = 0; i < k; i++) result = (result * (n - i)) / (i + 1)
  return Math.round(result)
}

/**
 * Рука против конкретной руки — точным перебором всех досок.
 * До флопа это 1 712 304 варианта: доли секунды и ответ без погрешности.
 */
export function exactHeadsUp(hero: Card[], villain: Card[], board: Card[] = []): EquityResult {
  const known = [...hero, ...villain, ...board]
  if (new Set(known).size !== known.length) throw new Error('Одна карта выбрана дважды')

  const dead = new Uint8Array(52)
  for (const c of known) dead[c] = 1
  const deck: number[] = []
  for (let i = 0; i < 52; i++) if (!dead[i]) deck.push(i)

  const toCome = 5 - board.length
  const cardCount = 2 + board.length + toCome
  const heroBuf = new Int32Array(7)
  const villBuf = new Int32Array(7)
  heroBuf[0] = hero[0]; heroBuf[1] = hero[1]
  villBuf[0] = villain[0]; villBuf[1] = villain[1]
  board.forEach((c, i) => { heroBuf[2 + i] = c; villBuf[2 + i] = c })

  let wins = 0, ties = 0, losses = 0, total = 0
  enumerateRunouts(deck, deck.length, toCome, (runout, count) => {
    for (let k = 0; k < count; k++) {
      heroBuf[2 + board.length + k] = runout[k]
      villBuf[2 + board.length + k] = runout[k]
    }
    const h = score(heroBuf, cardCount)
    const v = score(villBuf, cardCount)
    total++
    if (h > v) wins++; else if (h === v) ties++; else losses++
  })

  if (total === 0) return ZERO_EQUITY
  return {
    win: wins / total, tie: ties / total, lose: losses / total,
    equity: (wins + ties / 2) / total, iterations: total, isExact: true,
  }
}

function enumerateRunouts(
  deck: number[], deckCount: number, k: number,
  body: (chosen: Int32Array, count: number) => void,
): void {
  if (k === 0) { body(new Int32Array(0), 0); return }
  const chosen = new Int32Array(k)
  const recurse = (start: number, depth: number): void => {
    if (depth === k) { body(chosen, k); return }
    for (let i = start; i <= deckCount - (k - depth); i++) {
      chosen[depth] = deck[i]
      recurse(i + 1, depth + 1)
    }
  }
  recurse(0, 0)
}

export function calculateEquity(
  query: EquityQuery,
  iterations = 120_000,
  seed = 0x9e3779b9,
): EquityResult {
  const { hero, board, opponents, model } = query
  if (hero.length !== 2) throw new Error('Нужны обе карты руки')
  if (board.length > 5) throw new Error('На столе не больше пяти карт')
  const known = [...hero, ...board]
  if (new Set(known).size !== known.length) throw new Error('Одна карта выбрана дважды')
  if (opponents < 1 || opponents > 9) throw new Error('Слишком много оппонентов')
  if (52 - known.length < opponents * 2 + (5 - board.length)) throw new Error('Не хватает карт в колоде')

  const dead = new Uint8Array(52)
  for (const c of known) dead[c] = 1
  const deck: number[] = []
  for (let i = 0; i < 52; i++) if (!dead[i]) deck.push(i)

  const combos: Array<[number, number]> = model.kind === 'range' ? rangeCombos(model.range, dead) : []
  if (model.kind === 'range' && combos.length === 0) throw new Error('В диапазоне не осталось ни одной руки')

  const toCome = 5 - board.length
  if (opponents === 1) {
    const combosCount = combos.length === 0 ? (deck.length * (deck.length - 1)) / 2 : combos.length
    const runouts = combinations(deck.length - 2, toCome)
    if (combosCount * Math.max(runouts, 1) <= EXACT_LIMIT) {
      return exactVsCombos(hero, board, deck, combos)
    }
  }
  return monteCarlo(hero, board, deck, opponents, combos, iterations, seed)
}

function exactVsCombos(
  hero: Card[], board: Card[], deck: number[], combos: Array<[number, number]>,
): EquityResult {
  let pairs = combos
  if (pairs.length === 0) {
    pairs = []
    for (let i = 0; i < deck.length; i++) {
      for (let j = i + 1; j < deck.length; j++) pairs.push([deck[i], deck[j]])
    }
  }

  const toCome = 5 - board.length
  const cardCount = 2 + board.length + toCome
  const heroBuf = new Int32Array(7)
  const villBuf = new Int32Array(7)
  heroBuf[0] = hero[0]; heroBuf[1] = hero[1]
  board.forEach((c, i) => { heroBuf[2 + i] = c; villBuf[2 + i] = c })
  const rest = new Array<number>(deck.length)

  let wins = 0, ties = 0, losses = 0, total = 0
  for (const [a, b] of pairs) {
    let restCount = 0
    for (const c of deck) if (c !== a && c !== b) rest[restCount++] = c
    villBuf[0] = a; villBuf[1] = b

    enumerateRunouts(rest, restCount, toCome, (runout, count) => {
      for (let k = 0; k < count; k++) {
        heroBuf[2 + board.length + k] = runout[k]
        villBuf[2 + board.length + k] = runout[k]
      }
      const h = score(heroBuf, cardCount)
      const v = score(villBuf, cardCount)
      total++
      if (h > v) wins++; else if (h === v) ties++; else losses++
    })
  }

  if (total === 0) return ZERO_EQUITY
  return {
    win: wins / total, tie: ties / total, lose: losses / total,
    equity: (wins + ties / 2) / total, iterations: total, isExact: true,
  }
}

function monteCarlo(
  hero: Card[], board: Card[], deck: number[], opponents: number,
  combos: Array<[number, number]>, iterations: number, seed: number,
): EquityResult {
  const random = makeRandom(seed)
  let wins = 0, ties = 0, losses = 0, equitySum = 0, done = 0

  const toCome = 5 - board.length
  const cardCount = 2 + board.length + toCome
  const heroBuf = new Int32Array(7)
  const villBuf = new Int32Array(7)
  heroBuf[0] = hero[0]; heroBuf[1] = hero[1]
  board.forEach((c, i) => { heroBuf[2 + i] = c; villBuf[2 + i] = c })

  const available = new Int32Array(deck.length)
  const blocked = new Uint8Array(52)
  const villainHands = new Int32Array(opponents * 2)
  const fromRange = combos.length > 0
  const need = (fromRange ? 0 : opponents * 2) + toCome
  const drawn = new Int32Array(need)

  outer: for (let iteration = 0; iteration < iterations; iteration++) {
    blocked.fill(0)
    let handsDealt = 0

    if (fromRange) {
      let attempts = 0
      while (handsDealt < opponents) {
        if (++attempts > 400) continue outer   // диапазон не вмещает столько рук
        const [a, b] = combos[(random() * combos.length) | 0]
        if (blocked[a] || blocked[b]) continue
        blocked[a] = 1; blocked[b] = 1
        villainHands[handsDealt * 2] = a
        villainHands[handsDealt * 2 + 1] = b
        handsDealt++
      }
    }

    let count = 0
    for (const c of deck) if (!blocked[c]) available[count++] = c

    // Частичная перетасовка: берём ровно столько карт, сколько нужно,
    // вместо полного прохода по колоде на каждой итерации.
    for (let d = 0; d < need; d++) {
      const j = (random() * count) | 0
      drawn[d] = available[j]
      available[j] = available[count - 1]
      count--
    }

    let cursor = 0
    if (!fromRange) {
      for (let i = 0; i < opponents * 2; i++) villainHands[i] = drawn[cursor++]
    }
    for (let k = 0; k < toCome; k++) {
      const c = drawn[cursor + k]
      heroBuf[2 + board.length + k] = c
      villBuf[2 + board.length + k] = c
    }

    const h = score(heroBuf, cardCount)
    let tiedWith = 0
    let beaten = false
    for (let i = 0; i < opponents; i++) {
      villBuf[0] = villainHands[i * 2]
      villBuf[1] = villainHands[i * 2 + 1]
      const v = score(villBuf, cardCount)
      if (v > h) { beaten = true; break }
      if (v === h) tiedWith++
    }

    done++
    if (beaten) losses++
    else if (tiedWith > 0) {
      ties++
      // Банк делится на всех, кто сравнялся, а не пополам: в раздаче на троих
      // ничья стоит трети, и «половина» завысила бы эквити.
      equitySum += 1 / (tiedWith + 1)
    } else { wins++; equitySum += 1 }
  }

  if (done === 0) return ZERO_EQUITY
  return {
    win: wins / done, tie: ties / done, lose: losses / done,
    equity: equitySum / done, iterations: done, isExact: false,
  }
}

import { type Card, cardRank } from './cards'
import { type HandValue, evaluate, STRAIGHT, FLUSH, STRAIGHT_FLUSH, PAIR, TWO_PAIR, HIGH_CARD } from './evaluator'

/**
 * Что именно доезжает. Ауты здесь не взяты из таблицы «флеш-дро = 9», а
 * пересчитаны по колоде: если две пики уже лежат на столе, аутов восемь,
 * и заученное число соврёт.
 */

export type DrawKind = 'straightFlush' | 'flush' | 'straight' | 'trips' | 'twoPair' | 'pair' | 'overcards'

export const DRAW_TITLE: Record<DrawKind, string> = {
  straightFlush: 'Стрит-флеш',
  flush: 'Флеш',
  straight: 'Стрит',
  trips: 'Тройка или каре',
  twoPair: 'Две пары',
  pair: 'Пара',
  overcards: 'Пара со старшей картой',
}

export interface Draw {
  kind: DrawKind
  outs: number
  /**
   * Сами карты, а не только их число. Нужны там, где ауты приходится
   * называть поимённо: «это червы — 2♥, 5♥, 6♥…». Число без карт остаётся
   * утверждением на слово, а перебор их всё равно знает.
   */
  cards: Card[]
}

export interface DrawAnalysis {
  current: HandValue
  draws: Draw[]
  /** Без двойного счёта: карта, закрывающая и стрит, и флеш, посчитана один раз. */
  totalOuts: number
  /** Ауты до руки не слабее стрита — те, на которые обычно и играют. */
  strongOuts: number
  /**
   * Карты, спаривающие доску. Категорию руки они поднимают, но аутами не
   * являются: такую пару получает и оппонент, расклад сил не меняется.
   * Показываются отдельно, чтобы не пропасть молча.
   */
  boardPairing: number
  unseen: number
  summary: string
}

const ORDER: DrawKind[] = ['straightFlush', 'flush', 'straight', 'trips', 'twoPair', 'pair', 'overcards']

export function analyseDraws(hole: Card[], board: Card[]): DrawAnalysis | null {
  if (hole.length !== 2 || board.length < 3 || board.length > 5) return null
  const known = [...hole, ...board]
  if (new Set(known).size !== known.length) return null

  const current = evaluate(known)
  const seen = new Uint8Array(52)
  for (const c of known) seen[c] = 1
  const unseen = 52 - known.length

  if (board.length >= 5) {
    return { current, draws: [], totalOuts: 0, strongOuts: 0, boardPairing: 0, unseen, summary: summarise([]) }
  }

  const byKind = new Map<DrawKind, Card[]>()
  let improving = 0, strong = 0, boardPairing = 0
  const boardRanks = new Set(board.map(cardRank))
  const holeRanks = new Set(hole.map(cardRank))
  const topBoard = Math.max(...board.map(cardRank))

  // Единственный честный способ посчитать ауты — перебрать колоду
  // и посмотреть, что каждая карта на самом деле делает с рукой.
  for (let card = 0; card < 52; card++) {
    if (seen[card]) continue
    const after = evaluate([...known, card])
    if (after.category <= current.category) continue

    // Карта спарила доску, а не вашу руку. Категория выросла у всех сразу:
    // с AK на Q72 пришедшая семёрка не делает вас впереди, потому что эту же
    // семёрку получает и оппонент. Такие карты завышали ауты с шести до пятнадцати.
    const rank = cardRank(card)
    if (boardRanks.has(rank) && !holeRanks.has(rank) && after.category <= TWO_PAIR) {
      boardPairing++
      continue
    }

    improving++
    if (after.category >= STRAIGHT) strong++

    let kind: DrawKind
    if (after.category === STRAIGHT_FLUSH) kind = 'straightFlush'
    else if (after.category >= 6 || after.category === 3) kind = 'trips'
    else if (after.category === FLUSH) kind = 'flush'
    else if (after.category === STRAIGHT) kind = 'straight'
    else if (after.category === TWO_PAIR) kind = 'twoPair'
    else if (after.category === PAIR) kind = rank > topBoard ? 'overcards' : 'pair'
    else continue
    const bucket = byKind.get(kind)
    if (bucket) bucket.push(card)
    else byKind.set(kind, [card])
  }

  const draws: Draw[] = ORDER
    .filter((k) => (byKind.get(k)?.length ?? 0) > 0)
    .map((k) => ({ kind: k, outs: byKind.get(k)!.length, cards: byKind.get(k)! }))

  return { current, draws, totalOuts: improving, strongOuts: strong, boardPairing, unseen, summary: summarise(draws) }
}

/** Читаемое название дро: «флеш-дро», «двусторонний стрит», «гатшот». */
function summarise(draws: Draw[]): string {
  const parts: string[] = []
  for (const d of draws) {
    if (d.kind === 'flush' || d.kind === 'straightFlush') {
      parts.push(d.outs >= 9 ? 'флеш-дро' : `неполное флеш-дро (${d.outs})`)
    }
  }
  const straight = draws.find((d) => d.kind === 'straight')
  if (straight) {
    if (straight.outs >= 8) parts.push(`двусторонний стрит (${straight.outs})`)
    else if (straight.outs >= 4) parts.push(`гатшот (${straight.outs})`)
    else parts.push(`стрит в ${straight.outs}`)
  }
  if (parts.length === 0 && draws.some((d) => d.kind === 'overcards')) parts.push('оверкарты')
  return parts.length ? parts.join(', ') : 'готовых улучшений нет'
}

export { HIGH_CARD }

import { type Card } from './cards'

/**
 * Оценщик комбинаций. Порт нативного один в один: считает на битовых масках,
 * а сила руки укладывается в одно число, поэтому сравнение рук — это сравнение
 * двух чисел, и никаких структур в горячем цикле.
 *
 * Отличие от Swift ровно одно: там счётчики достоинств лежали в одном UInt64
 * по четыре бита на достоинство, а в JavaScript побитовые операции 32-разрядные,
 * и 52 бита в число не влезают. Поэтому счётчики — типизированные массивы
 * уровня модуля, которые переиспользуются между вызовами: выделять их заново
 * на каждой из миллиона раздач было бы единственным настоящим тормозом.
 */

export const HIGH_CARD = 0, PAIR = 1, TWO_PAIR = 2, TRIPS = 3, STRAIGHT = 4,
  FLUSH = 5, FULL_HOUSE = 6, QUADS = 7, STRAIGHT_FLUSH = 8

export type HandCategory = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

export const CATEGORY_TITLE: Record<number, string> = {
  [HIGH_CARD]: 'Старшая карта',
  [PAIR]: 'Пара',
  [TWO_PAIR]: 'Две пары',
  [TRIPS]: 'Сет',
  [STRAIGHT]: 'Стрит',
  [FLUSH]: 'Флеш',
  [FULL_HOUSE]: 'Фулл-хаус',
  [QUADS]: 'Каре',
  [STRAIGHT_FLUSH]: 'Стрит-флеш',
}

const rankCount = new Uint8Array(15)
const suitCount = new Uint8Array(4)
const suitMask = new Int32Array(4)

/**
 * Сила лучшей пятёрки из `count` карт буфера. Буфер приходит снаружи
 * и не режется — перебор зовёт эту функцию миллионы раз.
 */
export function score(cards: ArrayLike<Card>, count: number): number {
  rankCount.fill(0)
  suitCount.fill(0)
  suitMask.fill(0)
  let rankMask = 0

  for (let i = 0; i < count; i++) {
    const card = cards[i]
    const r = (card >> 2) + 2
    const s = card & 3
    rankCount[r]++
    suitCount[s]++
    suitMask[s] |= 1 << r
    rankMask |= 1 << r
  }

  // Флеш проверяется первым. Ни каре, ни фулл-хаус не помещаются в те же семь
  // карт рядом с пятью одномастными, так что порядок ничего не теряет.
  let flushMask = 0
  for (let s = 0; s < 4; s++) if (suitCount[s] >= 5) { flushMask = suitMask[s]; break }
  if (flushMask !== 0) {
    const high = straightHigh(flushMask)
    if (high > 0) return (STRAIGHT_FLUSH << 20) | (high << 16)
    return packTop(FLUSH << 20, 16, flushMask, 5)
  }

  let quad = 0, trip = 0, secondTrip = 0, pair1 = 0, pair2 = 0
  for (let r = 14; r >= 2; r--) {
    const c = rankCount[r]
    if (c === 4) { if (quad === 0) quad = r }
    else if (c === 3) { if (trip === 0) trip = r; else if (secondTrip === 0) secondTrip = r }
    else if (c === 2) { if (pair1 === 0) pair1 = r; else if (pair2 === 0) pair2 = r }
  }

  if (quad !== 0) return packTop((QUADS << 20) | (quad << 16), 12, rankMask & ~(1 << quad), 1)

  const fullPair = pair1 !== 0 ? pair1 : secondTrip
  if (trip !== 0 && fullPair !== 0) return (FULL_HOUSE << 20) | (trip << 16) | (fullPair << 12)

  const straight = straightHigh(rankMask)
  if (straight > 0) return (STRAIGHT << 20) | (straight << 16)

  if (trip !== 0) return packTop((TRIPS << 20) | (trip << 16), 12, rankMask & ~(1 << trip), 2)
  if (pair2 !== 0) {
    return packTop((TWO_PAIR << 20) | (pair1 << 16) | (pair2 << 12), 8,
      rankMask & ~(1 << pair1) & ~(1 << pair2), 1)
  }
  if (pair1 !== 0) return packTop((PAIR << 20) | (pair1 << 16), 12, rankMask & ~(1 << pair1), 3)
  return packTop(HIGH_CARD << 20, 16, rankMask, 5)
}

/**
 * Старшая карта стрита, либо 0. Туз опускается в единицу отдельным битом,
 * поэтому «колесо» A2345 находится тем же окном из пяти бит.
 */
export function straightHigh(mask: number): number {
  let m = mask
  if (m & (1 << 14)) m |= 1 << 1
  for (let high = 14; high >= 5; high--) {
    if (((m >> (high - 4)) & 0b11111) === 0b11111) return high
  }
  return 0
}

/** Дописывает в оценку `n` старших достоинств маски начиная с разряда `shift`. */
function packTop(value: number, shift: number, mask: number, n: number): number {
  let v = value, sh = shift, taken = 0
  for (let r = 14; r >= 2 && taken < n; r--) {
    if (mask & (1 << r)) { v |= r << sh; sh -= 4; taken++ }
  }
  return v
}

export interface HandValue {
  score: number
  category: HandCategory
  ranks: number[]
  title: string
}

export function evaluate(cards: Card[]): HandValue {
  return decode(score(cards, cards.length))
}

export function categoryOf(scoreValue: number): HandCategory {
  return (scoreValue >> 20) as HandCategory
}

export function decode(scoreValue: number): HandValue {
  const category = categoryOf(scoreValue)
  const ranks: number[] = []
  for (let shift = 16; shift >= 0; shift -= 4) {
    const r = (scoreValue >> shift) & 0xf
    if (r >= 2) ranks.push(r)
  }
  return { score: scoreValue, category, ranks, title: titleFor(category, ranks) }
}

const SINGLE: Record<number, string> = {
  2: 'двойка', 3: 'тройка', 4: 'четвёрка', 5: 'пятёрка', 6: 'шестёрка', 7: 'семёрка',
  8: 'восьмёрка', 9: 'девятка', 10: 'десятка', 11: 'валет', 12: 'дама', 13: 'король', 14: 'туз',
}
const MANY: Record<number, string> = {
  2: 'двойки', 3: 'тройки', 4: 'четвёрки', 5: 'пятёрки', 6: 'шестёрки', 7: 'семёрки',
  8: 'восьмёрки', 9: 'девятки', 10: 'десятки', 11: 'валеты', 12: 'дамы', 13: 'короли', 14: 'тузы',
}

/** Название с разрешением: без него две руки одной категории на экране
 *  неразличимы, а спор между ними решают как раз кикеры. */
function titleFor(category: HandCategory, r: number[]): string {
  const one = (x: number) => SINGLE[x] ?? String(x)
  const many = (x: number) => MANY[x] ?? String(x)
  switch (category) {
    case STRAIGHT_FLUSH: return r[0] === 14 ? 'Флеш-рояль' : `Стрит-флеш до ${one(r[0])}`
    case QUADS: return `Каре ${many(r[0])}`
    case FULL_HOUSE: return `Фулл-хаус, ${many(r[0])} на ${many(r[1])}`
    case FLUSH: return `Флеш до ${one(r[0])}`
    case STRAIGHT: return `Стрит до ${one(r[0])}`
    case TRIPS: return `Сет ${many(r[0])}`
    case TWO_PAIR: return `Две пары, ${many(r[0])} и ${many(r[1])}`
    case PAIR: return `Пара ${many(r[0])}`
    default: return `Старшая ${one(r[0])}`
  }
}

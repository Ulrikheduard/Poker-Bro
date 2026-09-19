import { type Card, type Rank, ALL_RANKS, ALL_SUITS, RANK_CODE, makeCard } from './cards'

/**
 * Класс стартовой руки: AKs, AKo, 77. Их ровно 169 — до флопа карты одной
 * масти друг от друга неотличимы, и 1326 конкретных раздач схлопываются.
 *
 * Диапазон — это множество нотаций (`Set<string>`), а не массив объектов:
 * объединение, вычитание и проверка вхождения тогда достаются даром.
 */

export interface HandClass {
  high: Rank
  low: Rank
  suited: boolean
  notation: string
}

export type HandRange = Set<string>

const RANK_BY_CODE: Record<string, Rank> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  T: 10, J: 11, Q: 12, K: 13, A: 14,
}

export function handClass(a: Rank, b: Rank, suited: boolean): HandClass {
  const high = Math.max(a, b)
  const low = Math.min(a, b)
  const isSuited = high !== low && suited
  const notation = high === low
    ? RANK_CODE[high] + RANK_CODE[low]
    : RANK_CODE[high] + RANK_CODE[low] + (isSuited ? 's' : 'o')
  return { high, low, suited: isSuited, notation }
}

export function parseHandClass(text: string): HandClass | null {
  const t = text.trim()
  if (t.length !== 2 && t.length !== 3) return null
  const a = RANK_BY_CODE[t[0].toUpperCase()]
  const b = RANK_BY_CODE[t[1].toUpperCase()]
  if (a === undefined || b === undefined) return null
  if (t.length === 2) return a === b ? handClass(a, b, false) : null
  const mark = t[2].toLowerCase()
  if (mark === 's') return handClass(a, b, true)
  if (mark === 'o') return handClass(a, b, false)
  return null
}

export const isPair = (h: HandClass): boolean => h.high === h.low

/** Сколько конкретных раздач стоит за классом. Из этого складывается процент. */
export const comboCount = (h: HandClass): number => (isPair(h) ? 6 : h.suited ? 4 : 12)

/** Клетка сетки 13×13: одномастные над диагональю, разномастные под ней. */
export function gridPosition(h: HandClass): { row: number; column: number } {
  const hi = 14 - h.high
  const lo = 14 - h.low
  return h.suited ? { row: hi, column: lo } : { row: lo, column: hi }
}

export function cardPairs(h: HandClass): Array<[Card, Card]> {
  const out: Array<[Card, Card]> = []
  if (isPair(h)) {
    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) out.push([makeCard(h.high, ALL_SUITS[i]), makeCard(h.low, ALL_SUITS[j])])
    }
  } else if (h.suited) {
    for (const s of ALL_SUITS) out.push([makeCard(h.high, s), makeCard(h.low, s)])
  } else {
    for (const a of ALL_SUITS) {
      for (const b of ALL_SUITS) if (a !== b) out.push([makeCard(h.high, a), makeCard(h.low, b)])
    }
  }
  return out
}

/** Все 169 классов, от сильных достоинств к младшим. */
export const ALL_HAND_CLASSES: HandClass[] = (() => {
  const out: HandClass[] = []
  const ranks = [...ALL_RANKS].reverse()
  for (const a of ranks) {
    for (const b of ranks) {
      if (b > a) continue
      if (a === b) out.push(handClass(a, b, false))
      else { out.push(handClass(a, b, true)); out.push(handClass(a, b, false)) }
    }
  }
  return out
})()

const BY_NOTATION = new Map(ALL_HAND_CLASSES.map((h) => [h.notation, h]))
export const classOf = (notation: string): HandClass | undefined => BY_NOTATION.get(notation)

export const rangeComboCount = (range: HandRange): number => {
  let total = 0
  for (const n of range) {
    const h = BY_NOTATION.get(n)
    if (h) total += comboCount(h)
  }
  return total
}

/** Доля от всех 1326 раздач. */
export const rangePercentage = (range: HandRange): number => (rangeComboCount(range) / 1326) * 100

export const rangeUnion = (a: HandRange, b: HandRange): HandRange => new Set([...a, ...b])
export const rangeSubtract = (a: HandRange, b: HandRange): HandRange =>
  new Set([...a].filter((n) => !b.has(n)))
export const rangeIntersect = (a: HandRange, b: HandRange): HandRange =>
  new Set([...a].filter((n) => b.has(n)))

/** Конкретные пары карт без тех, что уже видны на столе или в руке. */
export function rangeCombos(range: HandRange, dead: Uint8Array): Array<[number, number]> {
  const out: Array<[number, number]> = []
  for (const n of range) {
    const h = BY_NOTATION.get(n)
    if (!h) continue
    for (const [a, b] of cardPairs(h)) {
      if (!dead[a] && !dead[b]) out.push([a, b])
    }
  }
  return out
}

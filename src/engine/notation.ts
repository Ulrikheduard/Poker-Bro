import { type Rank, ALL_RANKS, RANK_CODE } from './cards'
import {
  type HandClass, type HandRange, handClass, parseHandClass, isPair, comboCount,
} from './range'
import { PREFLOP_ORDER } from './strength'

/**
 * Разбор и сборка привычной записи диапазонов: «77+, ATs+, KQs, AJo+».
 * Нужна в обе стороны: чарты хранятся строками, а отредактированная руками
 * сетка должна превращаться обратно в строку.
 */

export function parseRange(text: string): HandRange {
  const result: HandRange = new Set()
  const tokens = text.replace(/;/g, ',').split(',').map((t) => t.trim()).filter(Boolean)

  for (const token of tokens) {
    if (token.includes('-')) {
      const [fromText, toText] = token.split('-').map((t) => t.trim())
      const from = parseHandClass(fromText)
      const to = parseHandClass(toText)
      if (from && to) for (const h of span(from, to)) result.add(h)
      continue
    }
    if (token.endsWith('+')) {
      const base = token.slice(0, -1)
      const hand = parseHandClass(base)
      if (hand && isPair(hand)) {
        // 77+ — все пары выше
        for (const r of ALL_RANKS) if (r >= hand.high) result.add(handClass(r, r, false).notation)
      } else if (hand) {
        // ATs+ — старшая карта та же, кикер растёт до неё
        for (const r of ALL_RANKS) {
          if (r >= hand.low && r < hand.high) result.add(handClass(hand.high, r, hand.suited).notation)
        }
      }
      continue
    }
    const hand = parseHandClass(token)
    if (hand) { result.add(hand.notation); continue }
    // `AK` без буквы масти — это и одномастная, и разномастная
    if (token.length === 2) {
      const s = parseHandClass(token + 's')
      const o = parseHandClass(token + 'o')
      if (s) result.add(s.notation)
      if (o) result.add(o.notation)
    }
  }
  return result
}

/**
 * Пробег между двумя руками: пары идут по достоинству, непарные —
 * с сохранением разрыва (JTs-54s это все одномастные коннекторы между ними).
 */
function span(a: HandClass, b: HandClass): string[] {
  const out: string[] = []
  if (isPair(a) && isPair(b)) {
    const lo = Math.min(a.high, b.high), hi = Math.max(a.high, b.high)
    for (const r of ALL_RANKS) if (r >= lo && r <= hi) out.push(handClass(r, r, false).notation)
    return out
  }
  if (a.suited !== b.suited) return out
  if (a.high === b.high) {
    const lo = Math.min(a.low, b.low), hi = Math.max(a.low, b.low)
    for (const r of ALL_RANKS) if (r >= lo && r <= hi) out.push(handClass(a.high, r, a.suited).notation)
    return out
  }
  const gapA = a.high - a.low
  if (gapA !== b.high - b.low) return out
  const lo = Math.min(a.high, b.high), hi = Math.max(a.high, b.high)
  for (const r of ALL_RANKS) {
    if (r < lo || r > hi) continue
    const low = r - gapA
    if (low >= 2) out.push(handClass(r, low, a.suited).notation)
  }
  return out
}

export function compactRange(range: HandRange): string {
  const parts: string[] = []
  const hands = [...range].map(parseHandClass).filter((h): h is HandClass => h !== null)

  const pairRanks = hands.filter(isPair).map((h) => h.high).sort((x, y) => x - y)
  for (const run of runs(pairRanks)) {
    const lo = run[0], hi = run[run.length - 1]
    if (hi === 14 && lo !== 14) parts.push(`${RANK_CODE[lo]}${RANK_CODE[lo]}+`)
    else if (lo === hi) parts.push(`${RANK_CODE[lo]}${RANK_CODE[lo]}`)
    else parts.push(`${RANK_CODE[hi]}${RANK_CODE[hi]}-${RANK_CODE[lo]}${RANK_CODE[lo]}`)
  }

  for (const suited of [true, false]) {
    for (const high of [...ALL_RANKS].reverse()) {
      const lows = hands
        .filter((h) => !isPair(h) && h.suited === suited && h.high === high)
        .map((h) => h.low).sort((x, y) => x - y)
      if (lows.length === 0) continue
      const mark = suited ? 's' : 'o'
      for (const run of runs(lows)) {
        const lo = run[0], hi = run[run.length - 1]
        if (hi === high - 1 && lo !== hi) parts.push(`${RANK_CODE[high]}${RANK_CODE[lo]}${mark}+`)
        else if (lo === hi) parts.push(`${RANK_CODE[high]}${RANK_CODE[lo]}${mark}`)
        else parts.push(`${RANK_CODE[high]}${RANK_CODE[hi]}${mark}-${RANK_CODE[high]}${RANK_CODE[lo]}${mark}`)
      }
    }
  }
  return parts.join(', ')
}

function runs(ranks: Rank[]): Rank[][] {
  if (ranks.length === 0) return []
  const out: Rank[][] = []
  let current: Rank[] = [ranks[0]]
  for (const r of ranks.slice(1)) {
    if (r === current[current.length - 1] + 1) current.push(r)
    else { out.push(current); current = [r] }
  }
  out.push(current)
  return out
}

/**
 * «Оппонент играет топ-25 %» — по таблице силы стартовых рук. Набирается
 * классами целиком: резать класс пополам значило бы придумать частоту,
 * которой в таблице нет.
 */
export function topPercentRange(percent: number): HandRange {
  const target = (1326 * percent) / 100
  const result: HandRange = new Set()
  let combos = 0
  for (const notation of PREFLOP_ORDER) {
    if (combos >= target) break
    const hand = parseHandClass(notation)
    if (!hand) continue
    result.add(notation)
    combos += comboCount(hand)
  }
  return result
}

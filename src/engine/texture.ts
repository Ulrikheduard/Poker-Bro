import { type Card, cardRank, cardSuit } from './cards'
import { straightHigh } from './evaluator'

/**
 * Чтение доски. Нужно не ради ярлыков: размер ставки и то, насколько спокойно
 * можно ставить на значение, зависят от того, сколько рук доска задевает.
 */

export type Suitedness = 'rainbow' | 'twoTone' | 'monotone'
export type Connectedness = 'dry' | 'semiConnected' | 'connected'

export const SUITEDNESS_TITLE: Record<Suitedness, string> = {
  rainbow: 'радуга', twoTone: 'две масти', monotone: 'одномастная',
}
export const CONNECTEDNESS_TITLE: Record<Connectedness, string> = {
  dry: 'сухая', semiConnected: 'полусвязанная', connected: 'связанная',
}

export interface BoardTexture {
  suitedness: Suitedness
  connectedness: Connectedness
  isPaired: boolean
  /** Сколько карт доски — десятка и выше. */
  highCards: number
  flushPossible: boolean
  straightPossible: boolean
  summary: string
  /** От 0 (A72 радугой) до 1 (JT9 в одной масти). Служебное: по нему подбирается размер. */
  wetness: number
}

export function readBoard(board: Card[]): BoardTexture | null {
  if (board.length < 3) return null

  const suitCount = [0, 0, 0, 0]
  const rankCount = new Map<number, number>()
  let mask = 0
  for (const c of board) {
    suitCount[cardSuit(c)]++
    const r = cardRank(c)
    rankCount.set(r, (rankCount.get(r) ?? 0) + 1)
    mask |= 1 << r
  }
  const maxSuit = Math.max(...suitCount)
  const suitedness: Suitedness =
    maxSuit >= (board.length >= 4 ? 4 : 3) ? 'monotone' : maxSuit >= 2 ? 'twoTone' : 'rainbow'

  // Связанная — три карты в окне из пяти: двумя картами с руки стрит уже
  // достраивается. Полусвязанная — пара карт не дальше двух рангов: KQ, J9, T8
  // на тёрне легко дорастают до трёх в окне. Разрыв больше двух так не работает,
  // поэтому K-9-2 остаётся сухой, какой её и считают.
  let withAceLow = mask
  if (mask & (1 << 14)) withAceLow |= 1 << 1
  let threeInWindow = false
  for (let low = 1; low <= 10 && !threeInWindow; low++) {
    let count = 0
    for (let offset = 0; offset < 5; offset++) if (withAceLow & (1 << (low + offset))) count++
    if (count >= 3) threeInWindow = true
  }
  // Туз снизу сюда не входит: A-2 достраивается до колеса только тремя картами.
  const values = board.map(cardRank)
  let closePair = false
  for (let i = 0; i < values.length; i++) {
    for (let j = i + 1; j < values.length; j++) {
      if (Math.abs(values[i] - values[j]) <= 2) closePair = true
    }
  }
  const connectedness: Connectedness = threeInWindow ? 'connected' : closePair ? 'semiConnected' : 'dry'
  const isPaired = [...rankCount.values()].some((n) => n >= 2)

  let wetness = 0
  wetness += suitedness === 'monotone' ? 0.5 : suitedness === 'twoTone' ? 0.3 : 0
  wetness += connectedness === 'connected' ? 0.4 : connectedness === 'semiConnected' ? 0.2 : 0
  if (isPaired) wetness += 0.1

  const parts = [SUITEDNESS_TITLE[suitedness], CONNECTEDNESS_TITLE[connectedness]]
  if (isPaired) parts.push('спаренная')

  return {
    suitedness,
    connectedness,
    isPaired,
    highCards: board.filter((c) => cardRank(c) >= 10).length,
    // Три карты одной масти — флеш уже собирается двумя картами с руки.
    flushPossible: maxSuit >= 3,
    straightPossible: threeInWindow || straightHigh(mask) > 0,
    summary: parts.join(', '),
    wetness: Math.min(wetness, 1),
  }
}

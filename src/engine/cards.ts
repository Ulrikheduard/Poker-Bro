/**
 * Карты. Как и в нативной версии, карта — это число 0…51, а не объект:
 * перебор гоняет их миллионами, и выделять объект на каждую было бы
 * единственным, что здесь по-настоящему тормозит.
 *
 *   индекс = (достоинство − 2) × 4 + масть
 */

export type Suit = 0 | 1 | 2 | 3
export const CLUBS = 0, DIAMONDS = 1, HEARTS = 2, SPADES = 3

/** Достоинство: 2…14, туз всегда 14. «Колесо» A2345 обрабатывается в оценщике
 *  отдельно, а не вторым значением туза — иначе он полез бы в кикеры единицей. */
export type Rank = number

export type Card = number

export const SUIT_SYMBOL = ['♣', '♦', '♥', '♠'] as const
export const SUIT_LETTER = ['c', 'd', 'h', 's'] as const
export const SUIT_NAME = ['трефы', 'бубны', 'червы', 'пики'] as const

export const RANK_LABEL: Record<number, string> = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9',
  10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A',
}
/** В покерной записи десятка — «T», чтобы рука была ровно из двух знаков: AKs, T9s. */
export const RANK_CODE: Record<number, string> = { ...RANK_LABEL, 10: 'T' }

export const ALL_RANKS: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
export const ALL_SUITS: Suit[] = [0, 1, 2, 3]

export const makeCard = (rank: Rank, suit: Suit): Card => (rank - 2) * 4 + suit
export const cardRank = (card: Card): Rank => (card >> 2) + 2
export const cardSuit = (card: Card): Suit => (card & 3) as Suit
export const isRed = (card: Card): boolean => cardSuit(card) === DIAMONDS || cardSuit(card) === HEARTS

export const cardCode = (card: Card): string => RANK_CODE[cardRank(card)] + SUIT_LETTER[cardSuit(card)]
export const cardLabel = (card: Card): string => RANK_LABEL[cardRank(card)]
export const cardSymbol = (card: Card): string => SUIT_SYMBOL[cardSuit(card)]
export const cardName = (card: Card): string => `${RANK_LABEL[cardRank(card)]} ${SUIT_NAME[cardSuit(card)]}`

export const FULL_DECK: Card[] = Array.from({ length: 52 }, (_, i) => i)

const RANK_BY_CODE: Record<string, Rank> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  T: 10, J: 11, Q: 12, K: 13, A: 14,
}
const SUIT_BY_LETTER: Record<string, Suit> = { c: 0, d: 1, h: 2, s: 3 }

/** Разбор одной карты: `Ah`, `Td`, допускается и `10h`. */
export function parseCard(text: string): Card | null {
  const t = text.trim()
  if (t.length === 3 && t.startsWith('10')) {
    const suit = SUIT_BY_LETTER[t[2].toLowerCase()]
    return suit === undefined ? null : makeCard(10, suit)
  }
  if (t.length !== 2) return null
  const rank = RANK_BY_CODE[t[0].toUpperCase()]
  const suit = SUIT_BY_LETTER[t[1].toLowerCase()]
  if (rank === undefined || suit === undefined) return null
  return makeCard(rank, suit)
}

/** Разбор строки карт: `"Ah Kd 7c"` и слитное `"AhKd7c"` — оба варианта. */
export function parseCards(text: string): Card[] {
  const cleaned = text.replace(/,/g, ' ').trim()
  if (cleaned.includes(' ')) {
    return cleaned.split(/\s+/).map(parseCard).filter((c): c is Card => c !== null)
  }
  const out: Card[] = []
  for (let i = 0; i + 1 < cleaned.length; ) {
    const card = parseCard(cleaned.slice(i, i + 2))
    if (card !== null) { out.push(card); i += 2 } else { i += 1 }
  }
  return out
}

export const cardsToCodes = (cards: Card[]): string => cards.map(cardCode).join(' ')

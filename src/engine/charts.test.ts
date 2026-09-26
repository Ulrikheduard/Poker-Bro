import { describe, it, expect } from 'vitest'
import {
  POSITIONS, OPEN_RAISE, FACING_OPEN, spotsFor, actionFor, playedPercentage,
  type Position,
} from './charts'
import { ALL_HAND_CLASSES, rangePercentage, rangeSubtract, rangeIntersect } from './range'
import { compactRange } from './notation'
import { readBoard } from './texture'
import { parseCards } from './cards'
import { GLOSSARY, searchGlossary } from './glossary'
import { HAND_RANKINGS, TOTAL_SEVEN_CARD_HANDS } from './rankings'

const openOf = (p: Position) => OPEN_RAISE.find((s) => s.hero === p)!

describe('префлоп-чарты', () => {
  it('диапазон открытия расширяется к баттону', () => {
    const order: Position[] = ['utg', 'hj', 'co', 'btn']
    let previous = 0
    for (const p of order) {
      const share = rangePercentage(openOf(p).raise)
      expect(share, p).toBeGreaterThan(previous)
      previous = share
    }
    expect(rangePercentage(openOf('utg').raise)).toBeCloseTo(16, -1)
    expect(rangePercentage(openOf('btn').raise)).toBeCloseTo(43, -1)
  })

  it('узкая позиция целиком входит в широкую', () => {
    const order: Position[] = ['utg', 'hj', 'co', 'btn']
    for (let i = 0; i < order.length - 1; i++) {
      const leak = rangeSubtract(openOf(order[i]).raise, openOf(order[i + 1]).raise)
      expect(leak.size, `${order[i]} ⊄ ${order[i + 1]}: ${compactRange(leak)}`).toBe(0)
    }
  })

  it('рука не стоит одновременно в рейзе и в колле', () => {
    for (const spot of FACING_OPEN) {
      expect(rangeIntersect(spot.raise, spot.call).size, spot.title).toBe(0)
      expect(spot.raise.size, spot.title).toBeGreaterThan(0)
      expect(spot.call.size, spot.title).toBeGreaterThan(0)
    }
  })

  it('защита расширяется против более широкого оппонента', () => {
    const defence = (versus: Position) =>
      playedPercentage(FACING_OPEN.find((s) => s.hero === 'bb' && s.versus === versus)!)
    expect(defence('utg')).toBeLessThan(defence('co'))
    expect(defence('co')).toBeLessThan(defence('btn'))
    expect(defence('btn')).toBeGreaterThan(30)
  })

  it('каждая из 169 рук получает ровно один ответ', () => {
    for (const spot of [...OPEN_RAISE, ...FACING_OPEN]) {
      for (const hand of ALL_HAND_CLASSES) {
        const action = actionFor(spot, hand.notation)
        if (action === 'raise') expect(spot.raise.has(hand.notation)).toBe(true)
        if (action === 'call') {
          expect(spot.call.has(hand.notation)).toBe(true)
          expect(spot.raise.has(hand.notation)).toBe(false)
        }
        if (action === 'fold') {
          expect(spot.raise.has(hand.notation) || spot.call.has(hand.notation)).toBe(false)
        }
      }
    }
  })

  it('премиум-руки не сбрасываются нигде', () => {
    for (const spot of [...OPEN_RAISE, ...FACING_OPEN]) {
      for (const n of ['AA', 'KK', 'QQ', 'AKs']) {
        expect(actionFor(spot, n), `${spot.title} сбрасывает ${n}`).toBe('raise')
      }
    }
  })

  it('у каждой позиции есть хотя бы одна разобранная ситуация', () => {
    for (const p of POSITIONS) expect(spotsFor(p).length, p).toBeGreaterThan(0)
  })
})

describe('чтение доски', () => {
  it('сухая доска — та, где стрит не собирается двумя картами с руки', () => {
    expect(readBoard([])).toBeNull()
    expect(board('Kh 9h 2c').connectedness).toBe('dry')
    expect(board('Ac 7d 2s').connectedness).toBe('dry')
    expect(board('Ac 7d 2s').straightPossible).toBe(false)
  })

  it('связанные и полусвязанные', () => {
    expect(board('9c 8d 7h').connectedness).toBe('connected')
    expect(board('Ac 2d 3h').connectedness).toBe('connected')
    expect(board('Jh 9d 2c').connectedness).toBe('semiConnected')
    expect(board('Kc Qd 5s').connectedness).toBe('semiConnected')
  })

  it('мастность и спаренность', () => {
    expect(board('Kh 9h 2h').suitedness).toBe('monotone')
    expect(board('Kh 9h 2c').suitedness).toBe('twoTone')
    expect(board('Kh 9d 2c').suitedness).toBe('rainbow')
    expect(board('Ks Kh 2c').isPaired).toBe(true)
    expect(board('Ks Qh 2c').isPaired).toBe(false)
  })

  it('мокрая доска получает больший размер ставки, чем сухая', () => {
    expect(board('Ac 7d 2s').wetness).toBeLessThan(board('Jh 9d 2c').wetness)
    expect(board('Jh 9d 2c').wetness).toBeLessThan(board('Jh Th 9h').wetness)
  })
})

describe('справочный материал', () => {
  it('словарь: 74 термина, идентификаторы уникальны', () => {
    expect(GLOSSARY.length).toBe(74)
    expect(new Set(GLOSSARY.map((t) => t.id)).size).toBe(74)
    for (const t of GLOSSARY) {
      expect(t.definition.length, t.term).toBeGreaterThan(20)
      expect(t.example.length, t.term).toBeGreaterThan(10)
    }
    expect(searchGlossary('флоп').length).toBeGreaterThan(0)
    expect(searchGlossary('абракадабра').length).toBe(0)
    // Делёжка банка объяснена: по этим словам новичок и будет искать
    expect(searchGlossary('сплит').length).toBeGreaterThan(0)
    expect(searchGlossary('делится').length).toBeGreaterThan(0)
    expect(searchGlossary('доска играет').length).toBeGreaterThan(0)
  })

  it('комбинации: десять строк, частоты дают 100 %, наборы сходятся до единицы', () => {
    expect(HAND_RANKINGS.length).toBe(10)
    expect(HAND_RANKINGS.reduce((s, e) => s + e.frequency, 0)).toBeCloseTo(100, 2)
    // Сумма наборов обязана совпасть ровно: это проверка того, что флеш-рояль
    // вычтен из стрит-флеша, а не добавлен сверху.
    expect(HAND_RANKINGS.reduce((s, e) => s + e.combinations, 0)).toBe(TOTAL_SEVEN_CARD_HANDS)
    for (const e of HAND_RANKINGS) expect(e.example.length, e.title).toBe(5)
    // Идентификаторы уникальны: у флеш-рояля и стрит-флеша одна категория,
    // и по ней строки склеились бы в одну.
    expect(new Set(HAND_RANKINGS.map((e) => e.id)).size).toBe(10)
  })

  it('флеш-рояль стоит первым и вычтен из стрит-флеша', () => {
    const royal = HAND_RANKINGS[0]
    const straightFlush = HAND_RANKINGS[1]
    expect(royal.id).toBe('royalFlush')
    expect(royal.title).toBe('Флеш-рояль')
    expect(royal.category).toBe(straightFlush.category)   // для оценщика это одно и то же
    expect(royal.combinations).toBe(4_324)
    expect(royal.combinations + straightFlush.combinations).toBe(41_584)
    // Он самый редкий в списке
    expect(royal.frequency).toBeLessThan(straightFlush.frequency)
  })

  it('список идёт строго от сильной комбинации к слабой', () => {
    for (let i = 1; i < HAND_RANKINGS.length; i++) {
      expect(HAND_RANKINGS[i].category, HAND_RANKINGS[i].title)
        .toBeLessThanOrEqual(HAND_RANKINGS[i - 1].category)
    }
  })
})

/** Доска из трёх карт — `readBoard` здесь никогда не вернёт null. */
function board(text: string) {
  const result = readBoard(parseCards(text))
  if (!result) throw new Error('доска не прочиталась: ' + text)
  return result
}

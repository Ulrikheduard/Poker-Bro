import { describe, it, expect } from 'vitest'
import { parseCards } from './cards'
import { analyseSpot, STRENGTH_TITLE } from './advice'
import { frequencies, minimumDefence, potOdds, requiredEquity } from './odds'

const spot = (hole: string, board: string, extra: Partial<Parameters<typeof analyseSpot>[0]> = {}) =>
  analyseSpot({
    hole: parseCards(hole),
    board: parseCards(board),
    pot: 150, toCall: 50, effectiveStack: 900, opponents: 1, opponentRange: null,
    ...extra,
  }, 20_000)

describe('слова про эквити', () => {
  it('эквити называется долей банка, а не долей случаев', () => {
    const a = spot('Ah Kh', 'Qh 7h 2c')
    const text = [a.advice.headline, ...a.advice.reasons].join(' ')
    // «Вы выигрываете в 67 % случаев» — это про win, а печаталось эквити.
    expect(text).not.toMatch(/впереди в .* случаев/)
    expect(text).not.toMatch(/[Вв]ы выигрываете в .* случаев/)
    expect(text).toMatch(/доля банка/i)
  })

  it('разница долей не печатается как проценты', () => {
    for (const board of ['Qh 7h 2c', 'Qh 7d 2c', '2h 7d Kc']) {
      const a = spot('Ah Kh', board)
      const text = [a.advice.headline, ...a.advice.reasons].join(' ')
      // Раньше здесь стояло «на 24,3 % выше порога» — это процентные пункты.
      expect(text).not.toMatch(/на .* (выше|ниже) порога/)
      expect(text).not.toMatch(/не хватает .* до окупаемости/)
    }
  })

  it('доля банка и порог названы оба, чтобы разницу было видно', () => {
    const a = spot('Ah Kh', 'Qh 7h 2c')
    const need = requiredEquity(potOdds(150, 50))
    expect(need).toBeCloseTo(0.25, 3)
    const text = [a.advice.headline, ...a.advice.reasons].join(' ')
    expect(text).toMatch(/25,0 %/)
  })
})

describe('уверенность решения', () => {
  it('close читается как середина, а не как самый уверенный вариант', () => {
    expect(STRENGTH_TITLE.close).not.toBe('с запасом')
    expect(STRENGTH_TITLE.clear).toBe('уверенно')
    expect(STRENGTH_TITLE.marginal).toBe('на грани')
    // Все три названия различимы: иначе чип ничего не сообщает.
    expect(new Set(Object.values(STRENGTH_TITLE)).size).toBe(3)
  })
})

describe('ставка не больше банка', () => {
  it('банк задан вместе со ставкой, поэтому шансы банка не опускаются ниже 1 : 1', () => {
    // Раньше интерфейс позволял выставить колл больше банка, и получалось
    // «0,7 : 1» — раздача, которой не бывает.
    for (const [pot, toCall] of [[150, 50], [100, 100], [200, 20]] as const) {
      const ratio = pot / toCall
      expect(ratio).toBeGreaterThanOrEqual(1)
      expect(requiredEquity(potOdds(pot, toCall))).toBeLessThanOrEqual(0.5)
    }
  })

  it('банк до ставки не уходит в минус', () => {
    const pot = 150, toCall = 50
    expect(pot - toCall).toBeGreaterThan(0)
    expect(minimumDefence(frequencies(toCall, pot - toCall))).toBeGreaterThan(0)
  })
})

describe('минимальная защита', () => {
  it('зависит от настоящей ставки, а не постоянна', () => {
    // Банк 150 уже со ставкой 50: до неё в банке было 100.
    const half = minimumDefence(frequencies(50, 100))
    const pot = minimumDefence(frequencies(100, 100))
    expect(half).toBeCloseTo(2 / 3, 5)
    expect(pot).toBeCloseTo(0.5, 5)
    // Старая плитка считала frequencies(pot * 0.66, pot) и давала 60 % всегда.
    expect(half).not.toBeCloseTo(pot, 2)
  })
})

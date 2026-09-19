import { describe, it, expect } from 'vitest'
import { parseCards } from './cards'
import { exactHeadsUp, calculateEquity } from './equity'
import { parseRange, compactRange, topPercentRange } from './notation'
import { ALL_HAND_CLASSES, comboCount, rangeCombos, rangePercentage, parseHandClass } from './range'
import { PREFLOP_ORDER } from './strength'

const eq = (a: string, b: string) => exactHeadsUp(parseCards(a), parseCards(b))

describe('эквити', () => {
  /**
   * Те же опорные значения, что и в нативной версии, полученные перебором
   * всех 1 712 304 досок. 82,36 % побед у AA против KK — величина, которую
   * печатает любой покерный калькулятор. Совпадение здесь означает, что
   * веб-версия и приложение на iPhone считают одинаково.
   */
  it('совпадает с нативной версией на известных раскладах', () => {
    const aaKK = eq('Ah Ad', 'Kh Kd')
    expect(aaKK.isExact).toBe(true)
    expect(aaKK.iterations).toBe(1_712_304)
    expect(aaKK.win).toBeCloseTo(0.8236, 3)
    expect(aaKK.equity).toBeCloseTo(0.8264, 3)

    expect(eq('Ah Kh', 'Qh Qd').equity).toBeCloseTo(0.4588, 3)   // одномастные против пары
    expect(eq('Ah Ks', 'Qc Qd').equity).toBeCloseTo(0.4284, 3)   // разномастные хуже на 3 %
    expect(eq('7h 7d', 'Ah Ks').equity).toBeCloseTo(0.5498, 3)   // пара против двух оверкарт
    expect(eq('7h 7d', 'Ah Kh').equity).toBeCloseTo(0.5250, 3)   // одномастность стоит 2,5 %
    expect(eq('Ah 2h', 'Kc Qs').equity).toBeCloseTo(0.6036, 3)
  }, 60_000)

  it('Монте-Карло сходится к перебору', () => {
    const hero = parseCards('Ah Ad')
    const dead = new Uint8Array(52)
    for (const c of hero) dead[c] = 1
    const range = parseRange('KK')

    const combos = rangeCombos(range, dead)
    expect(combos.length).toBe(6)
    const exact = combos.reduce((sum, [a, b]) => sum + exactHeadsUp(hero, [a, b]).equity, 0) / combos.length

    const mc = calculateEquity(
      { hero, board: [], opponents: 1, model: { kind: 'range', range } }, 300_000,
    )
    expect(mc.isExact).toBe(false)
    expect(mc.equity).toBeCloseTo(exact, 2)
  }, 60_000)

  it('на ривере перебирать нечего — ответ точный', () => {
    const r = calculateEquity({
      hero: parseCards('Ah Kh'), board: parseCards('Qh Jh Th 2c 3d'),
      opponents: 1, model: { kind: 'random' },
    })
    expect(r.isExact).toBe(true)
    expect(r.equity).toBeCloseTo(1, 4)   // флеш-рояль не проигрывает
  })

  it('доска играет сама за себя — всегда ничья', () => {
    const r = calculateEquity({
      hero: parseCards('2c 3d'), board: parseCards('Ah Kh Qh Jh Th'),
      opponents: 1, model: { kind: 'random' },
    })
    expect(r.equity).toBeCloseTo(0.5, 2)
  })

  it('эквити падает с каждым новым оппонентом', () => {
    let previous = 1
    for (let n = 1; n <= 5; n++) {
      const r = calculateEquity(
        { hero: parseCards('Ah Ad'), board: [], opponents: n, model: { kind: 'random' } }, 60_000,
      )
      expect(r.equity).toBeLessThan(previous)
      previous = r.equity
    }
    expect(previous).toBeLessThan(0.6)
  }, 30_000)
})

describe('диапазоны', () => {
  it('запись разбирается и собирается обратно', () => {
    for (const text of ['77+', 'ATs+', 'AJo+', 'KQs', '22-66', 'AQs-A9s', 'JTs-54s']) {
      const range = parseRange(text)
      expect(range.size, text).toBeGreaterThan(0)
      expect(parseRange(compactRange(range)), text).toEqual(range)
    }
    expect(parseRange('77+').size).toBe(8)
    expect(parseRange('ATs+').size).toBe(4)
    expect(ALL_HAND_CLASSES.length).toBe(169)
    expect(ALL_HAND_CLASSES.reduce((s, h) => s + comboCount(h), 0)).toBe(1326)
  })

  it('топ-N % берётся из таблицы силы', () => {
    const top10 = topPercentRange(10)
    expect(top10.has('AA')).toBe(true)
    expect(top10.has('AKs')).toBe(true)
    expect(top10.has('72o')).toBe(false)
    expect(rangePercentage(top10)).toBeCloseTo(10, 0)
    expect(PREFLOP_ORDER.length).toBe(169)
    expect(PREFLOP_ORDER[0]).toBe('AA')
    expect(PREFLOP_ORDER[PREFLOP_ORDER.length - 1]).toBe('32o')
    // Каждая нотация в таблице обязана быть настоящим классом руки
    for (const n of PREFLOP_ORDER) expect(parseHandClass(n), n).not.toBeNull()
  })
})

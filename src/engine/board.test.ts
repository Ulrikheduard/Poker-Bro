import { describe, it, expect } from 'vitest'
import { parseCards } from './cards'
import { streetFor } from './advice'
import { analyseDraws } from './draws'

/**
 * Доска из одной или двух карт в покере невозможна. Раньше интерфейс позволял
 * её собрать, показывал карты на экране и молча считал по неполному набору —
 * поэтому здесь закреплено, что именно движок про такую доску думает.
 */
describe('неполная доска', () => {
  it('одна и две карты — это ещё не улица', () => {
    expect(streetFor(1)).toBe('preflop')
    expect(streetFor(2)).toBe('preflop')
    // ...но и префлопом их называть нельзя: интерфейс обязан отказаться считать,
    // а не выдавать эти значения за настоящую улицу.
    expect(streetFor(0)).toBe('preflop')
    expect(streetFor(3)).toBe('flop')
    expect(streetFor(4)).toBe('turn')
    expect(streetFor(5)).toBe('river')
  })

  it('разбор дро на неполной доске не берётся считать', () => {
    const hole = parseCards('Ah Kh')
    expect(analyseDraws(hole, parseCards('Qh'))).toBeNull()
    expect(analyseDraws(hole, parseCards('Qh 7d'))).toBeNull()
    // С полного флопа — уже считает.
    expect(analyseDraws(hole, parseCards('Qh 7d 2c'))).not.toBeNull()
  })

  it('на полной доске дро есть, а на её обрезке ответа нет', () => {
    const hole = parseCards('Ah Kh')
    const full = analyseDraws(hole, parseCards('Qh 7h 2c'))!
    expect(full.draws.some((d) => d.kind === 'flush')).toBe(true)
    expect(analyseDraws(hole, parseCards('Qh 7h'))).toBeNull()
  })
})

import { describe, it, expect } from 'vitest'
import { parseCards } from './cards'
import { analyseDraws } from './draws'
import { exactOutsEquity, quickEquity } from './odds'
import { HIGH_CARD, TRIPS } from './evaluator'

const analyse = (hole: string, board: string) => analyseDraws(parseCards(hole), parseCards(board))!

describe('дро и ауты', () => {
  /**
   * Две оверкарты без дро — шесть аутов, а не пятнадцать. Карты, спаривающие
   * доску, аутами не являются: такую пару получает и оппонент.
   */
  it('оверкарты дают шесть аутов, спаривание доски не в счёт', () => {
    const a = analyse('Ah Kh', 'Qh 7d 2c')
    expect(a.current.category).toBe(HIGH_CARD)
    expect(a.totalOuts).toBe(6)
    expect(a.draws.find((d) => d.kind === 'overcards')?.outs).toBe(6)
    expect(a.boardPairing).toBe(9)   // Q, 7, 2 — по три карты каждая
  })

  it('флеш-дро — девять аутов', () => {
    const a = analyse('Ah 5h', 'Kh 9h 2c')
    expect(a.draws.find((d) => d.kind === 'flush')?.outs).toBe(9)
    expect(a.summary).toContain('флеш-дро')
  })

  it('двусторонний стрит — восемь, гатшот — четыре', () => {
    expect(analyse('9c 8d', '7h 6s 2c').draws.find((d) => d.kind === 'straight')?.outs).toBe(8)
    expect(analyse('9c 8d', '7h 5s 2c').draws.find((d) => d.kind === 'straight')?.outs).toBe(4)
    expect(analyse('9c 8d', '7h 6s 2c').summary).toContain('двусторонний')
    expect(analyse('9c 8d', '7h 5s 2c').summary).toContain('гатшот')
  })

  it('три карты одной масти — это бэкдор, а не флеш-дро', () => {
    const a = analyse('9h 8h', '7h 6c 2d')
    expect(a.draws.find((d) => d.kind === 'flush')).toBeUndefined()
    expect(a.draws.find((d) => d.kind === 'straight')?.outs).toBe(8)
    expect(a.strongOuts).toBe(8)
  })

  /** Комбо-дро: 15 аутов до руки не слабее стрита, а не 9 + 8 = 17. */
  it('карта, закрывающая два дро сразу, считается один раз', () => {
    const a = analyse('9h 8h', '7h 2h 6c')
    expect(a.draws.find((d) => d.kind === 'flush')?.outs).toBe(9)
    expect(a.draws.find((d) => d.kind === 'straight')?.outs).toBe(6)
    expect(a.strongOuts).toBe(15)
    expect(a.totalOuts).toBe(a.draws.reduce((s, d) => s + d.outs, 0))
    expect(exactOutsEquity(15, 47, 2)).toBeCloseTo(0.545, 2)
  })

  it('для карманной пары спаренная доска — настоящий аут', () => {
    const a = analyse('7h 7d', 'Qs 7c 2d')
    expect(a.current.category).toBe(TRIPS)
    expect(a.totalOuts).toBeGreaterThan(0)
    expect(a.boardPairing).toBe(0)
  })

  it('правило 2 и 4 завышает, и тем сильнее, чем больше аутов', () => {
    const exact = exactOutsEquity(9, 47, 2)
    expect(exact).toBeCloseTo(0.35, 2)
    expect(quickEquity(9, 2)).toBeGreaterThan(exact)
    expect(exactOutsEquity(9, 46, 1)).toBeCloseTo(0.196, 2)
  })
})

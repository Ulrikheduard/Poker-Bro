import { describe, it, expect } from 'vitest'
import { parseCards } from './cards'
import { analyseDraws } from './draws'
import { exactOutsEquity, quickEquity } from './odds'
import { HIGH_CARD, TRIPS } from './evaluator'
import { analyseSpot } from './advice'
import { calculateEquity } from './equity'

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

describe('делёжка банка', () => {
  it('«доска играет» определяется точно, а не по доле ничьих', () => {
    // Стрит A-K-Q-J-10 лежит на столе, флеш невозможен — обыграть нечем
    const a = analyseSpot({
      hole: parseCards('2c 3d'), board: parseCards('As Ks Qd Jh Tc'),
      pot: 100, toCall: 0, effectiveStack: 900, opponents: 1, opponentRange: null,
    })
    expect(a.boardPlays).toBe(true)
    expect(a.equity.tie).toBeCloseTo(1, 4)
    expect(a.equity.win).toBeCloseTo(0, 4)
    expect(a.equity.equity).toBeCloseTo(0.5, 4)   // половина банка, а не победа
    expect(a.advice.headline).toContain('разделится')
    expect(a.advice.reasons[0]).toContain('Играет доска')
  })

  /** Поучительный случай: карманные тузы на таком борде не помогают ничем.
   *  Каре не собирается — тузов всего три, — а стрит на столе сильнее сета,
   *  и банк всё равно делится. */
  it('даже карманные тузы не спасают от делёжки, если стрит на столе сильнее', () => {
    const a = analyseSpot({
      hole: parseCards('Ac Ad'), board: parseCards('As Ks Qd Jh Tc'),
      pot: 100, toCall: 0, effectiveStack: 900, opponents: 1, opponentRange: null,
    })
    expect(a.draw?.current.title).toBe('Стрит до туза')
    expect(a.boardPlays).toBe(true)
    expect(a.equity.tie).toBeCloseTo(1, 4)
  })

  it('когда своя карта входит в комбинацию, доска не играет', () => {
    const a = analyseSpot({
      hole: parseCards('Ac Ad'), board: parseCards('As Kd 7h 3d 2c'),
      pot: 100, toCall: 0, effectiveStack: 900, opponents: 1, opponentRange: null,
    })
    expect(a.draw?.current.title).toBe('Тройка тузов')
    expect(a.boardPlays).toBe(false)
    expect(a.equity.win).toBeGreaterThan(0.95)
  })

  it('ничья на троих стоит трети банка, а не половины', () => {
    const three = calculateEquity({
      hero: parseCards('2c 3d'), board: parseCards('As Ks Qd Jh Tc'),
      opponents: 3, model: { kind: 'random' },
    }, 20_000)
    expect(three.tie).toBeCloseTo(1, 2)
    expect(three.equity).toBeCloseTo(0.25, 2)   // банк на четверых
  })
})

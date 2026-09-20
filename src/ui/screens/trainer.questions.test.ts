import { describe, it, expect } from 'vitest'
import { evaluate, STRAIGHT } from '../../engine/evaluator'
import { analyseDraws } from '../../engine/draws'
import { requiredEquity, potOdds, exactOutsEquity } from '../../engine/odds'
import { makeShowdown, makeOdds, makePreflop } from './trainer.questions'

const unique = (xs: unknown[]) => new Set(xs).size === xs.length

describe('пять играющих карт', () => {
  it('из семи карт выбирает комбинацию не слабее любой другой пятёрки', () => {
    for (let i = 0; i < 200; i++) {
      const q = makeShowdown()
      const five = q.playing!
      expect(five).toHaveLength(5)
      const best = evaluate(five).score
      // Ни одна другая пятёрка из тех же семи карт не должна быть сильнее.
      const seven = [...q.deal.hands[q.correct === 1 ? 1 : 0], ...q.deal.board]
      for (let a = 0; a < seven.length; a++)
        for (let b = a + 1; b < seven.length; b++)
          expect(evaluate(seven.filter((_, k) => k !== a && k !== b)).score).toBeLessThanOrEqual(best)
    }
  })

  it('пятёрка целиком лежит среди карт руки и доски', () => {
    const q = makeShowdown()
    const seven = [...q.deal.hands[0], ...q.deal.hands[1], ...q.deal.board]
    for (const card of q.playing!) expect(seven).toContain(card)
  })
})

describe('«Кто сильнее»', () => {
  it('ответ совпадает с оценщиком, а карты не повторяются', () => {
    for (let i = 0; i < 300; i++) {
      const q = makeShowdown()
      const all = [...q.deal.board, ...q.deal.hands[0], ...q.deal.hands[1]]
      expect(unique(all)).toBe(true)
      const a = evaluate([...q.deal.hands[0], ...q.deal.board]).score
      const b = evaluate([...q.deal.hands[1], ...q.deal.board]).score
      expect(q.correct).toBe(a > b ? 0 : b > a ? 1 : 2)
    }
  })
})

describe('«Шанс»', () => {
  it('раздаёт настоящие карты и не называет число аутов в условии', () => {
    for (let i = 0; i < 100; i++) {
      const q = makeOdds()
      if (q.mode !== 'odds') continue
      expect(q.deal.hands[0]).toHaveLength(2)
      expect(q.deal.board.length).toBeGreaterThanOrEqual(3)
      expect(q.deal.board.length).toBeLessThanOrEqual(4)
      expect(unique([...q.deal.board, ...q.deal.hands[0]])).toBe(true)
      // Ауты считает человек: в вопросе их быть не должно.
      expect(q.prompt).not.toMatch(/аут/i)
    }
  })

  it('ответ сходится с тем, что посчитают ауты и шансы банка', () => {
    for (let i = 0; i < 100; i++) {
      const q = makeOdds()
      if (q.mode !== 'odds') continue
      const hole = q.deal.hands[0]
      const analysis = analyseDraws(hole, q.deal.board)!
      const toCome = 5 - q.deal.board.length
      const equity = exactOutsEquity(analysis.strongOuts, analysis.unseen, toCome)
      const need = requiredEquity(potOdds(q.deal.pot!, q.deal.bet!))
      expect(q.correct).toBe(equity >= need ? 0 : 1)
    }
  })

  it('рука ещё не готова и дро настоящее, иначе вопрос не про шансы', () => {
    for (let i = 0; i < 100; i++) {
      const q = makeOdds()
      if (q.mode !== 'odds') continue
      const analysis = analyseDraws(q.deal.hands[0], q.deal.board)!
      expect(analysis.current.category).toBeLessThan(STRAIGHT)
      expect(analysis.strongOuts).toBeGreaterThanOrEqual(4)
    }
  })

  it('ставка подобрана так, что ответ не виден на глаз', () => {
    for (let i = 0; i < 100; i++) {
      const q = makeOdds()
      if (q.mode !== 'odds') continue
      const analysis = analyseDraws(q.deal.hands[0], q.deal.board)!
      const toCome = 5 - q.deal.board.length
      const equity = exactOutsEquity(analysis.strongOuts, analysis.unseen, toCome)
      const need = requiredEquity(potOdds(q.deal.pot!, q.deal.bet!))
      const gap = Math.abs(equity - need)
      expect(gap).toBeGreaterThanOrEqual(0.02)
      expect(gap).toBeLessThanOrEqual(0.12)
    }
  })

  it('банк в кадре уже включает ставку оппонента', () => {
    const q = makeOdds()
    if (q.mode === 'odds') expect(q.deal.pot!).toBeGreaterThan(q.deal.bet!)
  })
})

describe('«До флопа»', () => {
  it('позиция расшифрована, а не подана кодом', () => {
    for (let i = 0; i < 50; i++) {
      const q = makePreflop()
      expect(q.deal.position).toBeTruthy()
      // «CO» само по себе новичку ничего не говорит — нужна и расшифровка.
      expect(q.deal.position).toMatch(/\(/)
      expect(q.deal.hands[0]).toHaveLength(2)
    }
  })
})

describe('метка для итога', () => {
  it('есть у каждого вопроса и не пустая', () => {
    for (const q of [makeShowdown(), makePreflop(), makeOdds()]) {
      expect(q.label.length).toBeGreaterThan(3)
    }
  })
})

import { describe, it, expect } from 'vitest'
import { evaluate, STRAIGHT } from '../../engine/evaluator'
import { analyseDraws } from '../../engine/draws'
import { type Level, makeShowdown, makeOuts, makePreflop } from './trainer.questions'

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
    for (const level of ['easy', 'normal', 'hard'] as Level[]) {
      for (let i = 0; i < 100; i++) {
        const q = makeShowdown(level)
        const all = [...q.deal.board, ...q.deal.hands[0], ...q.deal.hands[1]]
        expect(unique(all)).toBe(true)
        const a = evaluate([...q.deal.hands[0], ...q.deal.board]).score
        const b = evaluate([...q.deal.hands[1], ...q.deal.board]).score
        expect(q.correct).toBe(a > b ? 0 : b > a ? 1 : 2)
      }
    }
  })

  /**
   * Уровень обязан что-то значить. Раздача остаётся честной — отбирается
   * только то, насколько далеки комбинации друг от друга.
   */
  it('уровень задаёт расстояние между комбинациями', () => {
    const gapOf = (level: Level) => {
      const q = makeShowdown(level)
      const a = evaluate([...q.deal.hands[0], ...q.deal.board])
      const b = evaluate([...q.deal.hands[1], ...q.deal.board])
      return Math.abs(a.category - b.category)
    }
    for (let i = 0; i < 60; i++) {
      expect(gapOf('easy')).toBeGreaterThanOrEqual(2)
      expect(gapOf('normal')).toBe(1)
      expect(gapOf('hard')).toBe(0)
    }
  })

  /** «Туз против четвёрка» — ровно та кривизна, из-за которой текст читается
   *  как машинный перевод. После «против» всегда родительный падеж. */
  it('на сложном уровне падежи согласованы', () => {
    const nominative = /против (двойка|тройка|четвёрка|пятёрка|шестёрка|семёрка|восьмёрка|девятка|десятка|валет|дама|король|туз)\b/
    for (let i = 0; i < 60; i++) {
      expect(makeShowdown('hard').explanation).not.toMatch(nominative)
    }
  })

  it('на сложном уровне объяснение называет, что решило спор', () => {
    let explained = 0
    for (let i = 0; i < 60; i++) {
      const q = makeShowdown('hard')
      if (q.correct === 2) continue
      expect(q.explanation).toMatch(/старшинство|кикер|вторая/)
      explained++
    }
    // Ничьи бывают, но не в шестидесяти раздачах подряд.
    expect(explained).toBeGreaterThan(0)
  })
})

describe('«Ауты»', () => {
  it('раздаёт настоящие карты и не называет ответ в условии', () => {
    for (let i = 0; i < 100; i++) {
      const q = makeOuts()
      if (q.mode !== 'outs') continue
      expect(q.deal.hands[0]).toHaveLength(2)
      expect(q.deal.board.length).toBeGreaterThanOrEqual(3)
      expect(q.deal.board.length).toBeLessThanOrEqual(4)
      expect(unique([...q.deal.board, ...q.deal.hands[0]])).toBe(true)
      // Число считает человек: в вопросе его быть не должно.
      expect(q.prompt).not.toMatch(/\d/)
    }
  })

  it('правильный ответ — то, что насчитал перебор колоды', () => {
    for (let i = 0; i < 100; i++) {
      const q = makeOuts()
      if (q.mode !== 'outs') continue
      const analysis = analyseDraws(q.deal.hands[0], q.deal.board)!
      const kind = q.prompt.includes('флеш') ? 'flush' : 'straight'
      const outs = analysis.draws.find((d) => d.kind === kind)!.outs
      expect(q.options[q.correct]).toMatch(new RegExp(`^${outs} `))
    }
  })

  it('варианты ответа различны, их четыре, и все положительные', () => {
    for (let i = 0; i < 100; i++) {
      const q = makeOuts()
      if (q.mode !== 'outs') continue
      expect(q.options).toHaveLength(4)
      expect(unique(q.options)).toBe(true)
      const numbers = q.options.map((o) => Number.parseInt(o, 10))
      for (const n of numbers) expect(n).toBeGreaterThan(0)
      // По возрастанию: иначе правильный ответ выдаёт себя местом в списке.
      expect([...numbers].sort((a, b) => a - b)).toEqual(numbers)
    }
  })

  it('рука ещё не готова, иначе считать ауты не к чему', () => {
    for (let i = 0; i < 100; i++) {
      const q = makeOuts()
      if (q.mode !== 'outs') continue
      const analysis = analyseDraws(q.deal.hands[0], q.deal.board)!
      expect(analysis.current.category).toBeLessThan(STRAIGHT)
    }
  })

  it('объяснение называет ауты поимённо, а не только их число', () => {
    for (let i = 0; i < 40; i++) {
      const q = makeOuts()
      if (q.mode !== 'outs') continue
      const analysis = analyseDraws(q.deal.hands[0], q.deal.board)!
      const kind = q.prompt.includes('флеш') ? 'flush' : 'straight'
      const draw = analysis.draws.find((d) => d.kind === kind)!
      // Сколько карт названо, столько и аутов: список не сокращён и не раздут.
      const listed = q.explanation.split('\n')[0].match(/[♣♦♥♠]/g) ?? []
      expect(listed).toHaveLength(draw.outs)
    }
  })
})

describe('«До флопа»', () => {
  it('позиция названа словами и кодом, а вопрос обходится без жаргона', () => {
    for (let i = 0; i < 50; i++) {
      const q = makePreflop()
      expect(q.deal.position).toBeTruthy()
      // «CO» само по себе новичку ничего не говорит — нужна и расшифровка.
      expect(q.deal.position).toMatch(/\(/)
      expect(q.deal.hands[0]).toHaveLength(2)
      // «Соперник открылся» — как раз то, чего новичок не понимает.
      expect(q.prompt).not.toMatch(/открыл[со]/)
      expect(q.deal.opener).not.toMatch(/^открыл/)
    }
  })

  it('у каждого действия рядом с термином стоит перевод', () => {
    const q = makePreflop()
    for (const option of q.options) expect(option).toMatch(/ — /)
    expect(q.options.join(' ')).toContain('повысить')
  })
})

describe('метка для итога', () => {
  it('есть у каждого вопроса и не пустая', () => {
    for (const q of [makeShowdown(), makePreflop(), makeOuts()]) {
      expect(q.label.length).toBeGreaterThan(3)
    }
  })
})

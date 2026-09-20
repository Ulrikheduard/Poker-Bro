import { type Card, FULL_DECK } from '../../engine/cards'
import { evaluate, CATEGORY_TITLE, STRAIGHT } from '../../engine/evaluator'
import { analyseDraws } from '../../engine/draws'
import { ALL_HAND_CLASSES, cardPairs } from '../../engine/range'
import {
  OPEN_RAISE, FACING_OPEN, actionFor, ACTION_TITLE, POSITION_TITLE, POSITION_HINT,
} from '../../engine/charts'
import { potOdds, requiredEquity, exactOutsEquity, quickEquity } from '../../engine/odds'
import { percent, chips, outsWord } from '../format'

/**
 * Вопросы тренажёра. Вынесены из экрана, потому что проверяются сверками:
 * генератор обязан выдавать раздачу, у которой ответ считает движок, а не
 * автор вопроса. Раздаём из колоды честно и спрашиваем оценщик.
 */

export type Mode = 'showdown' | 'preflop' | 'odds'

export const MODES: Array<{ value: Mode; label: string; hint: string }> = [
  { value: 'showdown', label: 'Кто сильнее', hint: 'Две руки на одной доске. Какая из них выигрывает?' },
  { value: 'preflop', label: 'До флопа', hint: 'Ваша позиция, ситуация за столом и две карты. Что делать?' },
  { value: 'odds', label: 'Шанс', hint: 'Видите руку и доску. Хватает ли шансов, чтобы уравнять ставку?' },
]

/** Кадр раздачи: то, что человек видит на столе, без слов. */
export interface Deal {
  board: Card[]
  hands: Card[][]
  /** Подписи к рукам. Пусто — рука одна и она ваша, подпись не нужна. */
  handLabels: string[]
  /** Банк уже вместе со ставкой оппонента — та же договорённость, что в odds.ts. */
  pot?: number
  bet?: number
  /** Позиция героя, расшифрованная: «Катофф (CO)», а не «CO». */
  position?: string
  /** Кто открыл до нас. Отдельной строкой: склонять названия позиций нечем. */
  opener?: string
}

export interface Question {
  mode: Mode
  prompt: string
  detail?: string
  deal: Deal
  options: string[]
  correct: number
  explanation: string
  /** Короткая метка для экрана итога: по ней человек вспомнит раздачу. */
  label: string
  /**
   * Пять карт, которые на самом деле играют. Показываются после ответа:
   * остальные гаснут, и видно, из чего собралась комбинация.
   */
  playing?: Card[]
}

const shuffled = () => {
  const deck = [...FULL_DECK]
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
  return deck
}

const pick = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)]

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/**
 * Какие пять карт из семи реально играют. Оценщик возвращает силу руки одним
 * числом и не говорит, из чего она собралась, — поэтому перебираем, какие две
 * карты выбросить. Двадцать один вариант, считается мгновенно.
 */
export function bestFive(cards: Card[]): Card[] {
  if (cards.length <= 5) return [...cards]
  let best = -1
  let chosen = cards.slice(0, 5)
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      const five = cards.filter((_, k) => k !== i && k !== j)
      if (five.length !== 5) continue
      const value = evaluate(five).score
      if (value > best) {
        best = value
        chosen = five
      }
    }
  }
  return chosen
}

export function makeShowdown(): Question {
  const deck = shuffled()
  const board = deck.slice(0, 5)
  const a = deck.slice(5, 7)
  const b = deck.slice(7, 9)
  const va = evaluate([...a, ...board])
  const vb = evaluate([...b, ...board])
  const correct = va.score > vb.score ? 0 : vb.score > va.score ? 1 : 2

  // Победившая комбинация — та, которую стоит показать. При ничьей играют
  // одни и те же пять карт с доски, поэтому берём любую из рук.
  const winner = correct === 1 ? b : a
  const winnerValue = correct === 1 ? vb : va

  const loserValue = correct === 1 ? va : vb
  const sameCategory = va.category === vb.category

  // Название комбинации берём без кикеров: «Флеш выше, чем стрит» учит порядку
  // рук, а «Флеш до валета выше, чем стрит до десятки» — только этой раздаче.
  const explanation = correct === 2
    ? `Ничья: обе руки собирают ${va.title.toLowerCase()}.\n`
      + 'Банк делится поровну — карты в руках ничего не добавляют к доске.'
    : `Первая рука: ${va.title}.\nВторая рука: ${vb.title}.\n`
      + (sameCategory
        // Комбинация одна и та же — решает старшинство внутри неё, и это
        // ровно тот случай, где новичок ошибается чаще всего.
        ? `Комбинация одна и та же — решает старшинство карт.`
        : `${CATEGORY_TITLE[winnerValue.category]} выше, чем ${CATEGORY_TITLE[loserValue.category].toLowerCase()}.`)

  return {
    mode: 'showdown',
    prompt: 'Кто выигрывает?',
    deal: { board, hands: [a, b], handLabels: ['Первая рука', 'Вторая рука'] },
    options: ['Первая рука', 'Вторая рука', 'Ничья'],
    correct,
    explanation,
    // Обе комбинации в именительном: склонять их нечем, а «бьёт старшую карту —
    // туз» спотыкается на собственном тире внутри названия. Когда комбинация
    // одна и та же, «Пара и пара» ничего не говорит — а случай как раз
    // поучительный, поэтому он назван отдельно.
    label: correct === 2
      ? `Ничья: ${CATEGORY_TITLE[va.category].toLowerCase()}`
      : sameCategory
        ? `Обе руки — ${CATEGORY_TITLE[va.category].toLowerCase()}, решало старшинство`
        : `${CATEGORY_TITLE[va.category]} и ${CATEGORY_TITLE[vb.category].toLowerCase()}`,
    playing: bestFive([...winner, ...board]),
  }
}

export function makePreflop(): Question {
  const spot = pick([...OPEN_RAISE, ...FACING_OPEN])
  const hand = pick(ALL_HAND_CLASSES)
  const action = actionFor(spot, hand.notation)
  const [c1, c2] = pick(cardPairs(hand))
  const options: Array<'raise' | 'call' | 'fold'> = ['raise', 'call', 'fold']
  return {
    mode: 'preflop',
    prompt: spot.versus ? 'Соперник открыл. Что делаете?' : 'До вас все сбросили. Что делаете?',
    detail: POSITION_HINT[spot.hero],
    deal: {
      board: [],
      hands: [[c1, c2]],
      handLabels: [],
      position: POSITION_TITLE[spot.hero],
      opener: spot.versus ? POSITION_TITLE[spot.versus] : undefined,
    },
    options: options.map((a) => ACTION_TITLE[a]),
    correct: options.indexOf(action),
    explanation: `${hand.notation} — ${ACTION_TITLE[action].toLowerCase()}.\n\n${spot.note}`,
    label: `${hand.notation} — ${POSITION_TITLE[spot.hero]}`,
  }
}

const POTS = [60, 80, 100, 120, 150, 200]
const BET_FRACTIONS = [0.33, 0.5, 0.66, 0.75, 1]

/** Дро, ради которых и задаётся вопрос: они доезжают до стрита и выше. */
const CHASED = new Set(['flush', 'straightFlush', 'straight'])

/**
 * «Шанс». Число аутов больше не выдаётся в условии — их считает человек,
 * а сверяет `analyseDraws`, перебирая колоду. Размер ставки подбирается так,
 * чтобы порог оказался рядом с эквити: иначе почти все вопросы решаются
 * не счётом, а на глаз.
 */
export function makeOdds(): Question {
  for (let attempt = 0; attempt < 400; attempt++) {
    const deck = shuffled()
    const toCome = Math.random() < 0.5 ? 2 : 1
    const hole = deck.slice(0, 2)
    const board = deck.slice(2, 2 + (toCome === 2 ? 3 : 4))

    const analysis = analyseDraws(hole, board)
    if (!analysis) continue
    // Готовая рука — это уже не вопрос о шансах доехать.
    if (analysis.current.category >= STRAIGHT) continue
    if (!analysis.draws.some((d) => CHASED.has(d.kind))) continue

    const outs = analysis.strongOuts
    if (outs < 4) continue

    const equity = exactOutsEquity(outs, analysis.unseen, toCome)
    const pot = pick(POTS)
    const candidates = BET_FRACTIONS
      .map((f) => Math.round(pot * f))
      .map((bet) => ({ bet, need: requiredEquity(potOdds(pot + bet, bet)) }))
      // Слишком очевидные и совсем пограничные вопросы одинаково бесполезны:
      // в первых не надо считать, во вторых решает округление.
      .filter(({ need }) => {
        const gap = Math.abs(equity - need)
        return gap >= 0.02 && gap <= 0.12
      })
    if (candidates.length === 0) continue

    const { bet, need } = pick(candidates)
    const pairing = analysis.boardPairing > 0
      ? `\nКарты, спаривающие доску, в ауты не идут: такую пару получит и оппонент.`
      : ''

    return {
      mode: 'odds',
      prompt: 'Хватает ли шансов на колл?',
      detail: 'Считаем только прямые шансы — будущие ставки не учитываем.',
      deal: { board, hands: [hole], handLabels: [], pot: pot + bet, bet },
      options: ['Колл', 'Фолд'],
      correct: equity >= need ? 0 : 1,
      explanation:
        `Нужно ${percent(need)} — платите ${chips(bet)}, чтобы выиграть ${chips(pot + bet)}.\n`
        + `У вас ${analysis.summary}: ${outs} ${outsWord(outs)} из ${analysis.unseen}, `
        + `${toCome === 2 ? 'две карты' : 'одна карта'} впереди — это ${percent(equity)}.\n`
        + `По правилу ${toCome === 2 ? '4' : '2'} в уме вышло бы ${percent(quickEquity(outs, toCome), 0)}.`
        + pairing,
      label: `${capitalise(analysis.summary)} — ${equity >= need ? 'колл' : 'фолд'}`,
      playing: [...hole, ...board],
    }
  }

  // Колода такая, что подходящей раздачи не нашлось за 400 попыток —
  // практически невозможно, но вопрос всё равно должен быть.
  return makeShowdown()
}

export function makeQuestion(mode: Mode): Question {
  return mode === 'showdown' ? makeShowdown() : mode === 'preflop' ? makePreflop() : makeOdds()
}

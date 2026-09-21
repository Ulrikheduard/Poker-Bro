import {
  type Card, FULL_DECK, RANK_SPOKEN, RANK_GENITIVE, RANK_MANY_GENITIVE, cardLabel, cardSymbol,
} from '../../engine/cards'
import { type HandValue, evaluate, CATEGORY_TITLE, STRAIGHT, TWO_PAIR } from '../../engine/evaluator'
import { type DrawKind, analyseDraws } from '../../engine/draws'
import { type HandClass, ALL_HAND_CLASSES, cardPairs, isPair } from '../../engine/range'
import {
  OPEN_RAISE, FACING_OPEN, actionFor, ACTION_TITLE, ACTION_PLAIN, POSITION_ON, POSITION_HINT,
} from '../../engine/charts'
import { exactOutsEquity, quickEquity } from '../../engine/odds'
import { percent, plural, outsWord } from '../format'

/**
 * Вопросы тренажёра. Вынесены из экрана, потому что проверяются сверками:
 * генератор обязан выдавать раздачу, у которой ответ считает движок, а не
 * автор вопроса. Раздаём из колоды честно и спрашиваем оценщик.
 */

export type Mode = 'showdown' | 'preflop' | 'outs'

export const MODES: Array<{ value: Mode; label: string; hint: string }> = [
  {
    value: 'showdown',
    label: 'Кто сильнее',
    hint: 'Две руки на одной доске. Посмотрите, какая из них выигрывает.',
  },
  {
    value: 'preflop',
    label: 'До флопа',
    hint: 'Вам раздали две карты, общих карт ещё нет. Решите, что делать: повысить, уравнять или сбросить.',
  },
  {
    value: 'outs',
    label: 'Ауты',
    hint: 'Руки пока нет, но она может собраться. Посчитайте, сколько карт её достроит.',
  },
]

/**
 * Уровень сложности. Раздача всё так же раздаётся из честной колоды — уровень
 * не подкручивает карты, а отбирает, какие раздачи показывать: на лёгком
 * комбинации далеки друг от друга, на сложном они одинаковые и спор решают
 * старшинство и кикер.
 *
 * Уровень есть только у «Кто сильнее»: там разница в трудности задаётся самой
 * раздачей. В двух других режимах трудность задают карты, и делить их
 * на ступени было бы притворством.
 */
export type Level = 'easy' | 'normal' | 'hard'

export const LEVELS: Array<{ value: Level; label: string; hint: string }> = [
  {
    value: 'easy',
    label: 'Просто',
    hint: 'Комбинации сильно разные — достаточно помнить порядок старшинства.',
  },
  {
    value: 'normal',
    label: 'Средне',
    hint: 'Комбинации соседние: что выше — стрит или флеш, тройка или две пары.',
  },
  {
    value: 'hard',
    label: 'Сложно',
    hint: 'Комбинация у обоих одна и та же. Решают старшинство, кикер — или банк делится.',
  },
]

export const LEVEL_LABEL: Record<Level, string> = {
  easy: 'Просто', normal: 'Средне', hard: 'Сложно',
}

/** Следующая ступень вверх. `null` — выше некуда. */
export const harderLevel = (level: Level): Level | null =>
  level === 'easy' ? 'normal' : level === 'normal' ? 'hard' : null

/** Кадр раздачи: то, что человек видит на столе, без слов. */
export interface Deal {
  board: Card[]
  hands: Card[][]
  /** Подписи к рукам. Пусто — рука одна и она ваша, подпись не нужна. */
  handLabels: string[]
  /** Где вы сидите, целой фразой: склонять название позиции нечем. */
  position?: string
  /** Что случилось до вас — тоже фразой, по той же причине. */
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

/** «A♠» — то, как карта подписана на самой карте, без разнобоя в обозначениях. */
const cardText = (card: Card) => cardLabel(card) + cardSymbol(card)

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

/**
 * Что решило спор двух одинаковых комбинаций. Оценщик хранит разрешение
 * в `ranks`: первое расхождение и есть та карта, на которой руки разошлись.
 * Без этой строки сложный уровень превращается в угадайку — видно, что
 * «пара и пара», и непонятно, почему одна из них выиграла.
 */
function tieBreak(win: HandValue, lose: HandValue): string {
  const index = win.ranks.findIndex((rank, i) => rank !== lose.ranks[i])
  if (index < 0) return ''
  // «Против» требует родительного: «туз против четвёрки», а не «четвёрка».
  const pair = `${RANK_SPOKEN[win.ranks[index]]} против ${RANK_GENITIVE[lose.ranks[index]] ?? '—'}`
  if (index === 0) return `Комбинация у обоих одна и та же — решило старшинство: ${pair}.`
  if (win.category === TWO_PAIR && index === 1) {
    return `Старшая пара одинаковая — спор решила вторая: ${pair}.`
  }
  return `Комбинация одна и та же, старшие карты тоже — решил кикер: ${pair}.`
}

/** Подходит ли пара рук выбранному уровню. */
function fitsLevel(a: HandValue, b: HandValue, level: Level): boolean {
  const gap = Math.abs(a.category - b.category)
  if (level === 'easy') return gap >= 2
  if (level === 'normal') return gap === 1
  return gap === 0
}

export function makeShowdown(level: Level = 'normal'): Question {
  // Карты раздаются из честной колоды, а уровень только отбирает раздачи.
  // Подходящая находится за считаные попытки: на сложном уровне совпадение
  // категорий — обычное дело, на лёгком большой разрыв тоже не редкость.
  let deck = shuffled()
  let board = deck.slice(0, 5)
  let a = deck.slice(5, 7)
  let b = deck.slice(7, 9)
  let va = evaluate([...a, ...board])
  let vb = evaluate([...b, ...board])
  for (let attempt = 0; attempt < 600 && !fitsLevel(va, vb, level); attempt++) {
    deck = shuffled()
    board = deck.slice(0, 5)
    a = deck.slice(5, 7)
    b = deck.slice(7, 9)
    va = evaluate([...a, ...board])
    vb = evaluate([...b, ...board])
  }

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
        ? tieBreak(winnerValue, loserValue)
        : `${CATEGORY_TITLE[winnerValue.category]} выше, чем ${CATEGORY_TITLE[loserValue.category].toLowerCase()}.`)

  return {
    mode: 'showdown',
    prompt: 'Чья рука сильнее?',
    deal: { board, hands: [a, b], handLabels: ['Первая рука', 'Вторая рука'] },
    options: ['Первая рука', 'Вторая рука', 'Ничья, банк пополам'],
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

/** «Пара семёрок», «Одномастные туз и король» — запись AKs словами. */
function handPlain(hand: HandClass): string {
  if (isPair(hand)) return `Пара ${RANK_MANY_GENITIVE[hand.high]}`
  const high = RANK_SPOKEN[hand.high]
  const low = RANK_SPOKEN[hand.low]
  return `${hand.suited ? 'Одномастные' : 'Разномастные'} ${high} и ${low}`
}

export function makePreflop(): Question {
  const spot = pick([...OPEN_RAISE, ...FACING_OPEN])
  const hand = pick(ALL_HAND_CLASSES)
  const action = actionFor(spot, hand.notation)
  const [c1, c2] = pick(cardPairs(hand))
  const options: Array<'raise' | 'call' | 'fold'> = ['raise', 'call', 'fold']
  return {
    mode: 'preflop',
    // «Соперник открылся» за столом понимают все, но человек, который учится
    // по этому экрану, слышит такое слово впервые. Говорим, что именно
    // произошло: кто-то поставил больше блайнда, и теперь ход ваш.
    prompt: spot.versus
      ? 'Игрок до вас повысил ставку. Что делаете?'
      : 'Все до вас сбросили карты. Что делаете?',
    detail: POSITION_HINT[spot.hero],
    deal: {
      board: [],
      hands: [[c1, c2]],
      handLabels: [],
      position: `Вы ${POSITION_ON[spot.hero]}`,
      opener: spot.versus ? `Ставку повысил игрок ${POSITION_ON[spot.versus]}` : 'До вас все сбросили карты',
    },
    // Термин и перевод рядом: за столом говорят «рейз», но нажимать на кнопку
    // придётся раньше, чем человек дойдёт до словаря.
    options: options.map((a) => `${ACTION_TITLE[a]} — ${ACTION_PLAIN[a]}`),
    correct: options.indexOf(action),
    explanation:
      `${handPlain(hand)} — в покерной записи ${hand.notation}.\n`
      + `Правильный ход: ${ACTION_TITLE[action].toLowerCase()}, то есть ${ACTION_PLAIN[action]}.\n\n`
      + spot.note,
    label: `${hand.notation}, вы ${POSITION_ON[spot.hero]}`,
  }
}

/**
 * Комбинации, ради которых и считают ауты. Пара и две пары сюда не входят:
 * их «ауты» слишком часто оказываются картой, которая помогает и оппоненту,
 * а вопрос должен иметь один честный ответ.
 */
const OUTS_TARGETS: Array<{ kind: DrawKind; question: string; short: string }> = [
  { kind: 'flush', question: 'флеш', short: 'Флеш' },
  { kind: 'straight', question: 'стрит', short: 'Стрит' },
]

/**
 * «Ауты». Человек считает сам: сколько карт в колоде достроит руку
 * до названной комбинации. Ответ сверяет `analyseDraws`, перебирая колоду
 * карта за картой, — поэтому «флеш-дро = 9» здесь не подсказка: если две
 * карты масти уже на доске, аутов будет восемь, и заученное число соврёт.
 */
export function makeOuts(): Question {
  for (let attempt = 0; attempt < 400; attempt++) {
    const deck = shuffled()
    const toCome = Math.random() < 0.5 ? 2 : 1
    const hole = deck.slice(0, 2)
    const board = deck.slice(2, 2 + (toCome === 2 ? 3 : 4))

    const analysis = analyseDraws(hole, board)
    if (!analysis) continue
    // Готовая рука — это уже не вопрос о том, чем она может достроиться.
    if (analysis.current.category >= STRAIGHT) continue

    const available = OUTS_TARGETS
      .map((t) => ({ target: t, draw: analysis.draws.find((d) => d.kind === t.kind) }))
      .filter((x) => x.draw != null && x.draw.outs >= 3)
    if (available.length === 0) continue

    const { target, draw } = pick(available)
    const outs = draw!.outs
    const cards = [...draw!.cards].sort((x, y) => y - x)
    const equity = exactOutsEquity(outs, analysis.unseen, toCome)

    // Варианты ответа — вокруг правильного, плюс то число, которое человек
    // назовёт по заученной таблице. Ошибиться должно быть можно именно так,
    // как ошибаются на самом деле, а не наугад.
    const bait = target.kind === 'flush' ? 9 : 8
    const candidates = [outs - 2, outs - 1, outs + 1, outs + 2, outs + 3, bait, bait - 4]
      .filter((n) => n > 0 && n !== outs && n <= analysis.unseen)
    const options = new Set<number>([outs])
    while (options.size < 4 && candidates.length > 0) {
      options.add(candidates.splice(Math.floor(Math.random() * candidates.length), 1)[0])
    }
    // Колода не дала четырёх разумных вариантов — добираем соседними числами.
    for (let n = outs + 4; options.size < 4; n++) options.add(n)

    const sorted = [...options].sort((x, y) => x - y)

    return {
      mode: 'outs',
      prompt: `Сколько карт даёт вам ${target.question}?`,
      detail: 'Считайте карты, которых вы ещё не видели: и в колоде, и у соперников.',
      deal: { board, hands: [hole], handLabels: [] },
      options: sorted.map((n) => `${n} ${plural(n, ['карта', 'карты', 'карт'])}`),
      correct: sorted.indexOf(outs),
      explanation:
        `${target.short} закрывают ${outs} ${outsWord(outs)}: ${cards.map(cardText).join(', ')}.\n`
        + `Невидимых карт ${analysis.unseen}, впереди `
        + `${toCome === 2 ? 'две карты' : 'одна карта'} — это ${percent(equity)}.\n`
        + `По правилу 2 и 4 в уме: ${outs} × ${toCome === 2 ? 4 : 2} ≈ ${percent(quickEquity(outs, toCome), 0)}.`,
      label: `${target.short}: ${outs} ${outsWord(outs)}`,
      playing: [...hole, ...board],
    }
  }

  // Колода такая, что подходящей раздачи не нашлось за 400 попыток —
  // практически невозможно, но вопрос всё равно должен быть.
  return makeShowdown()
}

export function makeQuestion(mode: Mode, level: Level = 'normal'): Question {
  return mode === 'showdown' ? makeShowdown(level) : mode === 'preflop' ? makePreflop() : makeOuts()
}

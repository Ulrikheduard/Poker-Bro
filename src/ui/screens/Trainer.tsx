import { useCallback, useEffect, useState } from 'react'
import { type Card, FULL_DECK } from '../../engine/cards'
import { evaluate } from '../../engine/evaluator'
import { ALL_HAND_CLASSES, cardPairs } from '../../engine/range'
import { OPEN_RAISE, FACING_OPEN, actionFor, ACTION_TITLE, POSITION_HINT } from '../../engine/charts'
import { potOdds, requiredEquity, exactOutsEquity, quickEquity } from '../../engine/odds'
import { Panel, Tile, Segmented } from '../components/kit'
import { PlayingCard } from '../components/PlayingCard'
import { Linked } from '../components/Term'
import { Haptics } from '../haptics'
import { percent, chips, outsWord } from '../format'

/**
 * Тренажёр. Смысл не в очках, а в том, что ответ проверяет тот же движок,
 * который считает раздачи: «какая рука сильнее» решает оценщик, а не автор
 * вопроса, поэтому задания генерируются бесконечно и не устаревают.
 */

type Mode = 'showdown' | 'preflop' | 'odds'

const MODES: Array<{ value: Mode; label: string; hint: string }> = [
  { value: 'showdown', label: 'Кто сильнее', hint: 'Две руки на одной доске. Какая из них выигрывает?' },
  { value: 'preflop', label: 'До флопа', hint: 'Ваша позиция, ситуация за столом и две карты. Что делать?' },
  { value: 'odds', label: 'Считать', hint: 'Выгодно ли уравнять ставку? Сравните шансы банка со своими шансами попасть.' },
]

interface Question {
  prompt: string
  detail?: string
  board: Card[]
  hands: Card[][]
  options: string[]
  correct: number
  explanation: string
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

// Раздаём честно из колоды и спрашиваем оценщик — заранее заготовленных
// «правильных ответов» здесь нет вовсе.
function makeShowdown(): Question {
  const deck = shuffled()
  const board = deck.slice(0, 5)
  const a = deck.slice(5, 7)
  const b = deck.slice(7, 9)
  const va = evaluate([...a, ...board])
  const vb = evaluate([...b, ...board])
  const correct = va.score > vb.score ? 0 : vb.score > va.score ? 1 : 2
  return {
    prompt: 'Кто выигрывает?',
    board, hands: [a, b],
    options: ['Первая рука', 'Вторая рука', 'Ничья'],
    correct,
    explanation: `Первая: ${va.title}.\nВторая: ${vb.title}.`,
  }
}

function makePreflop(): Question {
  const spot = pick([...OPEN_RAISE, ...FACING_OPEN])
  const hand = pick(ALL_HAND_CLASSES)
  const action = actionFor(spot, hand.notation)
  const [c1, c2] = pick(cardPairs(hand))
  const options: Array<'raise' | 'call' | 'fold'> = ['raise', 'call', 'fold']
  return {
    prompt: spot.title,
    detail: POSITION_HINT[spot.hero],
    board: [],
    hands: [[c1, c2]],
    options: options.map((a) => ACTION_TITLE[a]),
    correct: options.indexOf(action),
    explanation: `${hand.notation} — ${ACTION_TITLE[action].toLowerCase()}.\n\n${spot.note}`,
  }
}

function makeOdds(): Question {
  const pot = pick([60, 80, 100, 120, 150, 200])
  const bet = Math.round(pot * pick([0.33, 0.5, 0.66, 0.75, 1]))
  const odds = potOdds(pot + bet, bet)
  const outs = pick([4, 8, 9, 12, 15])
  const toCome = Math.random() < 0.5 ? 2 : 1
  const unseen = toCome === 2 ? 47 : 46
  const equity = exactOutsEquity(outs, unseen, toCome)
  const need = requiredEquity(odds)
  return {
    prompt: `Банк ${chips(pot)}, оппонент ставит ${chips(bet)}. У вас ${outs} ${outsWord(outs)}, `
      + `${toCome === 2 ? 'две карты' : 'одна карта'} впереди.`,
    detail: 'Считаем только прямые шансы — будущие ставки не учитываем.',
    board: [], hands: [],
    options: ['Колл', 'Фолд'],
    correct: equity >= need ? 0 : 1,
    explanation:
      `Нужно ${percent(need)} — платите ${chips(bet)}, чтобы выиграть ${chips(pot + bet)}.\n`
      + `У вас ${percent(equity)}: ${outs} ${outsWord(outs)} из ${unseen}.\n`
      + `По правилу ${toCome === 2 ? '4' : '2'} в уме вышло бы ${percent(quickEquity(outs, toCome), 0)}.`,
  }
}

export function Trainer() {
  const [mode, setMode] = useState<Mode>('showdown')
  const [question, setQuestion] = useState<Question>(makeShowdown)
  const [answered, setAnswered] = useState<number | null>(null)
  const [correct, setCorrect] = useState(0)
  const [total, setTotal] = useState(0)
  const [streak, setStreak] = useState(0)

  const next = useCallback((m: Mode) => {
    setAnswered(null)
    setQuestion(m === 'showdown' ? makeShowdown() : m === 'preflop' ? makePreflop() : makeOdds())
  }, [])

  useEffect(() => { next(mode) }, [mode, next])

  const answer = (index: number) => {
    if (answered !== null) return
    setAnswered(index)
    setTotal((t) => t + 1)
    const ok = index === question.correct
    Haptics.result(ok)
    if (ok) { setCorrect((c) => c + 1); setStreak((s) => s + 1) } else setStreak(0)
  }

  const hint = MODES.find((m) => m.value === mode)!.hint

  return (
    <>
      <Panel>
        <Segmented options={MODES.map((m) => ({ value: m.value, label: m.label }))}
          value={mode} onChange={setMode} />
        <span style={{ fontSize: 'var(--f-s)', color: 'var(--muted)' }}>{hint}</span>
        <div className="tiles">
          <Tile label="Верно" value={`${correct} из ${total}`}
            caption={total > 0 ? percent(correct / total, 0) : 'начните отвечать'} />
          <Tile label="Подряд" value={String(streak)}
            tint={streak >= 3 ? 'var(--good)' : undefined}
            caption={streak >= 5 ? 'отличная серия' : 'без ошибок'} />
        </div>
      </Panel>

      <Panel>
        <b style={{ fontSize: 'var(--f-title)' }}>{question.prompt}</b>
        {question.detail && <span className="hint"><Linked>{question.detail}</Linked></span>}
        {question.board.length > 0 && (
          <div className="field">
            <span className="label">Стол</span>
            <div className="cards-row">
              {question.board.map((c) => <PlayingCard key={c} card={c} width={40} />)}
            </div>
          </div>
        )}
        {question.hands.map((hand, i) => (
          <div className="field" key={i}>
            <span className="label">
              {question.hands.length > 1 ? (i === 0 ? 'Первая рука' : 'Вторая рука') : 'Ваша рука'}
            </span>
            <div className="cards-row">
              {hand.map((c) => <PlayingCard key={c} card={c} width={48} />)}
            </div>
          </div>
        ))}
      </Panel>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s)' }}>
        {question.options.map((option, index) => {
          const state = answered === null ? 'idle'
            : index === question.correct ? 'correct'
            : index === answered ? 'wrong' : 'muted'
          return (
            <button key={index} type="button" className="option press" data-state={state}
              disabled={answered !== null} onClick={() => answer(index)}>
              {option}
              {answered !== null && index === question.correct && <span>✓</span>}
              {answered !== null && index === answered && index !== question.correct && <span>✕</span>}
            </button>
          )
        })}
      </div>

      {answered !== null && (
        <Panel className="appear">
          <b style={{ fontSize: 'var(--f-large)', color: answered === question.correct ? 'var(--good)' : 'var(--bad)' }}>
            {answered === question.correct ? 'Верно' : 'Не угадали'}
          </b>
          <span style={{ fontSize: 'var(--f-s)', color: 'var(--muted)', whiteSpace: 'pre-line' }}>
            <Linked>{question.explanation}</Linked>
          </span>
          <button type="button" className="primary press"
            onClick={() => { Haptics.tap(); next(mode) }}>Дальше</button>
        </Panel>
      )}
    </>
  )
}

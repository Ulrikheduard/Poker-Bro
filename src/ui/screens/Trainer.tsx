import { useCallback, useEffect, useRef, useState } from 'react'
import { type Card } from '../../engine/cards'
import { Segmented } from '../components/kit'
import { PlayingCard } from '../components/PlayingCard'
import { Linked } from '../components/Term'
import { Haptics } from '../haptics'
import { chips } from '../format'
import { type Deal, type Mode, type Question, MODES, makeQuestion } from './trainer.questions'

/**
 * Тренажёр. Смысл не в очках, а в том, что ответ проверяет тот же движок,
 * который считает раздачи, — поэтому задания генерируются бесконечно
 * и не устаревают.
 *
 * Экран собран под один заход одной рукой: кадр раздачи сверху, ответы внизу,
 * и то и другое помещается без прокрутки. Всё, что не помогает ответить,
 * с экрана убрано.
 */

const SESSION_LENGTH = 10
const STORE_KEY = 'pokerbro.trainer.v1'

interface Result { ok: boolean; label: string }

interface Saved {
  mode: Mode
  results: Result[]
  streak: number
  best: number
}

const EMPTY: Saved = { mode: 'showdown', results: [], streak: 0, best: 0 }

/**
 * Хранилище своё у каждого устройства и никуда не уходит. Доступ обёрнут:
 * в приватном окне обращение к localStorage бросает исключение, и тренажёр
 * из-за этого падать не должен.
 */
function load(): Saved {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return EMPTY
    const parsed = JSON.parse(raw) as Partial<Saved>
    const mode = MODES.some((m) => m.value === parsed.mode) ? parsed.mode! : EMPTY.mode
    const results = Array.isArray(parsed.results)
      ? parsed.results.filter((r): r is Result => typeof r?.ok === 'boolean').slice(0, SESSION_LENGTH)
      : []
    return {
      mode,
      results,
      streak: Number.isFinite(parsed.streak) ? Math.max(0, parsed.streak!) : 0,
      best: Number.isFinite(parsed.best) ? Math.max(0, parsed.best!) : 0,
    }
  } catch {
    return EMPTY
  }
}

function save(state: Saved) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state))
  } catch {
    // Память недоступна — сессия проживёт до перезагрузки, и это не повод падать.
  }
}

/** Размеры карт подобраны под 375 пунктов: пять карт борда влезают в ряд. */
const SIZES: Record<Mode, { board: number; hand: number }> = {
  showdown: { board: 52, hand: 60 },
  odds: { board: 56, hand: 72 },
  preflop: { board: 0, hand: 84 },
}

/**
 * Кадр раздачи. Борд и рука разведены расстоянием и размером, а не подписями:
 * ваши карты крупнее, потому что они ваши. После ответа карты, которые
 * не вошли в комбинацию, гаснут — видно, из чего она собралась.
 */
function Scene({ deal, mode, playing, reveal }: {
  deal: Deal
  mode: Mode
  playing?: Card[]
  reveal: boolean
}) {
  const size = SIZES[mode]
  const off = (card: Card) => reveal && playing != null && !playing.includes(card)
  const pair = deal.hands.length > 1

  return (
    <div className="deal">
      {(deal.position || deal.pot != null) && (
        <div className="deal-meta">
          {deal.position && <span className="deal-pos">{deal.position}</span>}
          {deal.opener && <span className="deal-money">открыл: {deal.opener}</span>}
          {deal.pot != null && deal.bet != null && (
            <span className="deal-money">
              в банке <b className="num">{chips(deal.pot)}</b>, ставка <b className="num">{chips(deal.bet)}</b>
            </span>
          )}
        </div>
      )}

      {deal.board.length > 0 && (
        <div className="deal-board">
          {deal.board.map((card) => (
            <span key={card} className={off(card) ? 'off' : undefined}>
              <PlayingCard card={card} width={size.board} />
            </span>
          ))}
        </div>
      )}

      {/* Две руки сравнивают, поэтому они стоят рядом, а не друг под другом. */}
      <div className={'deal-hands' + (pair ? ' pair' : '')}>
        {deal.hands.map((hand, i) => (
          <div className="deal-hand" key={i}>
            <div className="deal-cards">
              {hand.map((card) => (
                <span key={card} className={off(card) ? 'off' : undefined}>
                  <PlayingCard card={card} width={size.hand} />
                </span>
              ))}
            </div>
            {deal.handLabels[i] && <span className="deal-label">{deal.handLabels[i]}</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

function Summary({ results, best, onAgain }: {
  results: Result[]
  best: number
  onAgain: () => void
}) {
  const right = results.filter((r) => r.ok).length
  const missed = results.filter((r) => !r.ok)

  return (
    <div className="summary appear">
      <div className="summary-head">
        <b>{right} из {results.length}</b>
        <div className="summary-marks" aria-hidden="true">
          {results.map((r, i) => <i key={i} className={r.ok ? 'ok' : 'no'} />)}
        </div>
      </div>

      {missed.length === 0 ? (
        <p className="summary-note">Все десять верно. Такое бывает редко — попробуйте режим потруднее.</p>
      ) : (
        <div className="summary-missed">
          <span className="summary-caption">
            {missed.length === 1 ? 'Одна ошибка' : `Ошибок: ${missed.length}`}
          </span>
          <ul>{missed.map((r, i) => <li key={i}>{r.label}</li>)}</ul>
        </div>
      )}

      {best >= 3 && <p className="summary-note">Лучшая серия без ошибок: {best}.</p>}

      <button type="button" className="primary press" onClick={onAgain}>Ещё десять</button>
    </div>
  )
}

export function Trainer() {
  // Состояние читается один раз при монтировании. Две вкладки на одном
  // устройстве пишут в один ключ: побеждает та, где ответили последней,
  // и это лучше, чем пытаться сливать две сессии в одну.
  const [saved, setSaved] = useState<Saved>(load)
  const [question, setQuestion] = useState<Question>(() => makeQuestion(load().mode))
  const [answered, setAnswered] = useState<number | null>(null)

  const { mode, results, streak, best } = saved
  const done = results.length >= SESSION_LENGTH

  // Первый вопрос уже создан в useState, поэтому при монтировании не пересоздаём:
  // иначе раздача сменилась бы у человека на глазах.
  const mounted = useRef(false)
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return }
    setAnswered(null)
    setQuestion(makeQuestion(mode))
  }, [mode])

  const update = useCallback((next: Saved) => {
    setSaved(next)
    save(next)
  }, [])

  const answer = (index: number) => {
    if (answered !== null || done) return
    setAnswered(index)
    const ok = index === question.correct
    Haptics.result(ok)
    const nextStreak = ok ? streak + 1 : 0
    update({
      mode,
      results: [...results, { ok, label: question.label }],
      streak: nextStreak,
      best: Math.max(best, nextStreak),
    })
  }

  const next = () => {
    Haptics.tap()
    setAnswered(null)
    setQuestion(makeQuestion(mode))
  }

  const again = () => {
    Haptics.tap()
    setAnswered(null)
    update({ mode, results: [], streak, best })
    setQuestion(makeQuestion(mode))
  }

  const changeMode = (value: Mode) => {
    // Смена режима — это новая тренировка, счёт прошлой к ней не относится.
    update({ mode: value, results: [], streak: 0, best })
  }

  const ok = answered === question.correct
  const hint = MODES.find((m) => m.value === mode)!.hint
  // Подсказка нужна, пока человек не начал: дальше она только занимает высоту.
  const showHint = !done && results.length === 0 && answered === null

  return (
    <div className="trainer">
      <div className="trainer-top">
        <Segmented options={MODES.map((m) => ({ value: m.value, label: m.label }))}
          value={mode} onChange={changeMode} />
        <div className="session">
          <span>{results.length} из {SESSION_LENGTH}</span>
          {streak >= 2 && <span className="session-streak">подряд {streak}</span>}
        </div>
        {showHint && <p className="session-hint">{hint}</p>}
      </div>

      {done ? (
        <Summary results={results} best={best} onAgain={again} />
      ) : (
        <>
          <div className="trainer-body">
            <Scene deal={question.deal} mode={mode} playing={question.playing} reveal={answered !== null} />
          </div>

          <div className="trainer-dock">
            {answered === null ? (
              <>
                <p className="ask">{question.prompt}</p>
                {question.detail && <p className="ask-detail"><Linked>{question.detail}</Linked></p>}
                <div className="options">
                  {question.options.map((option, index) => (
                    <button key={index} type="button" className="option press" onClick={() => answer(index)}>
                      {option}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="verdict appear">
                <b className={ok ? 'good' : 'bad'}>
                  {ok ? 'Верно' : `Не угадали — ${question.options[question.correct].toLowerCase()}`}
                </b>
                <span className="verdict-text"><Linked>{question.explanation}</Linked></span>
                <button type="button" className="primary press" onClick={next}>
                  {results.length >= SESSION_LENGTH ? 'Итог' : 'Дальше'}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

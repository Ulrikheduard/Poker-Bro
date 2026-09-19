import { useEffect, useMemo, useRef, useState } from 'react'
import { type Card, FULL_DECK } from '../../engine/cards'
import { type SpotAnalysis, ACTION_TITLE, STREET_TITLE, streetFor } from '../../engine/advice'
import { topPercentRange } from '../../engine/notation'
import { readBoard } from '../../engine/texture'
import { DRAW_TITLE } from '../../engine/draws'
import {
  requiredEquity, oddsRatio, callEV, frequencies, minimumDefence, exactOutsEquity,
} from '../../engine/odds'
import { EquityClient } from '../../worker/client'
import { Panel, Tile, Row, Chip, Segmented, Note, EquityBar } from '../components/kit'
import { CardSlot, CardPicker } from '../components/PlayingCard'
import { Haptics } from '../haptics'
import { percent, decimal, chips, outsWord } from '../format'

const VILLAINS = [
  { value: 0, label: 'Любая' },
  { value: 40, label: 'Топ 40 %' },
  { value: 20, label: 'Топ 20 %' },
  { value: 10, label: 'Топ 10 %' },
]

const ACTION_COLOR: Record<string, string> = {
  fold: 'var(--bad)', check: 'var(--muted)', call: 'var(--info)',
  bet: 'var(--good)', raise: 'var(--good)', allIn: 'var(--good)',
}

const client = new EquityClient()

type Target = { kind: 'hole' | 'board'; index: number }

export function Solver() {
  const [hole, setHole] = useState<Array<Card | null>>([null, null])
  const [board, setBoard] = useState<Array<Card | null>>([null, null, null, null, null])
  const [pot, setPot] = useState(100)
  const [toCall, setToCall] = useState(0)
  const [stack, setStack] = useState(900)
  const [opponents, setOpponents] = useState(1)
  const [villain, setVillain] = useState(0)
  const [picking, setPicking] = useState<Target | null>(null)

  const [analysis, setAnalysis] = useState<SpotAnalysis | null>(null)
  const [working, setWorking] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const lastAction = useRef<string | null>(null)

  const holeCards = useMemo(() => hole.filter((c): c is Card => c !== null), [hole])
  // Доска считается по порядку: без флопа тёрна не бывает.
  const boardCards = useMemo(() => {
    const out: Card[] = []
    for (const slot of board) { if (slot === null) break; out.push(slot) }
    return out
  }, [board])

  const used = useMemo(() => new Set([...holeCards, ...boardCards]), [holeCards, boardCards])
  const street = streetFor(boardCards.length)
  const ready = holeCards.length === 2

  useEffect(() => {
    if (!ready) { setAnalysis(null); setProblem(null); setWorking(false); return }
    setWorking(true)
    setProblem(null)

    // Пауза перед счётом: карты флопа кладут по три подряд, и считать
    // промежуточные состояния незачем.
    const timer = setTimeout(() => {
      const { promise, cancel } = client.analyse(
        {
          hole: holeCards,
          board: boardCards,
          pot: Math.max(pot, 1),
          toCall: Math.max(toCall, 0),
          effectiveStack: Math.max(stack, 0),
          opponents,
          opponentRange: villain > 0 ? topPercentRange(villain) : null,
        },
        // До флопа против диапазона перебор недостижим, поэтому итераций больше;
        // на флопе и дальше движок уходит в точный счёт и число игнорирует.
        boardCards.length === 0 ? 150_000 : 80_000,
      )
      cancelRef.current = cancel
      promise.then(
        (result) => { setAnalysis(result); setWorking(false) },
        (error: Error) => { setAnalysis(null); setProblem(error.message); setWorking(false) },
      )
    }, 180)

    const cancelRef = { current: null as null | (() => void) }
    return () => { clearTimeout(timer); cancelRef.current?.() }
  }, [holeCards, boardCards, pot, toCall, stack, opponents, villain, ready])

  // Отклик — только при смене решения. Расчёт идёт на каждое касание,
  // и щёлкать на каждый пересчёт значило бы вибрировать непрерывно.
  useEffect(() => {
    const action = analysis?.advice.action ?? null
    if (!action || action === lastAction.current) { lastAction.current = action; return }
    lastAction.current = action
    if (action === 'fold') Haptics.warning()
    else if (action === 'check') Haptics.tap()
    else Haptics.result(true)
  }, [analysis])

  const assign = (target: Target, card: Card | null) => {
    if (target.kind === 'hole') {
      setHole((prev) => prev.map((c, i) => (i === target.index ? card : c)))
    } else {
      setBoard((prev) => prev.map((c, i) => {
        if (i === target.index) return card
        // Убрали карту флопа — всё, что стояло после неё, теряет смысл.
        if (card === null && i > target.index) return null
        return c
      }))
    }
    setPicking(null)
  }

  const deal = () => {
    Haptics.place()
    const deck = [...FULL_DECK]
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[deck[i], deck[j]] = [deck[j], deck[i]]
    }
    setHole([deck[0], deck[1]])
    setBoard([null, null, null, null, null])
  }

  const reset = () => {
    Haptics.tap()
    setHole([null, null])
    setBoard([null, null, null, null, null])
    setToCall(0)
    setAnalysis(null)
  }

  const texture = readBoard(boardCards)

  return (
    <>
      <Panel>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s)' }}>
          <Chip text={STREET_TITLE[street]} tint="var(--info)" />
          <span style={{ flex: 1 }} />
          {working && <Spinner />}
          <button type="button" className="press" onClick={deal}
            style={{ fontSize: 'var(--f-xs)', color: 'var(--faint)' }}>
            Случайная
          </button>
          <button type="button" className="press" onClick={reset} aria-label="Очистить"
            style={{ fontSize: 'var(--f-xs)', color: 'var(--faint)' }}>
            Сброс
          </button>
        </div>

        <div className="field">
          <span className="label">Ваша рука</span>
          <div className="cards-row">
            {hole.map((card, index) => (
              <CardSlot key={index} card={card} width={54} placeholder="карта"
                onClick={() => setPicking({ kind: 'hole', index })} />
            ))}
          </div>
        </div>

        <div className="field">
          <span className="label">Стол</span>
          <div className="cards-row">
            {board.map((card, index) => (
              <CardSlot key={index} card={card} width={44}
                placeholder={index < 3 ? 'флоп' : index === 3 ? 'тёрн' : 'ривер'}
                onClick={() => setPicking({ kind: 'board', index })} />
            ))}
          </div>
        </div>

        {texture && <span className="hint">Доска: {texture.summary}</span>}
      </Panel>

      {!ready && (
        <Panel>
          <b>Выберите две карты руки</b>
          <span className="hint">
            Стол можно оставить пустым — тогда посчитается шанс до флопа.
            Добавляйте карты по мере того, как их открывает дилер.
          </span>
        </Panel>
      )}

      {problem && <Panel><span style={{ color: 'var(--bad)' }}>{problem}</span></Panel>}

      {analysis && (
        <div className={'appear' + (working ? ' fading' : '')}
          style={{ display: 'contents' }}>
          <Verdict analysis={analysis} />
          <Numbers analysis={analysis} />
          {analysis.draw && analysis.draw.draws.length > 0 && <Draws analysis={analysis} />}
          <Reasons analysis={analysis} />
        </div>
      )}

      <Panel title="Ситуация">
        <Stepper label="Банк" value={pot} step={10} onChange={setPot} />
        <Stepper label="Нужно доколлировать" value={toCall} step={10} onChange={setToCall} />
        <Stepper label="Ваш стек" value={stack} step={50} onChange={setStack} />
        <div className="field">
          <span className="label">Оппонентов</span>
          <Segmented
            options={[1, 2, 3, 4].map((n) => ({ value: n, label: String(n) }))}
            value={opponents}
            onChange={setOpponents}
          />
        </div>
        <div className="field">
          <span className="label">Рука оппонента</span>
          <Segmented options={VILLAINS} value={villain} onChange={setVillain} />
          <span className="hint">
            «Любая» — это верхняя оценка неопределённости. Против тесного оппонента
            ваше эквити всегда ниже, чем против случайных карт.
          </span>
        </div>
      </Panel>

      {picking && (
        <CardPicker
          used={used}
          current={picking.kind === 'hole' ? hole[picking.index] : board[picking.index]}
          title={picking.kind === 'hole' ? 'Карта руки'
            : picking.index < 3 ? 'Карта флопа' : picking.index === 3 ? 'Тёрн' : 'Ривер'}
          onPick={(card) => assign(picking, card)}
          onClose={() => setPicking(null)}
        />
      )}
    </>
  )
}

function Verdict({ analysis: a }: { analysis: SpotAnalysis }) {
  const need = a.potOdds.toCall > 0 ? requiredEquity(a.potOdds) : null
  return (
    <Panel>
      <div className="verdict">
        <span className="action" style={{ color: ACTION_COLOR[a.advice.action] }}>
          {ACTION_TITLE[a.advice.action]}
        </span>
        {a.advice.sizing != null && (
          <span className="size num">{Math.round(a.advice.sizing * 100)} % банка</span>
        )}
        <span style={{ flex: 1 }} />
        <Chip text={a.advice.strength === 'clear' ? 'уверенно' : a.advice.strength === 'close' ? 'с запасом' : 'на грани'}
          tint="var(--faint)" />
      </div>
      <div>{a.advice.headline}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--xs)' }}>
        <EquityBar equity={a.equity.equity} required={need} />
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--s)', fontSize: 'var(--f-s)' }}>
          <b className="num">Эквити {percent(a.equity.equity)}</b>
          {need != null && <span className="num" style={{ color: 'var(--faint)' }}>· порог {percent(need)}</span>}
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 'var(--f-xxs)', color: 'var(--faint)' }}>
            {a.equity.isExact ? 'точный расчёт' : `${Math.round(a.equity.iterations / 1000)} тыс. раздач`}
          </span>
        </div>
      </div>
      <span style={{ fontSize: 'var(--f-xs)', color: 'var(--warn)' }}>{a.assumption}</span>
    </Panel>
  )
}

function Numbers({ analysis: a }: { analysis: SpotAnalysis }) {
  const ev = callEV(a.potOdds, a.equity.equity)
  const freq = frequencies(a.potOdds.pot * 0.66, a.potOdds.pot)
  return (
    <Panel>
      <div className="tiles">
        <Tile label="Выигрыш" value={percent(a.equity.win)} tint="var(--good)"
          caption={`ничья ${percent(a.equity.tie)}`} />
        <Tile label="Рука сейчас" value={a.draw?.current.title ?? '—'} />
      </div>
      {a.potOdds.toCall > 0 && (
        <div className="tiles">
          <Tile label="Шансы банка" value={oddsRatio(a.potOdds)} tint="var(--info)"
            caption={`нужно ${percent(requiredEquity(a.potOdds))}`} />
          <Tile label="EV колла" value={(ev >= 0 ? '+' : '') + chips(ev)}
            tint={ev >= 0 ? 'var(--good)' : 'var(--bad)'} caption="в среднем за раздачу" />
        </div>
      )}
      <div className="tiles">
        <Tile label="SPR" value={decimal(a.spr)}
          caption={a.spr < 3 ? 'фишки заедут за одну ставку' : a.spr > 10 ? 'глубоко' : 'средняя глубина'} />
        <Tile label="Защита от 2/3 банка" value={percent(minimumDefence(freq), 0)}
          tint="var(--muted)" caption="реже сбрасывать нельзя" />
      </div>
    </Panel>
  )
}

function Draws({ analysis: a }: { analysis: SpotAnalysis }) {
  const draw = a.draw!
  const toCome = a.street === 'flop' ? 2 : 1
  return (
    <Panel title="Что доезжает" subtitle={draw.summary}>
      {draw.draws.map((d) => (
        <div className="row" key={d.kind}>
          <span className="k" style={{ color: 'var(--text)' }}>{DRAW_TITLE[d.kind]}</span>
          <span style={{ flex: 1 }} />
          <span className="v num" style={{ color: 'var(--muted)' }}>{d.outs} {outsWord(d.outs)}</span>
          <span className="v num" style={{ color: 'var(--info)', minWidth: 52, textAlign: 'right' }}>
            {percent(exactOutsEquity(d.outs, draw.unseen, toCome), 0)}
          </span>
        </div>
      ))}
      <hr style={{ border: 0, borderTop: '1px solid var(--stroke)', margin: 0 }} />
      <Row label="Всего аутов" value={`${draw.totalOuts} из ${draw.unseen}`} />
      {draw.boardPairing > 0 && (
        <Row label="Доска спарится" value={`${draw.boardPairing} карт`} tint="var(--faint)" />
      )}
      <Note>
        {'Ауты пересчитаны по колоде, а не взяты из таблицы: каждая невидимая карта подставляется к вашей руке, и проверяется, стала ли рука лучше. Карта, закрывающая и стрит, и флеш, засчитана один раз — по старшей из двух рук.\n\n'
          + 'Карты, спаривающие доску, в ауты не входят: такую пару получает и оппонент, поэтому расклад сил она не меняет. С AK на Q-7-2 у вас шесть аутов — тузы и короли, — а не пятнадцать.\n\n'
          + 'Правило 2 и 4 (ауты × 2 на одну карту, × 4 на две) даёт прикидку в уме; здесь стоит точная вероятность.'}
      </Note>
    </Panel>
  )
}

function Reasons({ analysis: a }: { analysis: SpotAnalysis }) {
  return (
    <Panel title="Почему так">
      <ul className="reasons">
        {a.advice.reasons.map((reason, i) => <li key={i}>{reason}</li>)}
      </ul>
      <Note title="Чему здесь можно верить">
        {'Эквити, шансы банка, ауты и частоты защиты — это арифметика: числа не зависят ни от оппонента, ни от манеры игры, и спорить с ними нельзя.\n\n'
          + 'Сам вывод — уже упрощение. Настоящее решение смешивает действия с частотами и зависит от того, как вы играете остальными руками. Считайте подсказку опорой для счёта, а не приказом.'}
      </Note>
    </Panel>
  )
}

function Stepper({ label, value, step, onChange }: {
  label: string
  value: number
  step: number
  /**
   * Именно сеттер состояния, а не `(v: number) => void`. По шагу банка
   * жмут часто и подряд, а React объединяет такие нажатия в одну перерисовку:
   * обработчик, считающий `value + step` по захваченному значению, на шести
   * быстрых нажатиях давал 10 вместо 60 — приращения терялись.
   */
  onChange: React.Dispatch<React.SetStateAction<number>>
}) {
  return (
    <div className="row">
      <span className="k">{label}</span>
      <div className="stepper">
        <button type="button" className="press-s" aria-label="меньше" onClick={() => {
          // Упор на нуле: без отклика непонятно, кнопка не сработала или уже край.
          if (value <= 0) { Haptics.limit(); return }
          Haptics.tap()
          onChange((prev) => Math.max(0, prev - step))
        }}>−</button>
        <span className="value num">{chips(value)}</span>
        <button type="button" className="press-s" aria-label="больше" onClick={() => {
          Haptics.tap()
          onChange((prev) => prev + step)
        }}>+</button>
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <span aria-label="считается" style={{
      width: 14, height: 14, borderRadius: '50%',
      border: '2px solid var(--stroke)', borderTopColor: 'var(--faint)',
      animation: 'spin 0.7s linear infinite', display: 'inline-block',
    }} />
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { type Card, FULL_DECK } from '../../engine/cards'
import { type SpotAnalysis, ACTION_TITLE, STREET_TITLE, STRENGTH_TITLE, streetFor } from '../../engine/advice'
import { topPercentRange } from '../../engine/notation'
import { readBoard } from '../../engine/texture'
import { DRAW_TITLE } from '../../engine/draws'
import {
  requiredEquity, oddsRatio, callEV, frequencies, minimumDefence, exactOutsEquity,
} from '../../engine/odds'
import { EquityClient } from '../../worker/client'
import { Panel, Tile, Row, Chip, Segmented, Note, EquityBar } from '../components/kit'
import { CardSlot, CardPicker } from '../components/PlayingCard'
import { Linked } from '../components/Term'
import { IconShuffle, IconReset, IconMinus, IconPlus } from '../components/icons'
import { Haptics } from '../haptics'
import { percent, decimal, chips, outsWord, plural } from '../format'

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

const STORE_KEY = 'pokerbro.solver.v1'

interface Spot {
  hole: Array<Card | null>
  board: Array<Card | null>
  pot: number
  toCall: number
  stack: number
  opponents: number
  villain: number
}

const EMPTY_SPOT: Spot = {
  hole: [null, null],
  board: [null, null, null, null, null],
  pot: 100, toCall: 0, stack: 900, opponents: 1, villain: 0,
}

/** Карты приходят из хранилища числами: проверяем, что это и правда колода. */
function readCards(raw: unknown, length: number): Array<Card | null> | null {
  if (!Array.isArray(raw) || raw.length !== length) return null
  const out: Array<Card | null> = []
  for (const value of raw) {
    if (value === null) { out.push(null); continue }
    if (!Number.isInteger(value) || value < 0 || value > 51) return null
    out.push(value as Card)
  }
  return out
}

const readNumber = (raw: unknown, fallback: number) =>
  Number.isFinite(raw) ? Math.max(0, raw as number) : fallback

/**
 * Разложенная раздача переживает уход на другую вкладку и перезагрузку.
 * Хранилище своё у каждого устройства; в приватном окне обращение к нему
 * бросает исключение, поэтому каждый доступ обёрнут.
 */
function loadSpot(): Spot {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return EMPTY_SPOT
    const parsed = JSON.parse(raw) as Partial<Spot>
    const hole = readCards(parsed.hole, 2)
    const board = readCards(parsed.board, 5)
    if (!hole || !board) return EMPTY_SPOT

    // Доска с пропуском невозможна в интерфейсе, но в хранилище могла попасть
    // из прошлой версии — подбираем её в порядок, а не показываем дыру.
    const packed = board.filter((c): c is Card => c !== null)
    const tidy: Array<Card | null> = [0, 1, 2, 3, 4].map((i) => packed[i] ?? null)

    const all = [...hole, ...tidy].filter((c): c is Card => c !== null)
    if (new Set(all).size !== all.length) return EMPTY_SPOT

    return {
      hole,
      board: tidy,
      pot: readNumber(parsed.pot, EMPTY_SPOT.pot),
      toCall: readNumber(parsed.toCall, EMPTY_SPOT.toCall),
      stack: readNumber(parsed.stack, EMPTY_SPOT.stack),
      opponents: [1, 2, 3, 4].includes(parsed.opponents as number) ? parsed.opponents! : 1,
      villain: VILLAINS.some((v) => v.value === parsed.villain) ? parsed.villain! : 0,
    }
  } catch {
    return EMPTY_SPOT
  }
}

function saveSpot(spot: Spot) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(spot))
  } catch {
    // Память недоступна — раздача проживёт до перезагрузки, падать незачем.
  }
}

export function Solver() {
  const [restored] = useState(loadSpot)
  const [hole, setHole] = useState<Array<Card | null>>(restored.hole)
  const [board, setBoard] = useState<Array<Card | null>>(restored.board)
  const [pot, setPot] = useState(restored.pot)
  const [toCall, setToCall] = useState(restored.toCall)
  const [stack, setStack] = useState(restored.stack)
  const [opponents, setOpponents] = useState(restored.opponents)
  const [villain, setVillain] = useState(restored.villain)
  const [picking, setPicking] = useState<Target | null>(null)

  const [analysis, setAnalysis] = useState<SpotAnalysis | null>(null)
  const [working, setWorking] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const lastAction = useRef<string | null>(null)

  // Банк задан вместе со ставкой оппонента, значит ставка не может его
  // превышать. Иначе банк до неё уходит в минус, и «шансы банка 0,7 : 1»
  // описывают раздачу, которой не бывает.
  useEffect(() => {
    if (toCall > pot) setToCall(pot)
  }, [toCall, pot])

  useEffect(() => {
    saveSpot({ hole, board, pot, toCall, stack, opponents, villain })
  }, [hole, board, pot, toCall, stack, opponents, villain])

  const holeCards = useMemo(() => hole.filter((c): c is Card => c !== null), [hole])
  // Доска считается по порядку: без флопа тёрна не бывает.
  const boardCards = useMemo(() => {
    const out: Card[] = []
    for (const slot of board) { if (slot === null) break; out.push(slot) }
    return out
  }, [board])

  const used = useMemo(() => new Set([...holeCards, ...boardCards]), [holeCards, boardCards])
  const street = streetFor(boardCards.length)
  // Одна или две карты на столе — не улица, а недобранный флоп. Считать по ним
  // нечего: такой доски не бывает, а движок молча выдал бы уверенное число.
  const flopIncomplete = boardCards.length === 1 || boardCards.length === 2
  const ready = holeCards.length === 2 && !flopIncomplete

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
          <Chip text={flopIncomplete ? 'Флоп не добран' : STREET_TITLE[street]}
            tint={flopIncomplete ? 'var(--warn)' : 'var(--info)'} />
          <span style={{ flex: 1 }} />
          {working && <Spinner />}
          <button type="button" className="press icon-btn" onClick={deal}>
            <IconShuffle />
            Случайная
          </button>
          <button type="button" className="press icon-btn" onClick={reset}>
            <IconReset />
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
                // Пока предыдущая карта не выбрана, слот закрыт: иначе тёрн
                // ложится при пустом флопе, виден на экране и молча
                // выбрасывается из расчёта.
                disabled={index > 0 && board[index - 1] === null}
                onClick={() => setPicking({ kind: 'board', index })} />
            ))}
          </div>
        </div>

        {texture && <span className="hint">Доска: {texture.summary}</span>}
      </Panel>

      {flopIncomplete && (
        <Panel>
          <b style={{ color: 'var(--warn)' }}>
            {/* «Не хватает» требует родительного, а вариантов всего два —
                таблица склонений здесь была бы сложнее самого текста. */}
            Доберите флоп: не хватает {boardCards.length === 2 ? 'одной карты' : 'двух карт'}
          </b>
          <span className="hint">
            Флоп открывают сразу тремя картами — доски из одной или двух не бывает.
            Пока она неполная, считать нечего: любое число здесь было бы выдумкой.
          </span>
        </Panel>
      )}

      {!ready && !flopIncomplete && (
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
        <Stepper label="Банк со ставкой" value={pot} step={10} onChange={setPot} />
        <Stepper label="Доколлировать" value={toCall} step={10} max={pot} onChange={setToCall} />
        {/* Договорённость о банке решает всё: с «банком до ставки» шансы
            выходят 2,0 : 1 вместо 3 : 1, и человек об этом не узнает.
            Поэтому она не в примечании, а прямо под шагами, с примером. */}
        <span className="convention">
          Банк считается вместе со ставкой оппонента. Он поставил 50 в банк 100 —
          значит, банк 150, доколлировать 50.
        </span>
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
            «Любая» значит, что оппоненту мы приписываем случайные карты. Если он
            играет осторожно и заходит только с сильными руками — выберите «Топ 20 %»
            или «Топ 10 %», и ваши шансы окажутся ниже. Так честнее.
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
        {/* Карта названий одна на движок и экран: раньше здесь лежал её дубль,
            и «с запасом» разъехалось с тем, что значит strength. */}
        <Chip text={STRENGTH_TITLE[a.advice.strength]} tint="var(--muted)" />
      </div>
      <div>{a.advice.headline}</div>
      <Outcomes equity={a.equity} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--xs)' }}>
        <EquityBar equity={a.equity.equity} required={need} />
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--s)', fontSize: 'var(--f-s)' }}>
          <b className="num"><Linked>Эквити</Linked> {percent(a.equity.equity)}</b>
          {need != null && <span className="num" style={{ color: 'var(--faint)' }}>· порог {percent(need)}</span>}
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 'var(--f-xxs)', color: 'var(--faint)' }}>
            {a.equity.isExact ? 'точный расчёт' : `${Math.round(a.equity.iterations / 1000)} тыс. раздач`}
          </span>
        </div>
      </div>
      <span style={{ fontSize: 'var(--f-xs)', color: 'var(--warn)' }}>
        <Linked>{a.assumption}</Linked>
      </span>
    </Panel>
  )
}

/**
 * Главное число словами. «Эквити 58 %» новичку не говорит ничего,
 * а «из 100 раздач выиграете 58» говорит сразу всё.
 *
 * Исходов три, а не два: банк ещё и делится. Проценты округляются так, чтобы
 * в сумме вышло ровно сто — иначе рядом стоят «67, 31 и 3», и читатель
 * справедливо решает, что мы не умеем считать.
 */
function Outcomes({ equity }: { equity: SpotAnalysis['equity'] }) {
  const win = Math.round(equity.win * 100)
  const tie = Math.round(equity.tie * 100)
  const lose = Math.max(100 - win - tie, 0)
  const splits = equity.tie >= 0.005

  return (
    <div className="plain">
      <p>
        Если сыграть такую раздачу 100 раз, вы выиграете примерно{' '}
        <b className="num">{win}</b>
        {splits && <>, ещё <b className="num">{tie}</b> {plural(tie, ['раз', 'раза', 'раз'])} разделите банк поровну</>}
        {' '}и проиграете <b className="num">{lose}</b>.
      </p>
      {/* Над этим блоком стоит доля банка, и без связки два числа выглядели
          противоречием: «67 %» над «выиграете 63». Правило названо словами,
          а не пересчитано, — иначе округление до целых само себе противоречит. */}
      {splits && (
        <p className="plain-note">
          Доля банка считается отсюда: все выигрыши плюс половина делёжек.
        </p>
      )}
      {splits && (
        <Note title="Когда банк делится">
          {'Масть в холдеме не решает ничего. Если у вас и у оппонента лучшие пять карт равны по силе, спорить больше нечем — банк делится поровну, это называют сплитом.\n\n'
            + 'Чаще всего так выходит, когда играет доска: лучшая пятёрка целиком лежит на столе, и ваши две карты ничего к ней не добавляют. Второй частый случай — одинаковый кикер: у обоих пара тузов с королём.\n\n'
            + 'Если равных рук трое, каждому достаётся треть. В расчёте это учтено: ничья на троих приносит треть банка, а не половину. Нечётная фишка по правилам большинства залов уходит игроку слева от дилера.'}
        </Note>
      )}
    </div>
  )
}

function Numbers({ analysis: a }: { analysis: SpotAnalysis }) {
  const ev = callEV(a.potOdds, a.equity.equity)
  // Банк здесь уже вместе со ставкой оппонента, а доля защиты считается
  // от банка до неё.
  const potBeforeBet = a.potOdds.pot - a.potOdds.toCall
  const defence = a.potOdds.toCall > 0 && potBeforeBet > 0
    ? minimumDefence(frequencies(a.potOdds.toCall, potBeforeBet))
    : null
  return (
    <Panel>
      <div className="tiles">
        <Tile label="Побед" value={percent(a.equity.win)} tint="var(--good)"
          caption={`поражений ${percent(a.equity.lose)}`} />
        <Tile label="Банк делится" value={percent(a.equity.tie)}
          tint={a.equity.tie >= 0.005 ? 'var(--info)' : 'var(--faint)'}
          caption={a.equity.tie >= 0.005 ? 'сплит — руки равны' : 'здесь почти исключено'} />
      </div>
      <div className="tiles">
        <Tile label="Что у вас сейчас" value={a.draw?.current.title ?? 'до флопа'} />
        <Tile label="Стек к банку" value={decimal(a.spr)}
          caption={a.spr < 3 ? 'весь стек уедет за одну ставку' : a.spr > 10 ? 'глубоко' : 'средняя глубина'} />
      </div>
      {a.potOdds.toCall > 0 && (
        <div className="tiles">
          <Tile label="Шансы банка" value={oddsRatio(a.potOdds)} tint="var(--info)"
            caption={`нужно ${percent(requiredEquity(a.potOdds))}`} />
          <Tile label="Колл в среднем" value={(ev >= 0 ? '+' : '') + chips(ev)}
            tint={ev >= 0 ? 'var(--good)' : 'var(--bad)'}
            caption={ev >= 0 ? 'столько приносит за раздачу' : 'столько теряет за раздачу'} />
        </div>
      )}
      {/* Раньше эта плитка считала защиту от выдуманной ставки в 2/3 банка
          и потому показывала 60 % всегда — при любой руке, банке и стеке.
          Теперь она про ставку, которая действительно стоит перед вами,
          и появляется только когда такая ставка есть. */}
      {defence != null && (
        <div className="tiles">
          <Tile label="Нельзя сбрасывать" value={percent(defence, 0)} tint="var(--muted)"
            caption="иначе его блеф окупится с любыми картами" />
        </div>
      )}
    </Panel>
  )
}

function Draws({ analysis: a }: { analysis: SpotAnalysis }) {
  const draw = a.draw!
  const toCome = a.street === 'flop' ? 2 : 1
  return (
    <Panel title="Чем рука может улучшиться" subtitle={draw.summary}>
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
      <Row label="Всего помогает карт" value={`${draw.totalOuts} из ${draw.unseen}`} />
      {draw.boardPairing > 0 && (
        <Row label="Спарят доску (не в счёт)" value={`${draw.boardPairing} карт`} tint="var(--faint)" />
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
  // Один счётчик на весь список: причины — это несколько строк, но читаются
  // они как один блок, и «колл», подчёркнутый в каждой второй, только мешает.
  const seen = new Set<string>()
  return (
    <Panel title="Почему так">
      <ul className="reasons">
        {a.advice.reasons.map((reason, i) => <li key={i}><Linked seen={seen}>{reason}</Linked></li>)}
      </ul>
      <Note title="Чему здесь можно верить">
        {'Эквити, шансы банка, ауты и частоты защиты — это арифметика: числа не зависят ни от оппонента, ни от манеры игры, и спорить с ними нельзя.\n\n'
          + 'Сам вывод — уже упрощение. Настоящее решение смешивает действия с частотами и зависит от того, как вы играете остальными руками. Считайте подсказку опорой для счёта, а не приказом.'}
      </Note>
    </Panel>
  )
}

function Stepper({ label, value, step, max, onChange }: {
  label: string
  value: number
  step: number
  /** Верхний предел. Ставка не может быть больше банка: банк её уже включает. */
  max?: number
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
        <button type="button" className="press-s hit" aria-label="Уменьшить" onClick={() => {
          // Упор на нуле: без отклика непонятно, кнопка не сработала или уже край.
          if (value <= 0) { Haptics.limit(); return }
          Haptics.tap()
          onChange((prev) => Math.max(0, prev - step))
        }}><IconMinus /></button>
        <span className="value num">{chips(value)}</span>
        <button type="button" className="press-s hit" aria-label="Увеличить" onClick={() => {
          if (max != null && value >= max) { Haptics.limit(); return }
          Haptics.tap()
          onChange((prev) => (max != null ? Math.min(max, prev + step) : prev + step))
        }}><IconPlus /></button>
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

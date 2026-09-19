import { useMemo, useState } from 'react'
import {
  type Position, POSITIONS, POSITION_CODE, POSITION_HINT, ACTION_TITLE,
  spotsFor, actionFor, playedPercentage,
} from '../../engine/charts'
import { rangePercentage, parseHandClass, comboCount, isPair } from '../../engine/range'
import { PREFLOP_EQUITY } from '../../engine/strength'
import { Panel, Tile, Segmented, Note } from '../components/kit'
import { RangeGrid, RangeLegend } from '../components/RangeGrid'
import { Linked } from '../components/Term'
import { percent } from '../format'

const FILL: Record<string, string> = {
  raise: 'var(--good)', call: 'var(--info)', fold: 'var(--raised)',
}

/**
 * Префлоп-чарты. Сетка 13×13 — тот же вид, в котором чарты печатают везде:
 * выучив раскладку здесь, вы будете читать любой чужой чарт.
 */
export function Charts() {
  const [hero, setHero] = useState<Position>('btn')
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)

  const spots = useMemo(() => spotsFor(hero), [hero])
  const spot = spots[Math.min(index, spots.length - 1)]

  const legend: Array<[string, string, number]> = [['Рейз', FILL.raise, rangePercentage(spot.raise)]]
  if (spot.call.size > 0) legend.push(['Колл', FILL.call, rangePercentage(spot.call)])
  legend.push(['Фолд', FILL.fold, 100 - playedPercentage(spot)])

  return (
    <>
      <Panel>
        <div className="field">
          <span className="label">Ваша позиция</span>
          <Segmented
            options={POSITIONS.map((p) => ({ value: p, label: POSITION_CODE[p] }))}
            value={hero}
            onChange={(p) => { setHero(p); setIndex(0); setSelected(null) }}
          />
        </div>
        <span style={{ fontSize: 'var(--f-s)', color: 'var(--muted)' }}>
          <Linked>{POSITION_HINT[hero]}</Linked>
        </span>
        {spots.length > 1 && (
          <div className="field">
            <span className="label">Ситуация</span>
            <Segmented
              options={spots.map((s, i) => ({
                value: i, label: s.versus ? `vs ${POSITION_CODE[s.versus]}` : 'Открытие',
              }))}
              value={Math.min(index, spots.length - 1)}
              onChange={setIndex}
            />
          </div>
        )}
      </Panel>

      <Panel title={spot.title} subtitle="Зелёное — повышать, синее — уравнивать, серое — сбрасывать. Нажмите на руку, чтобы прочитать про неё">
        <RangeGrid
          color={(notation) => FILL[actionFor(spot, notation)]}
          selected={selected}
          onSelect={(n) => setSelected(selected === n ? null : n)}
        />
        <RangeLegend items={legend} />
      </Panel>

      {selected && <HandDetail notation={selected} action={actionFor(spot, selected)} />}

      <Panel>
        <span style={{ fontSize: 'var(--f-s)', color: 'var(--muted)' }}>
          <Linked>{spot.note}</Linked>
        </span>
        <Note title="Насколько этим чартам можно верить">
          {'Это справочные чарты для шестимаксового стола со стеками 100 больших блайндов, а не выход солвера, и выдавать их за него было бы нечестно.\n\n'
            + 'Настоящее GTO-решение смешивает действия с частотами: одна и та же рука в нём коллирует, скажем, в трети случаев и пасует в двух третях. Такое не запоминается и за столом не воспроизводится. Здесь у каждой руки один ответ — чарт близок к решению и, в отличие от него, укладывается в голове.\n\n'
            + 'Что проверено: узкая позиция целиком входит в широкую, ни одна рука не попадает одновременно в рейз и в колл, а защита расширяется против более широкого оппонента.'}
        </Note>
      </Panel>
    </>
  )
}

function HandDetail({ notation, action }: { notation: string; action: 'raise' | 'call' | 'fold' }) {
  const hand = parseHandClass(notation)
  if (!hand) return null
  const equity = PREFLOP_EQUITY[notation]

  const description = (() => {
    if (isPair(hand)) {
      return `Карманная пара. Собирает сет примерно в одном случае из восьми — ради этого её и коллируют.`
    }
    const gap = hand.high - hand.low
    const suit = hand.suited ? 'Одномастные' : 'Разномастные'
    if (gap === 1) return `${suit} коннекторы. Играются ради стритов и флешей, а не ради пары.`
    if (hand.high === 14) {
      return `${suit} с тузом. ` + (hand.suited
        ? 'Одномастность добавляет флеш и примерно три процента эквити.'
        : 'Без одномастности такая рука часто доминирована: против AK ваш туз не помогает.')
    }
    return `${suit}, разрыв ${gap - 1}. ` + (hand.suited
      ? 'Одномастность даёт флеш-потенциал.'
      : 'Разномастная рука с разрывом реализуется хуже всего.')
  })()

  return (
    <Panel>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--s)' }}>
        <b className="num" style={{ fontSize: 30 }}>{notation}</b>
        <span style={{ flex: 1 }} />
        <b style={{ fontSize: 'var(--f-title)', color: action === 'fold' ? 'var(--bad)' : FILL[action] }}>
          {ACTION_TITLE[action]}
        </b>
      </div>
      <span style={{ fontSize: 'var(--f-s)', color: 'var(--muted)' }}>
        <Linked>{description}</Linked>
      </span>
      <div className="tiles">
        <Tile label="Способов собрать" value={String(comboCount(hand))}
          caption={isPair(hand) ? 'у любой пары их 6' : hand.suited ? 'у одномастной руки 4' : 'у разномастной 12'} />
        {equity != null && (
          <Tile label="Побед вслепую" value={percent(equity, 0)} tint="var(--info)"
            caption="если сыграть до конца против случайных карт" />
        )}
      </div>
    </Panel>
  )
}

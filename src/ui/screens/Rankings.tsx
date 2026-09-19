import { useState } from 'react'
import { HAND_RANKINGS, oddsText } from '../../engine/rankings'
import { Panel, Row, Note } from '../components/kit'
import { PlayingCard } from '../components/PlayingCard'
import { Haptics } from '../haptics'
import { decimal } from '../format'

/**
 * Комбинации от старшей к младшей. Частоты посчитаны перебором всех
 * 133 784 560 семикарточных наборов — это то, что игрок видит к риверу,
 * а не пятикарточные числа из учебников.
 */
export function Rankings() {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <>
      <Panel>
        <b>Комбинация собирается из любых пяти карт среди ваших двух и пяти общих.</b>
        <span className="hint">
          Проценты справа — как часто такая рука получается к риверу.
          Сумма даёт 100 %: каждая раздача попадает ровно в одну строку.
        </span>
      </Panel>

      {HAND_RANKINGS.map((entry, index) => {
        const expanded = open === entry.category
        return (
          <Panel key={entry.category}>
            <button
              type="button"
              className="press"
              style={{ display: 'flex', flexDirection: 'column', gap: 'var(--m)', textAlign: 'left' }}
              onClick={() => { Haptics.tap(); setOpen(expanded ? null : entry.category) }}
            >
              <span style={{ display: 'flex', alignItems: 'baseline', width: '100%', gap: 'var(--s)' }}>
                <span className="num" style={{ color: 'var(--faint)', fontSize: 'var(--f-s)', width: 18 }}>
                  {index + 1}
                </span>
                <b style={{ fontSize: 'var(--f-title)' }}>{entry.title}</b>
                <span style={{ flex: 1 }} />
                <span className="num" style={{ color: 'var(--info)', fontWeight: 600 }}>
                  {decimal(entry.frequency, entry.frequency < 1 ? 2 : 1)} %
                </span>
              </span>
              <span className="cards-row" style={{ alignItems: 'center', width: '100%' }}>
                {entry.example.map((card, i) => (
                  <PlayingCard key={card} card={card} width={38} dim={!entry.highlighted.includes(i)} />
                ))}
                <span style={{ flex: 1 }} />
                <span style={{ color: 'var(--faint)', fontSize: 'var(--f-xs)' }}>
                  {expanded ? '▲' : '▼'}
                </span>
              </span>
            </button>

            {expanded && (
              <div className="appear" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s)' }}>
                <span style={{ fontSize: 'var(--f-s)', color: 'var(--muted)' }}>{entry.explanation}</span>
                <div className="highlight">
                  <span style={{ color: 'var(--warn)' }}>◆</span>
                  <span>{entry.beginnerNote}</span>
                </div>
                <Row label="Встречается" value={oddsText(entry.frequency)} tint="var(--muted)" />
                <Row label="Наборов из семи карт"
                  value={entry.combinations.toLocaleString('ru-RU')} tint="var(--faint)" />
              </div>
            )}
          </Panel>
        )
      })}

      <Panel>
        <Note title="Откуда взяты проценты">
          {'Перебраны все 133 784 560 наборов из семи карт, и каждый отнесён к своей категории тем же оценщиком, который считает раздачи в разделе «Разбор». Числа не переписаны из справочника.\n\n'
            + 'Пятикарточные проценты, которые обычно печатают в учебниках, здесь не подходят: с семью картами две пары встречаются вчетверо чаще, а рука без пары — втрое реже.'}
        </Note>
      </Panel>
    </>
  )
}

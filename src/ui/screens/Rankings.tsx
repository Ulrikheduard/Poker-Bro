import { useState } from 'react'
import { HAND_RANKINGS, oddsText } from '../../engine/rankings'
import { Panel, Row, Note } from '../components/kit'
import { PlayingCard } from '../components/PlayingCard'
import { Linked } from '../components/Term'
import { IconChevron, IconTip } from '../components/icons'
import { Haptics } from '../haptics'
import { decimal } from '../format'

/**
 * Комбинации от старшей к младшей. Частоты посчитаны перебором всех
 * 133 784 560 семикарточных наборов — это то, что игрок видит к риверу,
 * а не пятикарточные числа из учебников.
 */
export function Rankings() {
  const [open, setOpen] = useState<string | null>(null)

  return (
    <>
      {/* Вводный текст намеренно без панели: панель — это карточка со своим
          содержимым, а здесь просто подпись к списку, и рамка вокруг неё
          делает вид, будто это ещё один пункт. */}
      <div className="intro">
        <p>Рука — это <b>лучшие пять карт</b> из семи: двух ваших и пяти общих на столе.</p>
        <p className="quiet">
          Список идёт от самой сильной комбинации к самой слабой. Проценты справа
          показывают, как часто такая рука получается к концу раздачи.
        </p>
      </div>

      {HAND_RANKINGS.map((entry, index) => {
        const expanded = open === entry.id
        return (
          <Panel key={entry.id}>
            <button
              type="button"
              className="press"
              style={{ display: 'flex', flexDirection: 'column', gap: 'var(--m)', textAlign: 'left' }}
              onClick={() => { Haptics.tap(); setOpen(expanded ? null : entry.id) }}
            >
              <span style={{ display: 'flex', alignItems: 'baseline', width: '100%', gap: 'var(--s)' }}>
                <span className="num" style={{ color: 'var(--faint)', fontSize: 'var(--f-s)', width: 18 }}>
                  {index + 1}
                </span>
                <b style={{ fontSize: 'var(--f-title)' }}>{entry.title}</b>
                <span style={{ flex: 1 }} />
                <span className="num" style={{ color: 'var(--info)', fontWeight: 600 }}>
                  {decimal(entry.frequency, entry.frequency < 0.1 ? 3 : entry.frequency < 1 ? 2 : 1)} %
                </span>
              </span>
              <span className="cards-row" style={{ alignItems: 'center', width: '100%' }}>
                {entry.example.map((card, i) => (
                  <PlayingCard key={card} card={card} width={38} dim={!entry.highlighted.includes(i)} />
                ))}
                <span style={{ flex: 1 }} />
                <span style={{ color: 'var(--faint)', display: 'flex' }}>
                  <IconChevron open={expanded} />
                </span>
              </span>
            </button>

            {expanded && (
              <div className="appear" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s)' }}>
                <span style={{ fontSize: 'var(--f-s)', color: 'var(--muted)' }}>
                  <Linked>{entry.explanation}</Linked>
                </span>
                <div className="highlight">
                  <span style={{ color: 'var(--warn)', display: 'flex', paddingTop: 2 }}>
                    <IconTip />
                  </span>
                  <span><Linked>{entry.beginnerNote}</Linked></span>
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
          {'Перебраны все 133 784 560 наборов из семи карт, и каждый отнесён к своей комбинации тем же оценщиком, который считает раздачи в разделе «Разбор». Числа не переписаны из справочника.\n\n'
            + 'Проценты в учебниках обычно считают для пяти карт — здесь они не подходят: с семью картами две пары встречаются вчетверо чаще, а рука без пары втрое реже.\n\n'
            + 'Флеш-рояль стоит отдельной строкой, хотя формально это просто самый старший стрит-флеш.'}
        </Note>
      </Panel>
    </>
  )
}

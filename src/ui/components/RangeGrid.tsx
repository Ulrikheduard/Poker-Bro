import { ALL_RANKS } from '../../engine/cards'
import { handClass } from '../../engine/range'
import { Haptics } from '../haptics'

/**
 * Сетка 13×13 — канонический вид покерного диапазона: по диагонали пары,
 * выше неё одномастные руки, ниже разномастные. Раскладка не выдумана —
 * в таком виде чарты печатают везде, и переучиваться потом не придётся.
 */
export function RangeGrid({ color, selected, onSelect }: {
  color: (notation: string) => string
  selected?: string | null
  onSelect?: (notation: string) => void
}) {
  const ranks = [...ALL_RANKS].reverse()
  const cells = []
  for (let row = 0; row < 13; row++) {
    for (let column = 0; column < 13; column++) {
      const hand = handClass(ranks[Math.min(row, column)], ranks[Math.max(row, column)], column > row)
      const fill = color(hand.notation)
      cells.push(
        <button
          key={hand.notation}
          type="button"
          className={onSelect ? 'press-xs' : undefined}
          data-action={fill === 'var(--raised)' ? 'fold' : 'play'}
          data-selected={selected === hand.notation}
          style={{ background: fill, cursor: onSelect ? 'pointer' : 'default' }}
          disabled={!onSelect}
          onClick={onSelect ? () => { Haptics.select(); onSelect(hand.notation) } : undefined}
        >
          {hand.notation}
        </button>,
      )
    }
  }
  return <div className="grid13">{cells}</div>
}

export function RangeLegend({ items }: { items: Array<[string, string, number]> }) {
  return (
    <div className="legend">
      {items.map(([label, color, share]) => (
        <span key={label}>
          <i style={{ background: color }} />
          {label}
          <b className="num" style={{ color: 'var(--faint)', fontWeight: 600 }}>
            {share.toFixed(1).replace('.', ',')} %
          </b>
        </span>
      ))}
    </div>
  )
}

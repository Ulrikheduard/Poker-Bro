import { type ReactNode } from 'react'
import { Haptics } from '../haptics'

export function Panel({ title, subtitle, children, className }: {
  title?: string
  subtitle?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={'panel' + (className ? ' ' + className : '')}>
      {title && (
        <header>
          <h2>{title}</h2>
          {subtitle && <span className="subtitle">{subtitle}</span>}
        </header>
      )}
      {children}
    </section>
  )
}

export function Tile({ label, value, caption, tint }: {
  label: string
  value: string
  caption?: string
  tint?: string
}) {
  return (
    <div className="tile">
      <span className="label">{label}</span>
      <span className="value num" style={tint ? { color: tint } : undefined}>{value}</span>
      {caption && <span className="caption">{caption}</span>}
    </div>
  )
}

export function Row({ label, value, tint }: { label: string; value: string; tint?: string }) {
  return (
    <div className="row">
      <span className="k">{label}</span>
      <span className="v num" style={tint ? { color: tint } : undefined}>{value}</span>
    </div>
  )
}

export function Chip({ text, tint }: { text: string; tint?: string }) {
  return <span className="chip" style={{ color: tint ?? 'var(--muted)' }}>{text}</span>
}

export function Segmented<T extends string | number>({ options, value, onChange }: {
  options: Array<{ value: T; label: string }>
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div className="segmented" role="group">
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          aria-pressed={value === option.value}
          className="press"
          onClick={() => {
            if (value === option.value) return
            Haptics.select()
            onChange(option.value)
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/** Пояснение к расчёту: нужно редко, а места занимает много — поэтому свёрнуто. */
export function Note({ title = 'Как это считается', children }: { title?: string; children: ReactNode }) {
  return (
    <details className="note" onToggle={() => Haptics.tap()}>
      <summary>{title}</summary>
      <p>{children}</p>
    </details>
  )
}

/** Шкала эквити с отметкой порога: без порога «40 %» ничего не говорит. */
export function EquityBar({ equity, required }: { equity: number; required?: number | null }) {
  const color =
    required == null ? 'var(--info)'
      : equity >= required + 0.05 ? 'var(--good)'
      : equity >= required ? 'var(--warn)'
      : 'var(--bad)'
  return (
    <div className="bar">
      <div className="fill" style={{ width: `${Math.max(equity * 100, 1)}%`, background: color }} />
      {required != null && required > 0 && required < 1 && (
        <div className="mark" style={{ left: `calc(${required * 100}% - 1px)` }} />
      )}
    </div>
  )
}

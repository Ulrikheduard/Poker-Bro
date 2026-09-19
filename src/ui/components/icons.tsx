/**
 * Иконки. Рисуем сами: SF Symbols в вебе нет, а шрифт-икон ради десятка
 * значков тянуть незачем.
 *
 * Семейство держится на одном контуре 1,8 в поле 24×24 — включая пику:
 * залитый знак масти рядом с четырьмя контурными читался тяжелее прочих
 * и выбивался из ряда.
 *
 * Юникодных символов вместо иконок здесь нет намеренно: «▲», «✓», «−» берут
 * начертание из системного шрифта, у них своя оптическая ось и свой вес,
 * и в одном ряду с нарисованными иконками это видно сразу.
 */
const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

type Props = { size?: number; className?: string }
const svg = (size: number) => ({ width: size, height: size, viewBox: '0 0 24 24', ...base })

// ── Разделы ──────────────────────────────────────────────────────────────

export const IconSolver = () => (
  <svg {...svg(22)}><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M7 15v-3M12 15V9M17 15v-5" /></svg>
)
export const IconSpade = () => (
  <svg {...svg(22)}>
    <path d="M12 3.6c-2.2 2.5-6.2 4.8-6.2 8.2 0 2 1.5 3.4 3.3 3.4 1 0 1.8-.4 2.4-1.1-.2 2-.9 3.5-2 4.3h5c-1.1-.8-1.8-2.3-2-4.3.6.7 1.4 1.1 2.4 1.1 1.8 0 3.3-1.4 3.3-3.4 0-3.4-4-5.7-6.2-8.2Z" />
  </svg>
)
export const IconGrid = () => (
  <svg {...svg(22)}><rect x="3" y="3" width="18" height="18" rx="2.5" /><path d="M9 3v18M15 3v18M3 9h18M3 15h18" /></svg>
)
export const IconBook = () => (
  <svg {...svg(22)}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5Z" /><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H19v3H6.5A2.5 2.5 0 0 1 4 20.5Z" /></svg>
)
export const IconTarget = () => (
  <svg {...svg(22)}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" /></svg>
)

// ── Управление ───────────────────────────────────────────────────────────

/** Раскрыть или свернуть. `open` поворачивает шеврон, а не меняет значок:
 *  поворот показывает, что это одна и та же кнопка в двух состояниях. */
export const IconChevron = ({ open = false, size = 14 }: Props & { open?: boolean }) => (
  <svg {...svg(size)} style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 0.2s ease-out' }}>
    <path d="M6 9.5 12 15.5 18 9.5" />
  </svg>
)
export const IconMinus = ({ size = 18 }: Props) => (
  <svg {...svg(size)}><path d="M6 12h12" /></svg>
)
export const IconPlus = ({ size = 18 }: Props) => (
  <svg {...svg(size)}><path d="M12 6v12M6 12h12" /></svg>
)
export const IconCheck = ({ size = 20 }: Props) => (
  <svg {...svg(size)}><path d="M5 12.5 10 17.5 19 7" /></svg>
)
export const IconCross = ({ size = 20 }: Props) => (
  <svg {...svg(size)}><path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5" /></svg>
)
export const IconShuffle = ({ size = 15 }: Props) => (
  <svg {...svg(size)}><path d="M16 4h4v4M20 4l-6.5 6.5M16 20h4v-4M20 20l-6.5-6.5M4 4l5 5M4 20l16-16" /></svg>
)
export const IconReset = ({ size = 15 }: Props) => (
  <svg {...svg(size)}><path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4" /></svg>
)
/** Подсказка новичку. Лампочка, а не «◆»: ромб ничего не значит. */
export const IconTip = ({ size = 15 }: Props) => (
  <svg {...svg(size)}><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.4.3.6.7.6 1.1h5.8c0-.4.2-.8.6-1.1A6 6 0 0 0 12 3Z" /></svg>
)

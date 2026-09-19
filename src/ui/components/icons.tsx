/** Иконки нижней панели. Рисуем сами: SF Symbols в вебе нет, а шрифт-икон
 *  ради пяти значков тянуть незачем. */
const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

export const IconSolver = () => (
  <svg viewBox="0 0 24 24" {...base}><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M7 15v-3M12 15V9M17 15v-5" /></svg>
)
export const IconSpade = () => (
  <svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 3.2c-2.4 2.6-6.6 5-6.6 8.6 0 2.1 1.6 3.6 3.5 3.6 1 0 1.9-.4 2.5-1.1-.2 2-.9 3.6-2.1 4.5h5.4c-1.2-.9-1.9-2.5-2.1-4.5.6.7 1.5 1.1 2.5 1.1 1.9 0 3.5-1.5 3.5-3.6 0-3.6-4.2-6-6.6-8.6Z" /></svg>
)
export const IconGrid = () => (
  <svg viewBox="0 0 24 24" {...base}><rect x="3" y="3" width="18" height="18" rx="2.5" /><path d="M9 3v18M15 3v18M3 9h18M3 15h18" /></svg>
)
export const IconBook = () => (
  <svg viewBox="0 0 24 24" {...base}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5Z" /><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H19v3H6.5A2.5 2.5 0 0 1 4 20.5Z" /></svg>
)
export const IconTarget = () => (
  <svg viewBox="0 0 24 24" {...base}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /></svg>
)

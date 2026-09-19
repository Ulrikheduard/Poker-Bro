import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Лист, выезжающий снизу. Общий для выбора карты и статьи словаря.
 *
 * Рисуется порталом в `body`, а не там, где стоит в разметке. Иначе лист —
 * потомок прокручиваемой области, и его порядок наложения зависит от предков:
 * нижняя панель разделов с `backdrop-filter` в Safari перекрывала его, хотя
 * по z-index должна была остаться под ним, и нижний ряд карт (трефы) оказывался
 * недоступен. Портал к `body` убирает саму возможность такого спора.
 *
 * Пока лист открыт, фон не прокручивается: на iOS прокрутка иначе «протекает»
 * сквозь наложение на страницу под ним.
 */
export function Sheet({ title, onClose, children, labelledBy }: {
  title?: string
  onClose: () => void
  children: ReactNode
  labelledBy?: string
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [onClose])

  return createPortal(
    <div
      className="sheet-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={labelledBy ? undefined : title}
      aria-labelledby={labelledBy}
    >
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="grabber" />
        {title && <h2>{title}</h2>}
        {children}
      </div>
    </div>,
    document.body,
  )
}

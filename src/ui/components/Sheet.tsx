import { useEffect, useRef, type ReactNode } from 'react'
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
  const sheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Куда вернуть фокус, когда лист закроется: иначе обход начинается
    // с начала страницы, а VoiceOver теряет место, откуда лист открыли.
    const opener = document.activeElement as HTMLElement | null
    sheetRef.current?.focus({ preventScroll: true })

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key !== 'Tab') return

      // Фокус держим внутри листа: под ним лежит вся страница, и уйти
      // по Tab на кнопки, закрытые наложением, значит потеряться.
      const node = sheetRef.current
      if (!node) return
      const focusable = [...node.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )].filter((el) => el.offsetParent !== null || el === node)
      if (focusable.length === 0) { e.preventDefault(); return }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === first || active === node)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
      opener?.focus({ preventScroll: true })
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
      <div className="sheet" ref={sheetRef} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <div className="grabber" />
        {title && <h2>{title}</h2>}
        {children}
      </div>
    </div>,
    document.body,
  )
}

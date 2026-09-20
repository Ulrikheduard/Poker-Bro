/**
 * Тактильный отклик, насколько он вообще возможен в вебе на iPhone.
 *
 * Честно: возможен он плохо. `navigator.vibrate()` Safari не поддерживает
 * ни на iOS, ни на macOS и никогда не поддерживал. Остаётся приём с переключателем:
 * `<input type="checkbox" switch>` система сопровождает собственным откликом,
 * и если щёлкнуть по нему из обработчика настоящего нажатия, отклик случается.
 * Работает он с iOS 17.4, даёт один-единственный щелчок без оттенков и может
 * отвалиться в следующей версии системы.
 *
 * Поэтому здесь: пробуем переключатель, затем `vibrate` (он живёт в Android),
 * и молча ничего не делаем, если не вышло ни то ни другое. Разницы между
 * «выбор», «нажатие» и «упор», как в нативной версии, тут нет — её неоткуда взять.
 */

let toggle: HTMLInputElement | null = null
let label: HTMLLabelElement | null = null

function ensureElement(): HTMLLabelElement | null {
  if (label) return label
  if (typeof document === 'undefined') return null
  label = document.createElement('label')
  label.setAttribute('aria-hidden', 'true')
  label.style.cssText =
    'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-9999px;top:0'
  toggle = document.createElement('input')
  toggle.type = 'checkbox'
  toggle.setAttribute('switch', '')
  toggle.tabIndex = -1
  label.appendChild(toggle)
  document.body.appendChild(label)
  return label
}

function pulse(pattern: number | number[]): void {
  const element = ensureElement()
  if (element && toggle) {
    // Щелчок по скрытому переключателю уводит фокус на него: обход с внешней
    // клавиатуры после каждого действия начинался бы заново, а VoiceOver
    // попадал бы в узел с aria-hidden. Возвращаем фокус туда, где он был.
    const previous = document.activeElement as HTMLElement | null
    try { element.click() } catch { /* система отклик не дала — не беда */ }
    if (previous && previous !== document.activeElement) {
      try { previous.focus({ preventScroll: true }) } catch { /* элемент уже исчез */ }
    }
  }
  const vibrate = typeof navigator !== 'undefined' ? navigator.vibrate?.bind(navigator) : undefined
  if (vibrate) { try { vibrate(pattern) } catch { /* заблокировано настройками */ } }
}

export const Haptics = {
  /** Перебор вариантов: карта, позиция, режим. */
  select: () => pulse(8),
  /** Обычное нажатие. */
  tap: () => pulse(10),
  /** Карта легла на место. */
  place: () => pulse(14),
  /** Упор: дальше значение не идёт. */
  limit: () => pulse([12, 40, 12]),
  /** Итог со смыслом. */
  result: (success: boolean) => pulse(success ? [12, 60, 24] : [28, 60, 28]),
  warning: () => pulse([16, 50, 16]),
}

/** Форматирование в одном месте: проценты с запятой, фишки без хвоста нулей. */
export const percent = (value: number, digits = 1): string =>
  (value * 100).toFixed(digits).replace('.', ',') + ' %'

export const decimal = (value: number, digits = 1): string =>
  value.toFixed(digits).replace('.', ',')

export const chips = (value: number): string => {
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace('.', ',')
}

/**
 * Склонение существительного при числе: `plural(15, ['раз', 'раза', 'раз'])`.
 * Формы — для 1, для 2–4 и для 5–20; одиннадцать-четырнадцать идут по третьей,
 * иначе получается «15 раза».
 */
export const plural = (n: number, forms: [string, string, string]): string => {
  const tens = Math.abs(n) % 100
  if (tens >= 11 && tens <= 14) return forms[2]
  const last = Math.abs(n) % 10
  if (last === 1) return forms[0]
  if (last >= 2 && last <= 4) return forms[1]
  return forms[2]
}

/** «6 аутов», «15 аутов», «1 аут». */
export const outsWord = (n: number): string => plural(n, ['аут', 'аута', 'аутов'])

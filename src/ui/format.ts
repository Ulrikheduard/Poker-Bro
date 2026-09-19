/** Форматирование в одном месте: проценты с запятой, фишки без хвоста нулей. */
export const percent = (value: number, digits = 1): string =>
  (value * 100).toFixed(digits).replace('.', ',') + ' %'

export const decimal = (value: number, digits = 1): string =>
  value.toFixed(digits).replace('.', ',')

export const chips = (value: number): string => {
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace('.', ',')
}

/** «6 аутов», «15 аутов», «1 аут» — русские окончания. */
export const outsWord = (n: number): string => {
  const last = n % 10, tens = n % 100
  if (tens >= 11 && tens <= 14) return 'аутов'
  if (last === 1) return 'аут'
  if (last >= 2 && last <= 4) return 'аута'
  return 'аутов'
}

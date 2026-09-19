import { describe, it, expect } from 'vitest'
import { plural, outsWord } from './format'
import { evaluate } from '../engine/evaluator'
import { parseCards } from '../engine/cards'

describe('русский язык в числах и названиях', () => {
  /** «15 раза» — первое, что режет глаз в готовом приложении. */
  it('склоняет существительное при числе', () => {
    const раз = (n: number) => `${n} ${plural(n, ['раз', 'раза', 'раз'])}`
    expect(раз(1)).toBe('1 раз')
    expect(раз(2)).toBe('2 раза')
    expect(раз(4)).toBe('4 раза')
    expect(раз(5)).toBe('5 раз')
    // одиннадцать-четырнадцать идут по третьей форме, а не по окончанию
    expect(раз(11)).toBe('11 раз')
    expect(раз(12)).toBe('12 раз')
    expect(раз(14)).toBe('14 раз')
    expect(раз(15)).toBe('15 раз')
    expect(раз(21)).toBe('21 раз')
    expect(раз(22)).toBe('22 раза')
    expect(раз(0)).toBe('0 раз')
  })

  it('ауты склоняются так же', () => {
    expect(outsWord(1)).toBe('аут')
    expect(outsWord(2)).toBe('аута')
    expect(outsWord(6)).toBe('аутов')
    expect(outsWord(11)).toBe('аутов')
    expect(outsWord(15)).toBe('аутов')
  })

  /** «Стрит до туз» — то же самое, но в названии руки. */
  it('название руки ставит старшую карту в родительный падеж', () => {
    expect(evaluate(parseCards('As Ks Qd Jh Tc')).title).toBe('Стрит до туза')
    expect(evaluate(parseCards('9c 8d 7h 6s 5c')).title).toBe('Стрит до девятки')
    expect(evaluate(parseCards('Kh Qh 9h 4h 2h')).title).toBe('Флеш до короля')
    expect(evaluate(parseCards('9h 8h 7h 6h 5h')).title).toBe('Стрит-флеш до девятки')
    expect(evaluate(parseCards('Th Jh Qh Kh Ah')).title).toBe('Флеш-рояль')
    // именительный там, где он и нужен
    expect(evaluate(parseCards('Ac Jd 9h 6s 3d')).title).toBe('Старшая карта — туз')
    expect(evaluate(parseCards('Ac Ad Kc 7d 2s')).title).toBe('Пара тузов')
    expect(evaluate(parseCards('9c 9d 9h 6s 5c')).title).toBe('Сет девяток')
    expect(evaluate(parseCards('Kc Kd Kh Ks 5c')).title).toBe('Каре королей')
    expect(evaluate(parseCards('Ac Ad Ah Ks Kd')).title).toBe('Фулл-хаус, тузы на королях')
    expect(evaluate(parseCards('Ac Ad 9h 9s 5c')).title).toBe('Две пары, тузы и девятки')
  })
})

import { describe, it, expect } from 'vitest'
import { linkTerms, termById } from './terms'
import { GLOSSARY } from '../engine/glossary'

describe('связка текста со словарём', () => {
  it('находит термин и оставляет остальной текст нетронутым', () => {
    const segments = linkTerms('Ваше эквити выше порога')
    expect(segments.map((s) => s.text).join('')).toBe('Ваше эквити выше порога')
    const linked = segments.filter((s) => s.id)
    expect(linked.length).toBe(1)
    expect(linked[0].text).toBe('эквити')
    expect(linked[0].id).toBe('math.Эквити')
  })

  /** «Шансы банка» — цельный термин, и он должен выигрывать у «банка»,
   *  иначе ссылка встанет на половину словосочетания. */
  it('длинная форма выигрывает у короткой', () => {
    const segments = linkTerms('Шансы банка 1,7 : 1')
    const linked = segments.filter((s) => s.id)
    expect(linked.length).toBe(1)
    expect(linked[0].text).toBe('Шансы банка')
    expect(linked[0].id).toBe('math.Шансы банка')
  })

  /** Иначе «дро» подсветилось бы внутри «флеш-дро», а «аут» — внутри «аутсайдер». */
  it('не лезет в середину слов', () => {
    expect(linkTerms('флеш-дро').filter((s) => s.id).map((s) => s.id)).toEqual(['hands.Флеш-дро'])
    expect(linkTerms('банкомат').filter((s) => s.id)).toEqual([])
    expect(linkTerms('аутсайдер').filter((s) => s.id)).toEqual([])
  })

  it('отмечает термин только при первом появлении', () => {
    const segments = linkTerms('эквити выше, чем эквити оппонента, — эквити решает')
    expect(segments.filter((s) => s.id).length).toBe(1)
    expect(segments.map((s) => s.text).join('')).toBe('эквити выше, чем эквити оппонента, — эквити решает')
  })

  it('понимает падежи, которые встречаются в текстах приложения', () => {
    for (const text of ['аутов', 'аута', 'ауты', 'колла', 'рейза', 'диапазоне', 'блефом']) {
      expect(linkTerms(text).filter((s) => s.id).length, text).toBe(1)
    }
  })

  it('каждая ссылка ведёт в существующую статью словаря', () => {
    const ids = new Set(GLOSSARY.map((t) => t.id))
    const sample = [
      'Шансы банка 1,7 : 1 — колл окупается',
      'Вы выигрываете в 58,0 % случаев',
      'Руку улучшают 6 карт из 47',
      'Стек больше банка в 9,0 раза (SPR)',
      'Полублеф: у вас флеш-дро, гатшот',
      'Считаем против 20 % лучших рук',
      'После флопа ходите последним всю раздачу',
    ]
    for (const text of sample) {
      for (const segment of linkTerms(text)) {
        if (!segment.id) continue
        expect(ids.has(segment.id), `${segment.text} → ${segment.id}`).toBe(true)
        expect(termById(segment.id)).toBeDefined()
      }
    }
  })

  it('текст без терминов возвращается одним куском', () => {
    const segments = linkTerms('Сегодня хорошая погода')
    expect(segments).toEqual([{ text: 'Сегодня хорошая погода' }])
  })
})

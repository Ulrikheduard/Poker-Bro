import { describe, it, expect } from 'vitest'
import { linkTerms, termById } from './terms'
import { GLOSSARY, searchGlossary } from '../engine/glossary'

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

describe('как карты называются вслух', () => {
  it('диктор читает «Туз пик», а не «A пики»', async () => {
    const { cardSpoken, parseCards } = await import('../engine/cards')
    const [as, td, jc, qh] = parseCards('As Td Jc Qh')
    expect(cardSpoken(as)).toBe('Туз пик')
    expect(cardSpoken(td)).toBe('Десятка бубен')
    expect(cardSpoken(jc)).toBe('Валет треф')
    expect(cardSpoken(qh)).toBe('Дама червей')
  })

  it('у всех 52 карт имя непустое и без латиницы', async () => {
    const { cardSpoken, FULL_DECK } = await import('../engine/cards')
    for (const card of FULL_DECK) {
      const name = cardSpoken(card)
      expect(name.length).toBeGreaterThan(4)
      expect(name).not.toMatch(/[A-Za-z]/)
    }
  })
})

describe('связи словаря', () => {
  it('выведены из текстов, а не размечены руками', async () => {
    const { relationsFor } = await import('./relations')
    const { GLOSSARY } = await import('../engine/glossary')
    // Связь существует тогда и только тогда, когда статья упоминает другую.
    const flop = GLOSSARY.find((t) => t.term === 'Флоп')!
    const rel = relationsFor(flop.id)
    expect(rel.usedIn.length).toBeGreaterThan(0)
    for (const other of rel.usedIn) {
      const text = `${other.definition} ${other.example}`.toLowerCase()
      expect(text).toMatch(/флоп/)
    }
  })

  it('статья не ссылается сама на себя', async () => {
    const { relationsFor } = await import('./relations')
    const { GLOSSARY } = await import('../engine/glossary')
    for (const term of GLOSSARY) {
      const { leansOn, usedIn } = relationsFor(term.id)
      expect(leansOn.some((t) => t.id === term.id)).toBe(false)
      expect(usedIn.some((t) => t.id === term.id)).toBe(false)
    }
  })

  it('связи двусторонние: если А объясняет Б, то Б опирается на А', async () => {
    const { relationsFor } = await import('./relations')
    const { GLOSSARY } = await import('../engine/glossary')
    for (const term of GLOSSARY) {
      for (const other of relationsFor(term.id).leansOn) {
        expect(relationsFor(other.id).usedIn.map((t) => t.id)).toContain(term.id)
      }
    }
  })

  it('граф покрывает словарь, а не пару статей', async () => {
    const { relationsFor } = await import('./relations')
    const { GLOSSARY } = await import('../engine/glossary')
    const connected = GLOSSARY.filter((t) => {
      const r = relationsFor(t.id)
      return r.leansOn.length + r.usedIn.length > 0
    })
    // Без густого графа выбранная структура пустеет — это её условие жизни.
    expect(connected.length / GLOSSARY.length).toBeGreaterThan(0.85)
  })
})

describe('поиск по словарю', () => {
  /** Статья называлась «Номиналы» — слова, которого за столом не говорят.
   *  Ищут её как «натс», и найтись она обязана и по-русски, и по-английски. */
  it('находит натс по названию, по английскому и по словам определения', () => {
    const byTerm = searchGlossary('натс').map((t) => t.id)
    expect(byTerm).toContain('hands.Натс')
    expect(searchGlossary('nuts').map((t) => t.id)).toContain('hands.Натс')
    expect(searchGlossary('сильнейшая').map((t) => t.id)).toContain('hands.Натс')
  })

  /** За столом говорят и «бомб-пот», и «бомпот». Вторая форма живёт
   *  в определении, поэтому поиск находит статью и по ней. */
  it('находит бомб-пот по обоим написаниям', () => {
    expect(searchGlossary('бомб-пот').map((t) => t.id)).toContain('structure.Бомб-пот')
    expect(searchGlossary('бомпот').map((t) => t.id)).toContain('structure.Бомб-пот')
    expect(searchGlossary('bomb').map((t) => t.id)).toContain('structure.Бомб-пот')
  })

  it('пустой запрос отдаёт весь словарь, а раздел его сужает', () => {
    expect(searchGlossary('')).toHaveLength(GLOSSARY.length)
    const hands = searchGlossary('', 'hands')
    expect(hands.length).toBeGreaterThan(0)
    for (const t of hands) expect(t.category).toBe('hands')
  })
})

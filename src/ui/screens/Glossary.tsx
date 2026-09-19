import { useMemo, useState } from 'react'
import {
  type GlossaryCategory, GLOSSARY_CATEGORIES, CATEGORY_TITLE, searchGlossary,
} from '../../engine/glossary'
import { Panel } from '../components/kit'
import { IconChevron } from '../components/icons'
import { Haptics } from '../haptics'

/**
 * Словарь. Термин без примера — половина объяснения, поэтому пример есть
 * у каждого: «флоп» понятен только тогда, когда видно, что на нём бывает.
 */
export function Glossary() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<GlossaryCategory | null>(null)
  const [opened, setOpened] = useState<Set<string>>(new Set())

  const sections = useMemo(() => {
    return GLOSSARY_CATEGORIES
      .filter((c) => category === null || category === c)
      .map((c) => [c, searchGlossary(query, c)] as const)
      .filter(([, items]) => items.length > 0)
  }, [query, category])

  const toggle = (id: string) => {
    Haptics.tap()
    setOpened((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  return (
    <>
      <div className="intro">
        <p className="quiet">
          Сюда ведут все подчёркнутые слова из других разделов. Можно искать
          и по русскому названию, и по английскому, и по словам внутри определения.
        </p>
      </div>

      <input
        className="search"
        type="search"
        value={query}
        placeholder="Термин или слово из определения"
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="strip">
        <button type="button" aria-pressed={category === null} className="press"
          onClick={() => { Haptics.select(); setCategory(null) }}>Все</button>
        {GLOSSARY_CATEGORIES.map((c) => (
          <button key={c} type="button" aria-pressed={category === c} className="press"
            onClick={() => { Haptics.select(); setCategory(category === c ? null : c) }}>
            {CATEGORY_TITLE[c]}
          </button>
        ))}
      </div>

      {sections.length === 0 && (
        <Panel><span style={{ color: 'var(--faint)' }}>Ничего не нашлось по запросу «{query}»</span></Panel>
      )}

      {sections.map(([c, items]) => (
        <Panel key={c} title={CATEGORY_TITLE[c]}>
          <div>
            {items.map((term) => {
              const isOpen = opened.has(term.id)
              return (
                <div className="term" key={term.id}>
                  <button type="button" className="press" onClick={() => toggle(term.id)}>
                    <span className="name">{term.term}</span>
                    <span className="en">{term.english}</span>
                    <span style={{ flex: 1 }} />
                    <span style={{ color: 'var(--faint)', display: 'flex' }}>
                      <IconChevron open={isOpen} size={13} />
                    </span>
                  </button>
                  <span className={'def' + (isOpen ? '' : ' clamped')}>{term.definition}</span>
                  {isOpen && <span className="example appear">{term.example}</span>}
                </div>
              )
            })}
          </div>
        </Panel>
      ))}
    </>
  )
}

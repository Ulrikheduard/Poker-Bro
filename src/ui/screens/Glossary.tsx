import { useCallback, useMemo, useRef, useState } from 'react'
import {
  type GlossaryCategory, type GlossaryTerm,
  GLOSSARY_CATEGORIES, CATEGORY_TITLE, searchGlossary,
} from '../../engine/glossary'
import { relationsFor } from '../relations'
import { Haptics } from '../haptics'

/**
 * Словарь. Единственный раздел, где человек не решает задачу, а читает, —
 * поэтому устроен он как текст, а не как список органов управления.
 *
 * Статья показана целиком: и определение, и пример. Пример раньше прятался
 * за раскрывашкой, хотя именно он и объясняет — «флоп» понятен только тогда,
 * когда видно, что на нём бывает. Тому, кто сел разобраться, каждое нажатие
 * ради следующей строки мешает читать.
 *
 * Под статьёй — её связи: через что она объяснена и что объясняется через неё.
 * Переход по связи не уводит со страницы, а прокручивает к нужной статье
 * в этой же колонке и помечает её: нить читается, не выходя из документа.
 */

/** Хабы вроде «бет» упоминаются два десятка раз: весь список стал бы стеной. */
const MAX_LINKS = 8

function Relation({ label, terms, onJump }: {
  label: string
  terms: GlossaryTerm[]
  onJump: (id: string) => void
}) {
  if (terms.length === 0) return null
  const shown = terms.slice(0, MAX_LINKS)
  const rest = terms.length - shown.length
  return (
    <p className="rel">
      <span className="rel-label">{label}</span>
      {shown.map((t, i) => (
        <span key={t.id}>
          {i > 0 && <span className="rel-sep">·</span>}
          <button type="button" className="rel-link" onClick={() => onJump(t.id)}>{t.term}</button>
        </span>
      ))}
      {rest > 0 && <span className="rel-rest">и ещё {rest}</span>}
    </p>
  )
}

export function Glossary() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<GlossaryCategory | null>(null)
  const [landed, setLanded] = useState<string | null>(null)
  const nodes = useRef(new Map<string, HTMLElement>())

  const sections = useMemo(() => (
    GLOSSARY_CATEGORIES
      .filter((c) => category === null || category === c)
      .map((c) => [c, searchGlossary(query, c)] as const)
      .filter(([, items]) => items.length > 0)
  ), [query, category])

  const found = sections.reduce((sum, [, items]) => sum + items.length, 0)

  /**
   * Переход по связи. Если нужная статья отфильтрована — снимаем фильтры,
   * иначе нажатие просто ничего не сделает, и человек решит, что связь битая.
   */
  const jump = useCallback((id: string) => {
    Haptics.select()
    const scroll = () => {
      const node = nodes.current.get(id)
      if (!node) return
      // Отступ под липкий колонтитул задан в CSS через scroll-margin-top:
      // браузер сам его учтёт, пересчитывать положение руками незачем.
      // «Уменьшить движение» значит не «медленнее», а «без пути» — человек
      // просит поставить на место, а не показывать дорогу.
      const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      node.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' })
      setLanded(id)
      window.setTimeout(() => setLanded((current) => (current === id ? null : current)), 1600)
    }
    if (nodes.current.has(id)) { scroll(); return }
    setQuery('')
    setCategory(null)
    window.requestAnimationFrame(() => window.requestAnimationFrame(scroll))
  }, [])

  return (
    <div className="lexicon">
      <input
        className="search"
        type="search"
        value={query}
        placeholder="Термин, english или слово из определения"
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="strip" role="group" aria-label="Раздел словаря">
        <button type="button" aria-pressed={category === null} className="press"
          onClick={() => { Haptics.select(); setCategory(null) }}>Все</button>
        {GLOSSARY_CATEGORIES.map((c) => (
          <button key={c} type="button" aria-pressed={category === c} className="press"
            onClick={() => { Haptics.select(); setCategory(category === c ? null : c) }}>
            {CATEGORY_TITLE[c]}
          </button>
        ))}
      </div>

      {found === 0 && (
        <p className="nothing">
          {query
            ? <>По запросу «{query}» ничего нет{category !== null && <> в разделе «{CATEGORY_TITLE[category]}»</>}.</>
            : <>В разделе «{category !== null ? CATEGORY_TITLE[category] : ''}» пусто.</>}
          {category !== null && (
            <> <button type="button" className="rel-link" onClick={() => { Haptics.select(); setCategory(null) }}>
              Искать во всём словаре
            </button></>
          )}
        </p>
      )}

      {sections.map(([c, items]) => (
        <section className="chapter" key={c}>
          <h2 className="running-head">{CATEGORY_TITLE[c]}</h2>
          {items.map((term) => {
            const { leansOn, usedIn } = relationsFor(term.id)
            return (
              <article
                key={term.id}
                id={`term-${term.id}`}
                className={'entry' + (landed === term.id ? ' landed' : '')}
                ref={(node) => {
                  if (node) nodes.current.set(term.id, node)
                  else nodes.current.delete(term.id)
                }}
                tabIndex={-1}
              >
                <h3 className="entry-head">
                  <span className="entry-term">{term.term}</span>
                  <span className="entry-en">{term.english}</span>
                </h3>
                <p className="entry-def">{term.definition}</p>
                <p className="entry-example">{term.example}</p>
                <Relation label="через что объяснён" terms={leansOn} onJump={jump} />
                <Relation label="объясняет" terms={usedIn} onJump={jump} />
              </article>
            )
          })}
        </section>
      ))}
    </div>
  )
}

import { useMemo, useState } from 'react'
import {
  type GlossaryCategory,
  GLOSSARY_CATEGORIES, CATEGORY_TITLE, searchGlossary,
} from '../../engine/glossary'
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
 * Ссылок на другие статьи здесь нет. Под каждой статьёй стояла строка соседей,
 * выведенная из текстов, — и она отнимала внимание у самих определений:
 * читаешь словарь, а глаз ведёт по служебной строке. Термины связываются
 * там, где человек встречает незнакомое слово за работой, — в тренажёре,
 * разборе и чартах подчёркнутое слово открывает статью на месте. Внутри
 * словаря он уже пришёл читать, и вести его отсюда некуда.
 */

export function Glossary() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<GlossaryCategory | null>(null)

  const sections = useMemo(() => (
    GLOSSARY_CATEGORIES
      .filter((c) => category === null || category === c)
      .map((c) => [c, searchGlossary(query, c)] as const)
      .filter(([, items]) => items.length > 0)
  ), [query, category])

  const found = sections.reduce((sum, [, items]) => sum + items.length, 0)

  return (
    <div className="lexicon">
      <input
        className="search"
        type="search"
        value={query}
        placeholder="Название, английское слово или слово из определения"
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
            <> <button type="button" className="text-link" onClick={() => { Haptics.select(); setCategory(null) }}>
              Искать во всём словаре
            </button></>
          )}
        </p>
      )}

      {sections.map(([c, items]) => (
        <section className="chapter" key={c}>
          <h2 className="running-head">{CATEGORY_TITLE[c]}</h2>
          {items.map((term) => (
            <article key={term.id} id={`term-${term.id}`} className="entry">
              <h3 className="entry-head">
                <span className="entry-term">{term.term}</span>
                <span className="entry-en">{term.english}</span>
              </h3>
              <p className="entry-def">{term.definition}</p>
              <p className="entry-example">{term.example}</p>
            </article>
          ))}
        </section>
      ))}
    </div>
  )
}

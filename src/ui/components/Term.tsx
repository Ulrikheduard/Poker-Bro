import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { CATEGORY_TITLE } from '../../engine/glossary'
import { linkTerms, termById } from '../terms'
import { Haptics } from '../haptics'

/**
 * Термины в тексте открывают определение прямо на месте. Смысл в том, чтобы
 * не упрощать формулировки до потери точности: «эквити» так и остаётся
 * «эквити», но теперь на него можно нажать и прочитать, что это.
 */

const GlossaryContext = createContext<(id: string) => void>(() => {})

export function GlossaryProvider({ children }: { children: ReactNode }) {
  const [openId, setOpenId] = useState<string | null>(null)
  const open = useCallback((id: string) => { Haptics.tap(); setOpenId(id) }, [])
  const term = openId ? termById(openId) : undefined

  return (
    <GlossaryContext.Provider value={open}>
      {children}
      {term && (
        <div className="sheet-backdrop" onClick={() => setOpenId(null)}
          role="dialog" aria-modal="true" aria-label={term.term}>
          <div className="sheet term-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="grabber" />
            <div className="term-sheet-head">
              <b>{term.term}</b>
              <span className="en">{term.english}</span>
            </div>
            <span className="chip" style={{ color: 'var(--info)', alignSelf: 'flex-start' }}>
              {CATEGORY_TITLE[term.category]}
            </span>
            <p className="def">{term.definition}</p>
            <p className="example">{term.example}</p>
            <button type="button" className="primary press" onClick={() => setOpenId(null)}>
              Понятно
            </button>
          </div>
        </div>
      )}
    </GlossaryContext.Provider>
  )
}

/**
 * Текст с отмеченными терминами. Обычный текст, если ничего не нашлось —
 * никакой разметки и никаких пустых обёрток.
 */
export function Linked({ children, seen }: { children: string; seen?: Set<string> }) {
  const open = useContext(GlossaryContext)
  const segments = useMemo(() => linkTerms(children, seen), [children, seen])
  if (segments.length === 1 && !segments[0].id) return <>{children}</>
  return (
    <>
      {segments.map((segment, index) =>
        segment.id ? (
          <button
            key={index}
            type="button"
            className="term-link"
            onClick={() => open(segment.id!)}
            title={`Что такое «${segment.text}»`}
          >
            {segment.text}
          </button>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </>
  )
}

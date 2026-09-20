import { GLOSSARY, type GlossaryTerm } from '../engine/glossary'
import { linkTerms } from './terms'

/**
 * Связи между статьями словаря.
 *
 * Ничего не размечено руками: связь существует ровно тогда, когда одна статья
 * действительно упоминает другую в своём определении или примере. Разбор делает
 * та же машинка, что подчёркивает термины по всему приложению, — с той же явной
 * таблицей словоформ, без стеммера и без ложных срабатываний.
 *
 * Поэтому список связей не может разойтись с текстами: поправите определение —
 * связи пересоберутся сами. Размеченный руками граф однажды отстал бы, и
 * заметить это было бы нечем.
 */

export interface Relations {
  /** Термины, через которые объяснён этот: они встречаются в его тексте. */
  leansOn: GlossaryTerm[]
  /** Статьи, которые объясняются через этот. */
  usedIn: GlossaryTerm[]
}

const BY_ID = new Map(GLOSSARY.map((t) => [t.id, t]))
/** Порядок внутри списка — тот же, что в словаре: он не алфавитный, а объясняющий. */
const ORDER = new Map(GLOSSARY.map((t, i) => [t.id, i]))

const leansOn = new Map<string, Set<string>>()
const usedIn = new Map<string, Set<string>>()
for (const term of GLOSSARY) {
  leansOn.set(term.id, new Set())
  usedIn.set(term.id, new Set())
}

for (const term of GLOSSARY) {
  // Собственный идентификатор кладём в `seen` заранее: статья не ссылается
  // сама на себя, даже когда называет себя внутри определения.
  const seen = new Set<string>([term.id])
  for (const segment of linkTerms(`${term.definition} ${term.example}`, seen)) {
    if (!segment.id || segment.id === term.id) continue
    if (!BY_ID.has(segment.id)) continue
    leansOn.get(term.id)!.add(segment.id)
    usedIn.get(segment.id)!.add(term.id)
  }
}

const resolve = (ids: Set<string> | undefined): GlossaryTerm[] =>
  [...(ids ?? [])]
    .map((id) => BY_ID.get(id))
    .filter((t): t is GlossaryTerm => t !== undefined)
    .sort((a, b) => (ORDER.get(a.id)! - ORDER.get(b.id)!))

const CACHE = new Map<string, Relations>()

export function relationsFor(id: string): Relations {
  const cached = CACHE.get(id)
  if (cached) return cached
  const value: Relations = { leansOn: resolve(leansOn.get(id)), usedIn: resolve(usedIn.get(id)) }
  CACHE.set(id, value)
  return value
}

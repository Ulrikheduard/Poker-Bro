import { useEffect, useRef, useState } from 'react'
import { Solver } from './screens/Solver'
import { Rankings } from './screens/Rankings'
import { Charts } from './screens/Charts'
import { Glossary } from './screens/Glossary'
import { Trainer } from './screens/Trainer'
import { IconSolver, IconSpade, IconGrid, IconBook, IconTarget } from './components/icons'
import { Haptics } from './haptics'
import { GlossaryProvider } from './components/Term'

const TABS = [
  { id: 'trainer', title: 'Тренажёр', Icon: IconTarget, Screen: Trainer },
  { id: 'rankings', title: 'Комбинации', Icon: IconSpade, Screen: Rankings },
  { id: 'charts', title: 'GTO', Icon: IconGrid, Screen: Charts },
  { id: 'glossary', title: 'Словарь', Icon: IconBook, Screen: Glossary },
  { id: 'solver', title: 'Разбор', Icon: IconSolver, Screen: Solver },
] as const

// Тренажёру шапка не нужна: режим назван переключателем, а заголовок повторял бы
// имя вкладки и съедал высоту, которой на этом экране в обрез.
const BARE = new Set<string>(['trainer'])

export function App() {
  const [tab, setTab] = useState(0)
  const [scrolled, setScrolled] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  // Положение прокрутки у каждой вкладки своё: возвращаясь в «Словарь»,
  // человек ожидает увидеть то место, где остановился, а не начало списка.
  const offsets = useRef<number[]>(TABS.map(() => 0))

  const Current = TABS[tab].Screen
  const bare = BARE.has(TABS[tab].id)

  useEffect(() => {
    const element = scrollRef.current
    if (!element) return
    element.scrollTop = offsets.current[tab] ?? 0
    setScrolled((offsets.current[tab] ?? 0) > 4)
  }, [tab])

  return (
    <GlossaryProvider>
      <div className={'app' + (bare ? ' bare' : '')}>
        {!bare && (
          <header className={'header' + (scrolled ? ' scrolled' : '')}>
            <h1>{TABS[tab].title}</h1>
          </header>
        )}

        <div
          className="scroll"
          ref={scrollRef}
          onScroll={(e) => {
            const top = e.currentTarget.scrollTop
            offsets.current[tab] = top
            const next = top > 4
            setScrolled((was) => (was === next ? was : next))
          }}
        >
          <main
            className="content"
            // Вкладка объявляла себя вкладкой и вела в никуда: панели, которой
            // она управляет, в разметке не было.
            role="tabpanel"
            id={`panel-${TABS[tab].id}`}
            aria-labelledby={`tab-${TABS[tab].id}`}
          >
            <Current />
          </main>
        </div>

        <nav className="tabbar" role="tablist">
          {TABS.map((item, index) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`tab-${item.id}`}
              aria-controls={`panel-${item.id}`}
              aria-selected={tab === index}
              // Обход стрелками, а не по всем пяти кнопкам: так устроен
              // набор вкладок, и Switch Control этого ждёт.
              tabIndex={tab === index ? 0 : -1}
              onKeyDown={(e) => {
                const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
                if (step === 0) return
                e.preventDefault()
                const next = (index + step + TABS.length) % TABS.length
                Haptics.select()
                setTab(next)
                document.getElementById(`tab-${TABS[next].id}`)?.focus()
              }}
              onClick={() => {
                if (tab === index) {
                  // Повторное нажатие по активной вкладке возвращает наверх —
                  // так же, как в родных приложениях.
                  scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
                  offsets.current[index] = 0
                  return
                }
                Haptics.select()
                setTab(index)
              }}
            >
              <item.Icon />
              {item.title}
            </button>
          ))}
        </nav>
      </div>
    </GlossaryProvider>
  )
}

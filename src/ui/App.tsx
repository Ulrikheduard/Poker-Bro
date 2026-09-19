import { useEffect, useRef, useState } from 'react'
import { Solver } from './screens/Solver'
import { Rankings } from './screens/Rankings'
import { Charts } from './screens/Charts'
import { Glossary } from './screens/Glossary'
import { Trainer } from './screens/Trainer'
import { IconSolver, IconSpade, IconGrid, IconBook, IconTarget } from './components/icons'
import { Haptics } from './haptics'

const TABS = [
  { id: 'solver', title: 'Разбор', Icon: IconSolver, Screen: Solver },
  { id: 'rankings', title: 'Комбинации', Icon: IconSpade, Screen: Rankings },
  { id: 'charts', title: 'Чарты', Icon: IconGrid, Screen: Charts },
  { id: 'glossary', title: 'Словарь', Icon: IconBook, Screen: Glossary },
  { id: 'trainer', title: 'Тренажёр', Icon: IconTarget, Screen: Trainer },
] as const

export function App() {
  const [tab, setTab] = useState(0)
  const [scrolled, setScrolled] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  // Положение прокрутки у каждой вкладки своё: возвращаясь в «Словарь»,
  // человек ожидает увидеть то место, где остановился, а не начало списка.
  const offsets = useRef<number[]>(TABS.map(() => 0))

  const Current = TABS[tab].Screen

  useEffect(() => {
    const element = scrollRef.current
    if (!element) return
    element.scrollTop = offsets.current[tab] ?? 0
    setScrolled((offsets.current[tab] ?? 0) > 4)
  }, [tab])

  return (
    <div className="app">
      <header className={'header' + (scrolled ? ' scrolled' : '')}>
        <h1>{TABS[tab].title}</h1>
      </header>

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
        <main className="content">
          <Current />
        </main>
      </div>

      <nav className="tabbar" role="tablist">
        {TABS.map((item, index) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === index}
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
  )
}

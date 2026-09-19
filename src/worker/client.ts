import type { SpotInput, SpotAnalysis } from '../engine/advice'
import type { Request, Response } from './equity.worker'

/**
 * Обёртка над потоком расчёта. Запросы нумеруются, и ответ принимается только
 * от последнего: пока считается флоп, человек успевает положить тёрн, и ответ
 * на устаревший вопрос показывать нельзя.
 */
export class EquityClient {
  private worker: Worker
  private nextId = 1
  private pending = new Map<number, { resolve: (a: SpotAnalysis) => void; reject: (e: Error) => void }>()

  constructor() {
    this.worker = new Worker(new URL('./equity.worker.ts', import.meta.url), { type: 'module' })
    this.worker.onmessage = (event: MessageEvent<Response>) => {
      const entry = this.pending.get(event.data.id)
      if (!entry) return
      this.pending.delete(event.data.id)
      if (event.data.ok) entry.resolve(event.data.analysis)
      else entry.reject(new Error(event.data.error))
    }
  }

  analyse(input: SpotInput, iterations: number): { promise: Promise<SpotAnalysis>; cancel: () => void } {
    const id = this.nextId++
    const promise = new Promise<SpotAnalysis>((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.worker.postMessage({ id, input, iterations } satisfies Request)
    })
    // Отменить сам счёт в потоке нельзя, но можно перестать ждать ответа:
    // поток досчитает и выбросит результат в пустоту.
    return { promise, cancel: () => this.pending.delete(id) }
  }
}

/// <reference lib="webworker" />
import { analyseSpot, type SpotInput, type SpotAnalysis } from '../engine/advice'

/**
 * Расчёт живёт в отдельном потоке. Точный перебор флопа — это около миллиона
 * досок; в главном потоке он подвесил бы интерфейс ровно в тот момент, когда
 * человек кладёт карту, и приложение выглядело бы сломанным.
 */

export interface Request { id: number; input: SpotInput; iterations: number }
export type Response =
  | { id: number; ok: true; analysis: SpotAnalysis }
  | { id: number; ok: false; error: string }

self.onmessage = (event: MessageEvent<Request>) => {
  const { id, input, iterations } = event.data
  try {
    const analysis = analyseSpot(input, iterations)
    ;(self as unknown as Worker).postMessage({ id, ok: true, analysis } satisfies Response)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не удалось посчитать'
    ;(self as unknown as Worker).postMessage({ id, ok: false, error: message } satisfies Response)
  }
}

import { describe, it, expect } from 'vitest'
import { parseCards } from './cards'
import {
  evaluate, score, HIGH_CARD, PAIR, TWO_PAIR, TRIPS, STRAIGHT,
  FLUSH, FULL_HOUSE, QUADS, STRAIGHT_FLUSH,
} from './evaluator'

const value = (text: string) => evaluate(parseCards(text))

describe('оценщик комбинаций', () => {
  it('различает все девять категорий', () => {
    expect(value('Ah Kh Qh Jh Th').category).toBe(STRAIGHT_FLUSH)
    expect(value('9c 9d 9h 9s Kd').category).toBe(QUADS)
    expect(value('9c 9d 9h 2s 2c').category).toBe(FULL_HOUSE)
    expect(value('Ah 9h 7h 4h 2h').category).toBe(FLUSH)
    expect(value('9c 8d 7h 6s 5c').category).toBe(STRAIGHT)
    expect(value('9c 9d 9h 6s 5c').category).toBe(TRIPS)
    expect(value('9c 9d 6h 6s 5c').category).toBe(TWO_PAIR)
    expect(value('9c 9d 8h 6s 5c').category).toBe(PAIR)
    expect(value('Ac 9d 8h 6s 5c').category).toBe(HIGH_CARD)
  })

  it('колесо A2345 — самый младший стрит, старшая карта в нём пятёрка', () => {
    const wheel = value('Ah 2c 3d 4h 5s')
    expect(wheel.category).toBe(STRAIGHT)
    expect(wheel.ranks[0]).toBe(5)
    expect(wheel.score).toBeLessThan(value('2c 3d 4h 5s 6c').score)

    const steel = value('Ah 2h 3h 4h 5h')
    expect(steel.category).toBe(STRAIGHT_FLUSH)
    expect(steel.score).toBeLessThan(value('2h 3h 4h 5h 6h').score)
  })

  it('туз не подрабатывает единицей вне стрита', () => {
    const hand = value('Ah 2c 3d 4h 6s')
    expect(hand.category).toBe(HIGH_CARD)
    expect(hand.ranks[0]).toBe(14)
  })

  it('спор решают кикеры, а масть — никогда', () => {
    expect(value('Ah Ad Kc 7d 2s').score).toBeGreaterThan(value('Ac As Qc 7d 2s').score)
    expect(value('Kh Kd 9c 9d As').score).toBeGreaterThan(value('Kc Ks 9h 9s Qd').score)
    expect(value('Ah Ad Kc 7d 2s').score).toBe(value('As Ac Kd 7h 2c').score)
  })

  it('из семи карт выбирает лучшую пятёрку', () => {
    expect(value('2c 7d Ah Kh Qh Jh Th').category).toBe(STRAIGHT_FLUSH)
    const full = value('9c 9d 9h 2s 2c 3d 4h')
    expect(full.category).toBe(FULL_HOUSE)
    expect(full.ranks).toEqual([9, 2])
  })

  it('два сета дают фулл-хаус по старшему', () => {
    const hand = value('9c 9d 9h 7s 7c 7d 2h')
    expect(hand.category).toBe(FULL_HOUSE)
    expect(hand.ranks).toEqual([9, 7])
  })

  /**
   * Исчерпывающая проверка порта: все 2 598 960 пятикарточных рук разложены
   * по категориям, и число рук в каждой — известная величина. Нативная версия
   * проходит ровно эту же сверку теми же числами; совпадение здесь означает,
   * что перенос на TypeScript ничего не сломал.
   */
  it('все 2 598 960 пятикарточных рук совпадают с известными числами', () => {
    const counts = new Array(9).fill(0)
    const buffer = new Int32Array(5)
    for (let a = 0; a < 52; a++) {
      buffer[0] = a
      for (let b = a + 1; b < 52; b++) {
        buffer[1] = b
        for (let c = b + 1; c < 52; c++) {
          buffer[2] = c
          for (let d = c + 1; d < 52; d++) {
            buffer[3] = d
            for (let e = d + 1; e < 52; e++) {
              buffer[4] = e
              counts[score(buffer, 5) >> 20]++
            }
          }
        }
      }
    }
    expect(counts[STRAIGHT_FLUSH]).toBe(40)
    expect(counts[QUADS]).toBe(624)
    expect(counts[FULL_HOUSE]).toBe(3_744)
    expect(counts[FLUSH]).toBe(5_108)
    expect(counts[STRAIGHT]).toBe(10_200)
    expect(counts[TRIPS]).toBe(54_912)
    expect(counts[TWO_PAIR]).toBe(123_552)
    expect(counts[PAIR]).toBe(1_098_240)
    expect(counts[HIGH_CARD]).toBe(1_302_540)
    expect(counts.reduce((x: number, y: number) => x + y, 0)).toBe(2_598_960)
  }, 60_000)
})

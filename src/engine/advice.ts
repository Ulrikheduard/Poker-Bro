import { type Card } from './cards'
import { evaluate } from './evaluator'
import { type EquityResult, type OpponentModel, calculateEquity } from './equity'
import { type DrawAnalysis, analyseDraws } from './draws'
import { type BoardTexture, readBoard } from './texture'
import { type HandRange, rangePercentage } from './range'
import { compactRange } from './notation'
import {
  type PotOdds, potOdds, requiredEquity, oddsRatio, callEV, impliedOddsNeeded,
  frequencies, bluffBreakEven, minimumDefence, bluffToValue, bluffShare,
  quickEquity, exactOutsEquity,
} from './odds'

export type Street = 'preflop' | 'flop' | 'turn' | 'river'

export const STREET_TITLE: Record<Street, string> = {
  preflop: 'Префлоп', flop: 'Флоп', turn: 'Тёрн', river: 'Ривер',
}

export const streetFor = (boardCount: number): Street =>
  boardCount <= 2 ? 'preflop' : boardCount === 3 ? 'flop' : boardCount === 4 ? 'turn' : 'river'

export type AdviceAction = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'allIn'

export const ACTION_TITLE: Record<AdviceAction, string> = {
  fold: 'Фолд', check: 'Чек', call: 'Колл', bet: 'Ставка', raise: 'Рейз', allIn: 'Олл-ин',
}

export type AdviceStrength = 'clear' | 'close' | 'marginal'
export const STRENGTH_TITLE: Record<AdviceStrength, string> = {
  clear: 'уверенно', close: 'с запасом', marginal: 'на грани',
}

/**
 * Рекомендация. Разделена намеренно: числа в `reasons` посчитаны и не
 * обсуждаются, а сам вывод — уже упрощение, где начинается допущение
 * о диапазоне оппонента.
 */
export interface Advice {
  action: AdviceAction
  strength: AdviceStrength
  headline: string
  reasons: string[]
  /** Рекомендуемый размер, если действие агрессивное. Доля банка. */
  sizing: number | null
}

export interface SpotInput {
  hole: Card[]
  board: Card[]
  pot: number
  /** Сколько нужно доколлировать. Ноль — перед вами не ставили. */
  toCall: number
  effectiveStack: number
  opponents: number
  opponentRange: HandRange | null
}

export interface SpotAnalysis {
  equity: EquityResult
  potOdds: PotOdds
  draw: DrawAnalysis | null
  texture: BoardTexture | null
  advice: Advice
  street: Street
  /** Отношение стека к банку. Ниже трёх фишки заезжают в банк почти всегда. */
  spr: number
  assumption: string
  /**
   * Лучшая пятёрка целиком лежит на столе, и карты в руке к ней ничего
   * не добавляют. Тогда у всех, кто дошёл до вскрытия, одна и та же рука,
   * и банк делится. Определяется точно, а не по высокой доле ничьих:
   * сравниваем силу доски с силой руки вместе с доской.
   */
  boardPlays: boolean
}

const pct = (v: number, digits = 1) => v.toFixed(digits).replace('.', ',') + ' %'
const percent = (v: number, digits = 1) => pct(v * 100, digits)
/** «6 карт», «2 карты», «21 карта» — русские окончания. */
const outsEnding = (n: number): string => {
  const last = n % 10, tens = n % 100
  if (tens >= 11 && tens <= 14) return ''
  if (last === 1) return 'а'
  if (last >= 2 && last <= 4) return 'ы'
  return ''
}

const chips = (v: number) => {
  const r = Math.round(v * 10) / 10
  return Number.isInteger(r) ? String(r) : r.toFixed(1).replace('.', ',')
}

export function analyseSpot(input: SpotInput, iterations = 80_000): SpotAnalysis {
  const model: OpponentModel = input.opponentRange
    ? { kind: 'range', range: input.opponentRange }
    : { kind: 'random' }

  const equity = calculateEquity(
    { hero: input.hole, board: input.board, opponents: input.opponents, model },
    iterations,
  )
  const odds = potOdds(input.pot, input.toCall)
  const draw = analyseDraws(input.hole, input.board)
  const texture = readBoard(input.board)
  const street = streetFor(input.board.length)
  const spr = input.pot > 0 ? input.effectiveStack / input.pot : 0
  const boardPlays = input.board.length === 5
    && evaluate(input.board).score === evaluate([...input.hole, ...input.board]).score

  let assumption: string
  if (input.opponentRange) {
    assumption = `Считаем против ${Math.round(rangePercentage(input.opponentRange))} % лучших рук: ${compactRange(input.opponentRange)}`
  } else if (input.opponents === 1) {
    assumption = 'Считаем против случайных карт. Осторожный игрок держит руки сильнее — против него ваши шансы будут ниже'
  } else {
    assumption = `Считаем против ${input.opponents} оппонентов со случайными картами`
  }

  const advice = decide(input, equity, odds, draw, texture, street, spr, boardPlays)
  return { equity, potOdds: odds, draw, texture, advice, street, spr, assumption, boardPlays }
}

function decide(
  input: SpotInput, equity: EquityResult, odds: PotOdds,
  draw: DrawAnalysis | null, texture: BoardTexture | null, street: Street, spr: number,
  boardPlays: boolean,
): Advice {
  const e = equity.equity
  const reasons: string[] = []

  // Про делёжку говорим первой строкой: это не оттенок расчёта, а другой
  // характер раздачи, и объяснять его после шансов банка поздно.
  if (boardPlays) {
    reasons.push('Играет доска: лучшие пять карт лежат на столе, и ваши две ничего к ним не добавляют — такая же рука у всех, кто дойдёт до вскрытия')
  } else if (equity.tie >= 0.05) {
    reasons.push(`Банк делится в ${percent(equity.tie)} случаев: руки равны по силе, а масть в холдеме ничего не решает`)
  }

  // ── Перед нами поставили: решает арифметика, а не ощущение ──
  if (odds.toCall > 0) {
    const need = requiredEquity(odds)
    const ev = callEV(odds, e)
    reasons.push(`Шансы банка ${oddsRatio(odds)} — колл окупается, если такая раздача выигрывается хотя бы в ${percent(need)} случаев`)
    reasons.push(`Вы выигрываете в ${percent(e)} случаев: это на ${percent(Math.abs(e - need))} ${e >= need ? 'выше' : 'ниже'} порога`)
    reasons.push(`В среднем такой колл приносит ${ev >= 0 ? '+' : ''}${chips(ev)} за раздачу`)

    if (draw && street !== 'river' && draw.strongOuts > 0) {
      const toCome = street === 'flop' ? 2 : 1
      const exact = exactOutsEquity(draw.totalOuts, draw.unseen, toCome)
      reasons.push(
        `Руку улучшают ${draw.totalOuts} карт${outsEnding(draw.totalOuts)} из ${draw.unseen} — это ${percent(exact)}. ` +
        `По правилу ${toCome === 2 ? '4' : '2'} в уме вышло бы ${percent(quickEquity(draw.totalOuts, toCome))}`,
      )
    }

    // Рейз на значение — когда эквити велико настолько, что платить нам будут
    // руками хуже: иначе рейз только прогоняет проигравших.
    if (e >= 0.68) {
      return {
        action: 'raise', strength: e >= 0.78 ? 'clear' : 'close',
        headline: `Рейз: вы впереди в ${percent(e)} случаев, а хватило бы ${percent(need)}`,
        reasons, sizing: (texture?.wetness ?? 0.3) > 0.5 ? 0.75 : 0.6,
      }
    }
    if (e >= need + 0.05) {
      return {
        action: 'call', strength: 'clear',
        headline: `Колл: шансов на ${percent(e - need)} больше, чем нужно`,
        reasons, sizing: null,
      }
    }
    if (e >= need) {
      return {
        action: 'call', strength: 'marginal',
        headline: `Колл на грани: всего на ${percent(e - need)} выше порога`,
        reasons: [...reasons, 'Здесь расчёт уже почти ничего не решает — важнее импл-оддсы и то, насколько понятен оппонент'],
        sizing: null,
      }
    }
    // Не хватает сейчас — но если стеки глубокие, добор может окупить колл.
    const needed = impliedOddsNeeded(odds, e)
    if (street !== 'river' && needed > 0 && needed <= input.effectiveStack * 0.6 && draw && draw.strongOuts >= 8) {
      reasons.push(`Прямых шансов не хватает, но если доедете — на следующих улицах надо выиграть ещё ${chips(needed)}, и колл выйдет в ноль`)
      return {
        action: 'call', strength: 'marginal',
        headline: 'Колл в расчёте на будущие ставки',
        reasons, sizing: null,
      }
    }
    return {
      action: 'fold', strength: e < need - 0.1 ? 'clear' : 'close',
      headline: `Фолд: не хватает ${percent(need - e)} до окупаемости`,
      reasons, sizing: null,
    }
  }

  // ── Перед нами не ставили ──
  if (boardPlays && equity.tie >= 0.95) {
    return {
      action: 'check', strength: 'clear',
      headline: 'Чек: банк почти наверняка разделится',
      reasons: [...reasons, 'Ставить не с чем и не за чем: улучшить руку нельзя, а заплатят вам только с рукой сильнее — то есть никогда'],
      sizing: null,
    }
  }

  const wetness = texture?.wetness ?? 0.3
  const size = wetness > 0.55 ? 0.75 : wetness > 0.25 ? 0.6 : 0.33
  const freq = frequencies(odds.pot * size, odds.pot)
  reasons.push(`Вы выигрываете в ${percent(e)} случаев ${input.opponents === 1 ? 'против одного оппонента' : `против ${input.opponents} оппонентов`}`)
  if (texture) reasons.push(`Доска ${texture.summary} — под неё подходит ставка в ${Math.round(size * 100)} % банка`)
  reasons.push(`Такая ставка окупится даже блефом, если оппонент сбросит хотя бы в ${percent(bluffBreakEven(freq))} случаев`)
  reasons.push(`Чтобы ваши ставки не стали выгодными с любыми картами, оппоненту нужно продолжать с ${percent(minimumDefence(freq))} своих рук`)
  if (street === 'river') {
    reasons.push(`Баланс на ривере: на каждую ставку с сильной рукой — ${bluffToValue(freq)} блефа, то есть ${percent(bluffShare(freq))} ваших ставок здесь должны быть блефом`)
  }
  if (spr > 0) {
    const hint = spr < 3 ? 'весь стек уедет в банк за одну-две ставки'
      : spr > 10 ? 'глубоко — есть смысл играть на импл-оддсы' : 'средняя глубина'
    reasons.push(`Стек больше банка в ${spr.toFixed(1).replace('.', ',')} раза (SPR) — ${hint}`)
  }

  if (e >= 0.65) {
    return {
      action: 'bet', strength: 'clear',
      headline: `Ставка: вы впереди в ${percent(e)} случаев, пора забирать деньги`,
      reasons, sizing: size,
    }
  }
  if (draw && draw.strongOuts >= 8 && street !== 'river') {
    return {
      action: 'bet', strength: 'close',
      headline: `Полублеф: у вас ${draw.summary}`,
      reasons: [...reasons, 'Такая ставка выигрывает двумя способами: оппонент сбросит сейчас — или вы доедете позже'],
      sizing: size,
    }
  }
  if (e >= 0.5) {
    return {
      action: 'check', strength: 'close',
      headline: 'Чек: рука неплохая, но заплатят вам в основном те, кто сильнее',
      reasons, sizing: null,
    }
  }
  return {
    action: 'check', strength: 'clear',
    headline: `Чек: с ${percent(e)} ставить рано`,
    reasons, sizing: null,
  }
}

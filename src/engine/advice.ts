import { type Card } from './cards'
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
}

const pct = (v: number, digits = 1) => v.toFixed(digits).replace('.', ',') + ' %'
const percent = (v: number, digits = 1) => pct(v * 100, digits)
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

  let assumption: string
  if (input.opponentRange) {
    assumption = `Против диапазона ${compactRange(input.opponentRange)} — ${Math.round(rangePercentage(input.opponentRange))} % рук`
  } else if (input.opponents === 1) {
    assumption = 'Против одной случайной руки — верхняя оценка неопределённости'
  } else {
    assumption = `Против ${input.opponents} случайных рук`
  }

  const advice = decide(input, equity, odds, draw, texture, street, spr)
  return { equity, potOdds: odds, draw, texture, advice, street, spr, assumption }
}

function decide(
  input: SpotInput, equity: EquityResult, odds: PotOdds,
  draw: DrawAnalysis | null, texture: BoardTexture | null, street: Street, spr: number,
): Advice {
  const e = equity.equity
  const reasons: string[] = []

  // ── Перед нами поставили: решает арифметика, а не ощущение ──
  if (odds.toCall > 0) {
    const need = requiredEquity(odds)
    const ev = callEV(odds, e)
    reasons.push(`Шансы банка ${oddsRatio(odds)}: колл окупается от ${percent(need)} эквити`)
    reasons.push(`Ваше эквити ${percent(e)} — ${e >= need ? 'выше' : 'ниже'} порога на ${percent(Math.abs(e - need))}`)
    reasons.push(`Матожидание колла ${ev >= 0 ? '+' : ''}${chips(ev)} в банк ${chips(odds.pot)}`)

    if (draw && street !== 'river' && draw.strongOuts > 0) {
      const toCome = street === 'flop' ? 2 : 1
      const exact = exactOutsEquity(draw.totalOuts, draw.unseen, toCome)
      reasons.push(
        `Аутов ${draw.totalOuts} из ${draw.unseen} — попадание ${percent(exact)}, ` +
        `по правилу ${toCome === 2 ? '4' : '2'} было бы ${percent(quickEquity(draw.totalOuts, toCome))}`,
      )
    }

    // Рейз на значение — когда эквити велико настолько, что платить нам будут
    // руками хуже: иначе рейз только прогоняет проигравших.
    if (e >= 0.68) {
      return {
        action: 'raise', strength: e >= 0.78 ? 'clear' : 'close',
        headline: `Рейз на значение — ${percent(e)} против ${percent(need)} требуемых`,
        reasons, sizing: (texture?.wetness ?? 0.3) > 0.5 ? 0.75 : 0.6,
      }
    }
    if (e >= need + 0.05) {
      return {
        action: 'call', strength: 'clear',
        headline: `Колл — эквити с запасом ${percent(e - need)}`,
        reasons, sizing: null,
      }
    }
    if (e >= need) {
      return {
        action: 'call', strength: 'marginal',
        headline: `Колл на грани — эквити всего на ${percent(e - need)} выше порога`,
        reasons: [...reasons, 'На грани решает не расчёт, а импл-оддсы и то, насколько читаем оппонент'],
        sizing: null,
      }
    }
    // Не хватает сейчас — но если стеки глубокие, добор может окупить колл.
    const needed = impliedOddsNeeded(odds, e)
    if (street !== 'river' && needed > 0 && needed <= input.effectiveStack * 0.6 && draw && draw.strongOuts >= 8) {
      reasons.push(`Чтобы колл вышел в ноль, на следующих улицах нужно добрать ещё ${chips(needed)}`)
      return {
        action: 'call', strength: 'marginal',
        headline: 'Колл только на импл-оддсах — прямых шансов не хватает',
        reasons, sizing: null,
      }
    }
    return {
      action: 'fold', strength: e < need - 0.1 ? 'clear' : 'close',
      headline: `Фолд — не хватает ${percent(need - e)} эквити`,
      reasons, sizing: null,
    }
  }

  // ── Перед нами не ставили ──
  const wetness = texture?.wetness ?? 0.3
  const size = wetness > 0.55 ? 0.75 : wetness > 0.25 ? 0.6 : 0.33
  const freq = frequencies(odds.pot * size, odds.pot)
  reasons.push(`Эквити ${percent(e)} ${input.opponents === 1 ? 'против одного оппонента' : `против ${input.opponents} оппонентов`}`)
  if (texture) reasons.push(`Доска ${texture.summary} — размер ${Math.round(size * 100)} % банка`)
  reasons.push(`Ставка ${Math.round(size * 100)} % требует ${percent(bluffBreakEven(freq))} фолдов, чтобы блеф окупился сам`)
  reasons.push(`Оппонент обязан защищать ${percent(minimumDefence(freq))} диапазона, иначе ставка любыми двумя картами прибыльна`)
  if (street === 'river') {
    reasons.push(`Баланс на ривере: блеф к значению ${bluffToValue(freq)} — это ${percent(bluffShare(freq))} блефа в ставке`)
  }
  if (spr > 0) {
    const hint = spr < 3 ? 'стек заезжает в банк за одну-две ставки'
      : spr > 10 ? 'глубоко, играем на импл-оддсы' : 'средняя глубина'
    reasons.push(`SPR ${spr.toFixed(1).replace('.', ',')} — ${hint}`)
  }

  if (e >= 0.65) {
    return { action: 'bet', strength: 'clear', headline: `Ставка на значение — ${percent(e)}`, reasons, sizing: size }
  }
  if (draw && draw.strongOuts >= 8 && street !== 'river') {
    return {
      action: 'bet', strength: 'close',
      headline: `Полублеф — ${draw.summary}`,
      reasons: [...reasons, 'Ставка выигрывает двумя способами: оппонент сбрасывает сейчас или вы доезжаете позже'],
      sizing: size,
    }
  }
  if (e >= 0.5) {
    return {
      action: 'check', strength: 'close',
      headline: 'Чек — рука впереди, но платить будут только лучшие руки',
      reasons, sizing: null,
    }
  }
  return {
    action: 'check', strength: 'clear',
    headline: `Чек — ${percent(e)} эквити не хватает на ставку`,
    reasons, sizing: null,
  }
}

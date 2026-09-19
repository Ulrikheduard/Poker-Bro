/**
 * Шансы банка и производные от них частоты.
 *
 * Всё в этом файле — арифметика, а не «стратегия»: числа не зависят
 * ни от оппонента, ни от чтения руки, и спорить с ними нельзя.
 * Именно они и есть тот кусок GTO, который считается точно.
 */

export interface PotOdds {
  /** Банк до вашего колла — то есть уже вместе со ставкой оппонента. */
  pot: number
  /** Сколько нужно доложить. */
  toCall: number
}

export const potOdds = (pot: number, toCall: number): PotOdds => ({
  pot: Math.max(pot, 0),
  toCall: Math.max(toCall, 0),
})

/** Эквити, начиная с которого колл не убыточен: платим `toCall`, чтобы выиграть `pot + toCall`. */
export function requiredEquity(o: PotOdds): number {
  const denominator = o.pot + o.toCall
  return denominator > 0 ? o.toCall / denominator : 0
}

/** «3,5 к 1» — привычная за столом форма того же числа. */
export function oddsRatio(o: PotOdds): string {
  if (o.toCall <= 0) return '—'
  return (o.pot / o.toCall).toFixed(1).replace('.', ',') + ' : 1'
}

/** Матожидание колла при данном эквити, в фишках. */
export const callEV = (o: PotOdds, equity: number): number =>
  equity * o.pot - (1 - equity) * o.toCall

/**
 * Сколько ещё нужно выиграть на следующих улицах, чтобы колл вышел в ноль.
 * Отрицательное значение означает, что колл прибылен и без будущих ставок.
 */
export function impliedOddsNeeded(o: PotOdds, equity: number): number {
  if (equity <= 0 || equity >= 1) return 0
  return (o.toCall - equity * (o.pot + o.toCall)) / equity
}

/**
 * Частоты, которые делают оппонента безразличным. Это и есть смысл слова GTO
 * там, где его можно посчитать на салфетке: не «правильная рука»,
 * а правильная доля рук.
 */
export interface Frequencies {
  /** Размер ставки. */
  bet: number
  /** Банк ДО ставки. */
  pot: number
}

export const frequencies = (bet: number, pot: number): Frequencies => ({
  bet: Math.max(bet, 0),
  pot: Math.max(pot, 0),
})

/** Доля банка: ставка 50 в банк 100 — это 0,5. */
export const sizing = (f: Frequencies): number => (f.pot > 0 ? f.bet / f.pot : 0)

/**
 * Сколько фолдов нужно блефу, чтобы он окупился сам по себе.
 * Ставка в размер банка требует 50 %: рискуем банком, чтобы выиграть банк.
 */
export function bluffBreakEven(f: Frequencies): number {
  const denominator = f.pot + f.bet
  return denominator > 0 ? f.bet / denominator : 0
}

/**
 * Минимальная защита: реже этого сбрасывать нельзя, иначе ставка любыми
 * двумя картами станет прибыльной сама по себе. Обратная сторона той же дроби.
 */
export function minimumDefence(f: Frequencies): number {
  const denominator = f.pot + f.bet
  return denominator > 0 ? f.pot / denominator : 1
}

/**
 * Какую долю в ставке должен занимать блеф, чтобы колл оппонента был ровно
 * безубыточен. На ривере ставка в банк — это треть блефа.
 */
export function bluffShare(f: Frequencies): number {
  const denominator = f.pot + 2 * f.bet
  return denominator > 0 ? f.bet / denominator : 0
}

/** «1 блеф на 2 руки на значение» — та же доля в форме, которую проще удержать в голове. */
export function bluffToValue(f: Frequencies): string {
  const share = bluffShare(f)
  if (share <= 0 || share >= 1) return '—'
  const perValue = share / (1 - share)
  return '1 : ' + (1 / perValue).toFixed(1).replace('.', ',')
}

/**
 * Правило 2 и 4 — прикидка в уме. Переоценивает при большом числе аутов,
 * поэтому рядом всегда стоит точное значение, а не вместо него.
 */
export function quickEquity(outs: number, cardsToCome: number): number {
  if (outs <= 0) return 0
  return Math.min((outs * (cardsToCome >= 2 ? 4 : 2)) / 100, 1)
}

/** Точная вероятность попасть хотя бы один раз. */
export function exactOutsEquity(outs: number, unseen: number, cardsToCome: number): number {
  if (outs <= 0 || unseen <= 0 || cardsToCome <= 0) return 0
  let miss = 1
  for (let i = 0; i < cardsToCome; i++) {
    const remaining = unseen - i
    if (remaining <= 0) break
    miss *= (unseen - outs - i) / remaining
  }
  return 1 - miss
}

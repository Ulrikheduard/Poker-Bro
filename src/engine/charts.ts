import { type HandRange, rangeSubtract, rangePercentage, rangeUnion } from './range'
import { parseRange } from './notation'

/**
 * Справочные префлоп-чарты для шестимаксового стола со стеками 100 больших
 * блайндов. Извлечены из нативной версии дословно — диапазоны в двух
 * приложениях обязаны совпадать.
 *
 * Это не выход солвера, и выдавать их за него нечестно: настоящее GTO-решение
 * смешивает действия с частотами («3-бет 34 % времени»), а здесь у каждой руки
 * один ответ. Такие чарты и учат по ним же — они близки к решению и, в отличие
 * от него, запоминаются.
 */

export type Position = 'utg' | 'hj' | 'co' | 'btn' | 'sb' | 'bb'
export const POSITIONS: Position[] = ['utg', 'hj', 'co', 'btn', 'sb', 'bb']

export const POSITION_CODE: Record<Position, string> = {
  utg: 'UTG',
  hj: 'HJ',
  co: 'CO',
  btn: 'BTN',
  sb: 'SB',
  bb: 'BB',
}

export const POSITION_TITLE: Record<Position, string> = {
  utg: 'Ранняя (UTG)',
  hj: 'Хайджек (HJ)',
  co: 'Катофф (CO)',
  btn: 'Баттон (BTN)',
  sb: 'Малый блайнд (SB)',
  bb: 'Большой блайнд (BB)',
}

export const POSITION_HINT: Record<Position, string> = {
  utg: 'Вы ходите первым, после вас — ещё пятеро. Поэтому входим только с самыми сильными руками.',
  hj: 'После вас ходят четверо. Рук, с которыми стоит входить, чуть больше, чем в ранней позиции.',
  co: 'После вас ходят трое. Можно входить заметно шире.',
  btn: 'После флопа вы ходите последним до конца раздачи. Это лучшее место за столом, и рук здесь больше всего.',
  sb: 'Часть денег уже поставлена, но после флопа вы ходите первым. Либо повышаем, либо сбрасываем — просто уравнивать здесь не стоит.',
  bb: 'Вы уже поставили больше всех, поэтому защищаете свою ставку широко. Но после флопа ходите первым.',
}

export type PreflopAction = 'raise' | 'call' | 'fold'
export const ACTION_TITLE: Record<PreflopAction, string> = {
  raise: 'Рейз', call: 'Колл', fold: 'Фолд',
}

/**
 * То же действие обычными словами. Термин остаётся термином — за столом
 * говорят «рейз», и подменять его «повышением» значит учить не тому языку, —
 * но человеку, который слышит слово впервые, нужен перевод рядом,
 * а не в словаре через два нажатия.
 */
export const ACTION_PLAIN: Record<PreflopAction, string> = {
  raise: 'повысить ставку', call: 'уравнять ставку', fold: 'сбросить карты',
}

/**
 * Позиция в предложении: «Вы на баттоне (BTN)». Название по-русски стоит
 * первым, код — в скобках: за столом говорят «BTN», но новичку это сочетание
 * букв ничего не говорит, пока он не прочитал слово целиком.
 */
export const POSITION_ON: Record<Position, string> = {
  utg: 'в ранней позиции (UTG)',
  hj: 'на хайджеке (HJ)',
  co: 'на катоффе (CO)',
  btn: 'на баттоне (BTN)',
  sb: 'на малом блайнде (SB)',
  bb: 'на большом блайнде (BB)',
}

export interface PreflopSpot {
  id: string
  hero: Position
  /** Кто открыл до нас. `null` — до нас все сбросили, мы открываем первыми. */
  versus: Position | null
  raise: HandRange
  call: HandRange
  note: string
  title: string
}

function spot(
  hero: Position, versus: Position | null,
  raiseText: string, callText: string, note: string,
): PreflopSpot {
  const raise = parseRange(raiseText)
  return {
    id: versus ? `vs-${hero}-${versus}` : `open-${hero}`,
    hero,
    versus,
    raise,
    // Рука не может быть и в рейзе, и в колле. Вычитаем здесь, а не следим
    // глазами при каждой правке строки: `Q8s+` молча накрывает `QJs` из рейза.
    call: rangeSubtract(parseRange(callText), raise),
    note,
    title: versus
      ? `${POSITION_CODE[hero]} против открытия ${POSITION_CODE[versus]}`
      : `${POSITION_CODE[hero]} — открытие`,
  }
}

export const OPEN_RAISE: PreflopSpot[] = [
  spot('utg', null, '22+, A7s+, A5s-A4s, KTs+, Q9s+, J9s+, T9s, 98s, 87s, 76s, AJo+, KQo', '', 'Пятеро ходят после вас, и каждый может проснуться с сильной рукой. Мусор здесь не окупается позицией.'),
  spot('hj', null, '22+, A4s+, KTs+, Q9s+, J9s+, T8s+, 98s, 87s, 76s, 65s, ATo+, KJo+', '', 'На одного оппонента меньше — добавляем одномастные тузы и связки.'),
  spot('co', null, '22+, A2s+, K9s+, Q8s+, J8s+, T8s+, 97s+, 86s+, 75s+, 65s, 54s, A9o+, KTo+, QJo', '', 'Позади только баттон и блайнды. Одномастные руки играются заметно шире.'),
  spot('btn', null, '22+, A2s+, K2s+, Q5s+, J7s+, T7s+, 96s+, 85s+, 74s+, 64s+, 53s+, A2o+, K8o+, Q9o+, J9o+, T9o', '', 'После флопа вы ходите последним всю раздачу — это и есть причина открывать почти половину рук.'),
  spot('sb', null, '22+, A2s+, K2s+, Q5s+, J7s+, T7s+, 96s+, 85s+, 74s+, 64s+, 53s+, A5o+, K8o+, Q9o+, J9o+, T9o', '', 'Против одного большого блайнда, но без позиции. Лимп не нужен: либо рейз, либо фолд.'),
]

export const FACING_OPEN: PreflopSpot[] = [
  spot('bb', 'utg', 'QQ+, AKs, AKo, A5s', '22-JJ, AQs-A2s, K8s+, Q9s+, J8s+, T7s+, 96s+, 86s+, 75s+, 65s, 54s, ATo+, KJo+, QJo, JTo', 'Доплачиваете меньше всех, поэтому защищаетесь широко. Но против ранней позиции 3-бет только на самом верху.'),
  spot('bb', 'co', 'TT+, AQs+, AKo, A5s-A4s, KJs', '22-99, AJs-A2s, K2s+, Q5s+, J7s+, T7s+, 96s+, 85s+, 75s+, 64s+, 54s, A9o+, KTo+, QTo+, J9o+, T9o', 'Катофф открывает широко — коллировать можно почти любую одномастную руку с игровым потенциалом.'),
  spot('bb', 'btn', '99+, ATs+, AQo+, A5s-A2s, KJs+, QJs, T9s, 76s', '22-88, A9s-A6s, K5s-KTs, Q8s+, J8s+, T8s, 97s+, 86s+, 75s+, 65s, 54s, A2o+, K9o+, Q9o+, J9o+, T9o', 'Баттон открывает почти половину рук, значит и защищаться надо очень широко — иначе он печатает деньги на одних открытиях.'),
  spot('btn', 'utg', 'QQ+, AKs, AKo, AJs, KQs', '22-JJ, ATs, A5s, KJs, QJs, JTs, T9s, 98s, AQo', 'Ранняя позиция открывает узко. У нас позиция, поэтому колл широкий, а 3-бет — только сильнейшим.'),
  spot('btn', 'co', 'JJ+, AQs+, AKo, A5s-A4s, KJs+', '22-TT, AJs-A6s, KTs, QTs+, J9s+, T8s+, 97s+, 86s+, 76s, 65s, AQo, AJo, KQo', 'Играем с позицией против широкого открытия — самая прибыльная ситуация за столом.'),
  spot('sb', 'btn', '77+, AQs+, AKo, A5s-A2s, KTs+, QTs+, JTs, T9s, AQo', '22-66, AJs-A6s, K9s, Q9s, J9s, 98s, AJo, KQo', 'Без позиции против широкого открытия. Коллировать хочется многим, но каждая такая рука потом играется первой.'),
  spot('co', 'utg', 'QQ+, AKs, AKo, AJs, KQs', '55-JJ, ATs, A5s, KJs, QJs, JTs, AQo', 'После нас ещё баттон и блайнды. Колл должен быть уже, чем с баттона.'),
]

export const spotsFor = (hero: Position): PreflopSpot[] => [
  ...OPEN_RAISE.filter((s) => s.hero === hero),
  ...FACING_OPEN.filter((s) => s.hero === hero),
]

export function actionFor(spot: PreflopSpot, notation: string): PreflopAction {
  if (spot.raise.has(notation)) return 'raise'
  if (spot.call.has(notation)) return 'call'
  return 'fold'
}

/** Доля рук, с которыми мы вообще продолжаем. */
export const playedPercentage = (s: PreflopSpot): number =>
  rangePercentage(rangeUnion(s.raise, s.call))

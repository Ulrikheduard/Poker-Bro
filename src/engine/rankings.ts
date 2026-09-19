import { type Card, parseCards } from './cards'
import { type HandCategory, CATEGORY_TITLE } from './evaluator'

/**
 * Страница комбинаций. Частоты не переписаны из справочника, а посчитаны
 * перебором всех 133 784 560 семикарточных наборов движком нативной версии —
 * и это именно то, что игрок видит к риверу. Пятикарточные числа из учебников
 * ввели бы в заблуждение: с семью картами две пары встречаются вчетверо чаще,
 * а рука без пары — втрое реже.
 */

export interface HandRankingEntry {
  category: HandCategory
  title: string
  example: Card[]
  /** Какие карты примера образуют комбинацию — остальные кикеры. */
  highlighted: number[]
  explanation: string
  beginnerNote: string
  /** Доля семикарточных наборов, в процентах. */
  frequency: number
  combinations: number
}

export const HAND_RANKINGS: HandRankingEntry[] = [
  {
    category: 8,
    title: CATEGORY_TITLE[8],
    example: parseCards('Th Jh Qh Kh Ah'),
    highlighted: [0, 1, 2, 3, 4],
    explanation: 'Пять карт подряд одной масти. Старший вариант — от десятки до туза — называют флеш-роялем.',
    beginnerNote: 'За вечер игры вы её, скорее всего, не увидите. Если собрали — разыгрывайте медленно, спешить некуда.',
    frequency: 0.0311,
    combinations: 41584,
  },
  {
    category: 7,
    title: CATEGORY_TITLE[7],
    example: parseCards('9c 9d 9h 9s Kd'),
    highlighted: [0, 1, 2, 3],
    explanation: 'Четыре карты одного достоинства. Пятая — кикер, она решает спор только между двумя одинаковыми каре с доски.',
    beginnerNote: 'Почти всегда выигрывает. Главная задача — не распугать оппонента и дать ему заплатить.',
    frequency: 0.1681,
    combinations: 224848,
  },
  {
    category: 6,
    title: CATEGORY_TITLE[6],
    example: parseCards('8c 8d 8h Qs Qd'),
    highlighted: [0, 1, 2, 3, 4],
    explanation: 'Тройка плюс пара. Сравниваются сначала тройки: 888 на дамах бьёт 777 на тузах.',
    beginnerNote: 'Сильная рука, но на спаренной доске осторожнее: фулл-хаус старшим номиналом бьёт ваш.',
    frequency: 2.5961,
    combinations: 3473184,
  },
  {
    category: 5,
    title: CATEGORY_TITLE[5],
    example: parseCards('2s 6s 9s Js As'),
    highlighted: [0, 1, 2, 3, 4],
    explanation: 'Пять карт одной масти, подряд идти не обязаны. Спор решает старшая карта флеша.',
    beginnerNote: 'Флеш с младшей картой — ловушка: на одномастной доске вы часто вторые. Ценится флеш с тузом.',
    frequency: 3.0255,
    combinations: 4047644,
  },
  {
    category: 4,
    title: CATEGORY_TITLE[4],
    example: parseCards('5c 6d 7h 8s 9c'),
    highlighted: [0, 1, 2, 3, 4],
    explanation: 'Пять карт подряд, масти любые. Туз работает и сверху (10-J-Q-K-A), и снизу (A-2-3-4-5), но не по кругу.',
    beginnerNote: 'A-2-3-4-5 — самый младший стрит, его называют «колесом». Старшая карта в нём пятёрка, а не туз.',
    frequency: 4.6194,
    combinations: 6180020,
  },
  {
    category: 3,
    title: CATEGORY_TITLE[3],
    example: parseCards('Qc Qd Qh 7s 2d'),
    highlighted: [0, 1, 2],
    explanation: 'Три карты одного достоинства плюс два кикера.',
    beginnerNote: 'Есть разница: «сет» — когда у вас в руке пара и третья пришла с доски, «трипс» — когда пара на доске. Сет скрыт и потому прибыльнее.',
    frequency: 4.8299,
    combinations: 6461620,
  },
  {
    category: 2,
    title: CATEGORY_TITLE[2],
    example: parseCards('Jc Jd 4h 4s Ad'),
    highlighted: [0, 1, 2, 3],
    explanation: 'Две пары плюс кикер. Сравнивается сначала старшая пара, потом младшая, и только потом кикер.',
    beginnerNote: 'Частая рука и частая ошибка новичка: две пары легко переоценить, когда на доске возможен стрит или флеш.',
    frequency: 23.4955,
    combinations: 31433400,
  },
  {
    category: 1,
    title: CATEGORY_TITLE[1],
    example: parseCards('Ac Ad 9h 6s 3d'),
    highlighted: [0, 1],
    explanation: 'Две карты одного достоинства плюс три кикера.',
    beginnerNote: 'Больше сорока процентов раздач заканчиваются парой. Важно не «есть ли пара», а с доской она или в руке и какой кикер.',
    frequency: 43.8225,
    combinations: 58627800,
  },
  {
    category: 0,
    title: CATEGORY_TITLE[0],
    example: parseCards('Ac Jd 9h 6s 3d'),
    highlighted: [0],
    explanation: 'Ничего не собралось. Спор решают карты по старшинству, одна за другой.',
    beginnerNote: 'Каждая шестая рука к риверу остаётся без пары. Выигрывают такие руки ставкой, а не вскрытием.',
    frequency: 17.4119,
    combinations: 23294460,
  },
]

/** Всего семикарточных наборов — сумма по категориям обязана совпасть. */
export const TOTAL_SEVEN_CARD_HANDS = 133_784_560

/** «1 раз из 3 214» — частота в форме, которую легче почувствовать. */
export function oddsText(frequency: number): string {
  if (frequency <= 0) return '—'
  const one = 100 / frequency
  if (one < 10) return `примерно каждая ${one.toFixed(1).replace('.', ',')}-я рука`
  return `примерно 1 раз из ${Math.round(one)}`
}

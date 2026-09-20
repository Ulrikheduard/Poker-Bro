import {
  type Card, ALL_RANKS, ALL_SUITS, RANK_LABEL, SUIT_SYMBOL, SUIT_NAME,
  cardRank, cardSuit, isRed, makeCard,
} from '../../engine/cards'
import { Haptics } from '../haptics'
import { Sheet } from './Sheet'

const ink = (card: Card, dim: boolean) =>
  dim ? 'var(--faint)' : isRed(card) ? 'var(--suit-red)' : 'var(--suit-black)'

/**
 * Игральная карта. Лицо белое, а не «в тему приложения»: за столом карта белая,
 * и узнавать её на экране надо мгновенно, без перевода в уме.
 */
export function PlayingCard({ card, width = 46, dim = false }: {
  card: Card
  width?: number
  dim?: boolean
}) {
  return (
    <div
      className={'card-face' + (dim ? ' dim' : '')}
      style={{ width, height: width * 1.42, color: ink(card, dim) }}
      aria-label={`${RANK_LABEL[cardRank(card)]} ${SUIT_NAME[cardSuit(card)]}`}
    >
      <span className="r" style={{ fontSize: width * 0.46 }}>{RANK_LABEL[cardRank(card)]}</span>
      <span style={{ fontSize: width * 0.4 }}>{SUIT_SYMBOL[cardSuit(card)]}</span>
    </div>
  )
}

export function CardSlot({ card, width = 46, placeholder, disabled = false, onClick }: {
  card: Card | null
  width?: number
  placeholder?: string
  /** Слот, до которого очередь ещё не дошла: тёрна без флопа не бывает. */
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className="press-s"
      onClick={onClick}
      disabled={disabled}
      aria-label={disabled ? `${placeholder}: сначала доберите предыдущие карты` : placeholder}
      style={{ display: 'flex' }}
    >
      {card !== null
        ? <PlayingCard card={card} width={width} />
        : (
          <span className={'card-slot' + (disabled ? ' locked' : '')}
            style={{ width, height: width * 1.42 }}>
            {/* У закрытого слота подписи нет: она звала бы нажать. */}
            {disabled ? '' : placeholder}
          </span>
        )}
    </button>
  )
}

/**
 * Выбор карты из колоды. Занятые карты видны, но не нажимаются — прятать их
 * нельзя: сетка бы прыгала, и найти нужную стало бы труднее.
 */
export function CardPicker({ used, current, title, onPick, onClose }: {
  used: Set<Card>
  current: Card | null
  title: string
  onPick: (card: Card | null) => void
  onClose: () => void
}) {
  const ranks = [...ALL_RANKS].reverse()
  return (
    <Sheet title={title} onClose={onClose}>
      {ALL_SUITS.map((suit) => (
        <div className="picker-suit" key={suit}>
          {ranks.map((rank) => {
            const card = makeCard(rank, suit)
            const taken = used.has(card) && card !== current
            return (
              <button
                key={card}
                type="button"
                className="picker-cell press-xs"
                data-taken={taken}
                data-selected={card === current}
                disabled={taken}
                style={{ color: ink(card, taken) }}
                aria-label={`${RANK_LABEL[rank]} ${SUIT_NAME[suit]}`}
                onClick={() => { Haptics.place(); onPick(card) }}
              >
                <span aria-hidden="true">{RANK_LABEL[rank]}</span>
                <span className="s" aria-hidden="true">{SUIT_SYMBOL[suit]}</span>
              </button>
            )
          })}
        </div>
      ))}
      {current !== null && (
        <button type="button" className="press sheet-remove"
          onClick={() => { Haptics.tap(); onPick(null) }}>
          Убрать карту
        </button>
      )}
    </Sheet>
  )
}

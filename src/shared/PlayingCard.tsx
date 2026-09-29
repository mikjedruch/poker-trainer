import type { Card } from '../core/cards';
import { rankOf, suitOf } from '../core/cards';

// Suit order matches SUIT_CHARS = 'cdhs'. Four-colour deck for readability on a small screen.
const SUIT_SYMBOLS = ['♣', '♦', '♥', '♠'];
const SUIT_CLASSES = ['clubs', 'diamonds', 'hearts', 'spades'];
const SUIT_NAMES_PL = ['trefl', 'karo', 'kier', 'pik'];
const RANK_LABELS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export function cardLabel(card: Card): string {
  return `${RANK_LABELS[rankOf(card)]} ${SUIT_NAMES_PL[suitOf(card)]}`;
}

export function PlayingCard({ card, size = 'md' }: { card: Card; size?: 'sm' | 'md' }) {
  const suit = suitOf(card);
  return (
    <span className={`card card-${size} ${SUIT_CLASSES[suit]}`} role="img" aria-label={cardLabel(card)}>
      <span className="card-rank">{RANK_LABELS[rankOf(card)]}</span>
      <span className="card-suit">{SUIT_SYMBOLS[suit]}</span>
    </span>
  );
}

export function CardRow({ cards, size = 'md' }: { cards: readonly Card[]; size?: 'sm' | 'md' }) {
  return (
    <span className="card-row">
      {cards.map((c) => (
        <PlayingCard key={c} card={c} size={size} />
      ))}
    </span>
  );
}

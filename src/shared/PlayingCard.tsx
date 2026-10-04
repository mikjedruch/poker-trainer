import type { Card } from '../core/cards';
import { rankOf, suitOf } from '../core/cards';

// Suit order matches SUIT_CHARS = 'cdhs'. Colours come from theme.css (four-colour deck by default).
const SUIT_CLASSES = ['clubs', 'diamonds', 'hearts', 'spades'];
const SUIT_NAMES_PL = ['trefl', 'karo', 'kier', 'pik'];
const RANK_LABELS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

// Suits drawn as SVG instead of ♠♥♦♣ text: identical on every phone, never turned into emoji.
const club = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;
const SUIT_PATHS = [
  // clubs: three leaves, a centre fill and a flared stem
  `${club(12, 6.8, 4.6)}${club(6.6, 13.4, 4.6)}${club(17.4, 13.4, 4.6)}${club(12, 12, 2.6)}M12 12c-.1 4.6-1 7.6-3.6 10h7.2C13 19.6 12.1 16.6 12 12z`,
  // diamonds
  'M12 1.5c2.3 3.7 5.2 7.2 8.6 10.5-3.4 3.3-6.3 6.8-8.6 10.5-2.3-3.7-5.2-7.2-8.6-10.5C6.8 8.7 9.7 5.2 12 1.5z',
  // hearts
  'M12 21.5C6 16.8 2 13.2 2 8.6 2 5.5 4.4 3 7.4 3c1.9 0 3.6 1 4.6 2.6C13 4 14.7 3 16.6 3 19.6 3 22 5.5 22 8.6c0 4.6-4 8.2-10 12.9z',
  // spades
  'M12 1.8C9 6 3 9.6 3 14.2 3 16.9 5.1 19 7.7 19c1.6 0 2.9-.7 3.6-1.8-.2 1.9-1 3.4-2.6 4.8h6.6c-1.6-1.4-2.4-2.9-2.6-4.8.7 1.1 2 1.8 3.6 1.8 2.6 0 4.7-2.1 4.7-4.8C21 9.6 15 6 12 1.8z',
];

export function cardLabel(card: Card): string {
  return `${RANK_LABELS[rankOf(card)]} ${SUIT_NAMES_PL[suitOf(card)]}`;
}

export function SuitIcon({ suit }: { suit: number }) {
  return (
    <svg className="suit-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={SUIT_PATHS[suit]} />
    </svg>
  );
}

export function PlayingCard({ card, size = 'md' }: { card: Card; size?: 'sm' | 'md' }) {
  const suit = suitOf(card);
  return (
    <span className={`card card-${size} ${SUIT_CLASSES[suit]}`} role="img" aria-label={cardLabel(card)}>
      <span className="card-rank">{RANK_LABELS[rankOf(card)]}</span>
      <SuitIcon suit={suit} />
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

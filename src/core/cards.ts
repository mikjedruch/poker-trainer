/**
 * A card is an integer 0..51: rank * 4 + suit.
 * Rank 0 = deuce … 12 = ace. Suit order follows SUIT_CHARS.
 */
export type Card = number;

export const RANK_CHARS = '23456789TJQKA';
export const SUIT_CHARS = 'cdhs';

export const RANK_ACE = 12;

export const makeCard = (rank: number, suit: number): Card => rank * 4 + suit;
export const rankOf = (card: Card): number => card >> 2;
export const suitOf = (card: Card): number => card & 3;

export const FULL_DECK: readonly Card[] = Object.freeze(Array.from({ length: 52 }, (_, i) => i));

export function parseCard(text: string): Card {
  if (text.length !== 2) throw new Error(`Invalid card: "${text}"`);
  const rank = RANK_CHARS.indexOf(text[0]!.toUpperCase());
  const suit = SUIT_CHARS.indexOf(text[1]!.toLowerCase());
  if (rank < 0 || suit < 0) throw new Error(`Invalid card: "${text}"`);
  return makeCard(rank, suit);
}

export function formatCard(card: Card): string {
  if (!Number.isInteger(card) || card < 0 || card > 51) throw new Error(`Invalid card index: ${card}`);
  return RANK_CHARS[rankOf(card)]! + SUIT_CHARS[suitOf(card)]!;
}

/** Parses "Kh 9h 2c", "Kh9h2c" or "Kh, 9h, 2c". Throws on invalid or duplicate cards. */
export function parseCards(text: string): Card[] {
  const compact = text.replace(/[\s,]+/g, '');
  if (compact.length % 2 !== 0) throw new Error(`Invalid card list: "${text}"`);
  const cards: Card[] = [];
  for (let i = 0; i < compact.length; i += 2) cards.push(parseCard(compact.slice(i, i + 2)));
  assertDistinct(cards);
  return cards;
}

export const formatCards = (cards: readonly Card[]): string => cards.map(formatCard).join(' ');

export function assertDistinct(cards: readonly Card[]): void {
  const seen = new Set<Card>();
  for (const card of cards) {
    if (seen.has(card)) throw new Error(`Duplicate card: ${formatCard(card)}`);
    seen.add(card);
  }
}

/** Deck without the given cards, in ascending card order. */
export function remainingDeck(used: readonly Card[]): Card[] {
  const usedSet = new Set(used);
  return FULL_DECK.filter((c) => !usedSet.has(c));
}

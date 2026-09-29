import type { Card } from './cards';

export const HandCategory = {
  HighCard: 0,
  Pair: 1,
  TwoPair: 2,
  Trips: 3,
  Straight: 4,
  Flush: 5,
  FullHouse: 6,
  Quads: 7,
  StraightFlush: 8,
} as const;
export type HandCategory = (typeof HandCategory)[keyof typeof HandCategory];

export const CATEGORY_NAMES_PL: readonly string[] = Object.freeze([
  'wysoka karta',
  'para',
  'dwie pary',
  'trójka',
  'strit',
  'kolor',
  'full',
  'kareta',
  'poker',
]);

export interface HandEvaluation {
  /** Larger is stronger; equal values are exact ties. */
  value: number;
  category: HandCategory;
  name: string;
}

// Value layout: category in bits 20+, then up to five 4-bit rank slots, most significant first.
const CATEGORY_SHIFT = 20;

const POPCOUNT = new Uint8Array(1 << 13);
for (let m = 1; m < POPCOUNT.length; m++) POPCOUNT[m] = POPCOUNT[m >> 1]! + (m & 1);

/** High rank of the best straight contained in a 13-bit rank mask, or -1. */
const STRAIGHT_HIGH = new Int8Array(1 << 13);
for (let m = 0; m < STRAIGHT_HIGH.length; m++) {
  let high = -1;
  for (let h = 12; h >= 4; h--) {
    const run = 0x1f << (h - 4);
    if ((m & run) === run) {
      high = h;
      break;
    }
  }
  const wheel = (1 << 12) | 0xf; // A-2-3-4-5
  if (high < 0 && (m & wheel) === wheel) high = 3;
  STRAIGHT_HIGH[m] = high;
}

/** Packs the n highest ranks of a mask into n nibbles, highest first. */
function topRanks(mask: number, n: number): number {
  let packed = 0;
  let taken = 0;
  for (let r = 12; r >= 0 && taken < n; r--) {
    if (mask & (1 << r)) {
      packed = (packed << 4) | r;
      taken++;
    }
  }
  return packed << (4 * (n - taken));
}

const rankCounts = new Uint8Array(13);
const suitMasks = new Int32Array(4);

/** Strength of the best 5-card hand among 5–7 cards. Allocation-free; hot path for equity. */
export function handValue(cards: ArrayLike<Card>, length: number = cards.length): number {
  if (length < 5 || length > 7) throw new Error(`Need 5-7 cards, got ${length}`);
  rankCounts.fill(0);
  suitMasks.fill(0);
  let all = 0;
  for (let i = 0; i < length; i++) {
    const card = cards[i]!;
    const rank = card >> 2;
    rankCounts[rank]!++;
    suitMasks[card & 3]! |= 1 << rank;
    all |= 1 << rank;
  }

  let flushMask = 0;
  for (let s = 0; s < 4; s++) {
    if (POPCOUNT[suitMasks[s]!]! >= 5) flushMask = suitMasks[s]!;
  }
  if (flushMask) {
    const high = STRAIGHT_HIGH[flushMask]!;
    if (high >= 0) return (HandCategory.StraightFlush << CATEGORY_SHIFT) | (high << 16);
  }

  let quads = -1;
  let trips1 = -1;
  let trips2 = -1;
  let pair1 = -1;
  let pair2 = -1;
  for (let r = 12; r >= 0; r--) {
    const count = rankCounts[r]!;
    if (count === 4) quads = r;
    else if (count === 3) {
      if (trips1 < 0) trips1 = r;
      else if (trips2 < 0) trips2 = r;
    } else if (count === 2) {
      if (pair1 < 0) pair1 = r;
      else if (pair2 < 0) pair2 = r;
    }
  }

  if (quads >= 0) {
    return (HandCategory.Quads << CATEGORY_SHIFT) | (quads << 16) | (topRanks(all & ~(1 << quads), 1) << 12);
  }
  if (trips1 >= 0 && (trips2 >= 0 || pair1 >= 0)) {
    return (HandCategory.FullHouse << CATEGORY_SHIFT) | (trips1 << 16) | (Math.max(trips2, pair1) << 12);
  }
  if (flushMask) return (HandCategory.Flush << CATEGORY_SHIFT) | topRanks(flushMask, 5);
  const straightHigh = STRAIGHT_HIGH[all]!;
  if (straightHigh >= 0) return (HandCategory.Straight << CATEGORY_SHIFT) | (straightHigh << 16);
  if (trips1 >= 0) {
    return (HandCategory.Trips << CATEGORY_SHIFT) | (trips1 << 16) | (topRanks(all & ~(1 << trips1), 2) << 8);
  }
  if (pair2 >= 0) {
    const kicker = topRanks(all & ~(1 << pair1) & ~(1 << pair2), 1);
    return (HandCategory.TwoPair << CATEGORY_SHIFT) | (pair1 << 16) | (pair2 << 12) | (kicker << 8);
  }
  if (pair1 >= 0) {
    return (HandCategory.Pair << CATEGORY_SHIFT) | (pair1 << 16) | (topRanks(all & ~(1 << pair1), 3) << 4);
  }
  return topRanks(all, 5);
}

export const categoryOf = (value: number): HandCategory => (value >> CATEGORY_SHIFT) as HandCategory;

export function evaluateHand(cards: readonly Card[]): HandEvaluation {
  const value = handValue(cards);
  const category = categoryOf(value);
  return { value, category, name: CATEGORY_NAMES_PL[category]! };
}

/** 1 if a is stronger, -1 if b is stronger, 0 on a tie. */
export const compareHands = (a: readonly Card[], b: readonly Card[]): number => Math.sign(handValue(a) - handValue(b));

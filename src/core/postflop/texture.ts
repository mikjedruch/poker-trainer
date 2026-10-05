import type { Card } from '../cards';
import { assertDistinct, rankOf, suitOf } from '../cards';
import { straightHighOfMask } from '../evaluator';

// Flop texture: deterministic facts about three board cards.

export type Suits = 'rainbow' | 'twoTone' | 'monotone';
export type Height = 'high' | 'middle' | 'low';

export const SUITS_VALUES: readonly Suits[] = ['rainbow', 'twoTone', 'monotone'];
export const HEIGHT_VALUES: readonly Height[] = ['high', 'middle', 'low'];

export const SUITS_NAMES_PL: Readonly<Record<Suits, string>> = {
  rainbow: 'rainbow',
  twoTone: 'two-tone',
  monotone: 'monotone',
};

export const SUITS_DESCRIPTIONS_PL: Readonly<Record<Suits, string>> = {
  rainbow: 'trzy różne kolory',
  twoTone: 'dwie karty w jednym kolorze',
  monotone: 'trzy karty w jednym kolorze',
};

export const HEIGHT_NAMES_PL: Readonly<Record<Height, string>> = {
  high: 'wysoki',
  middle: 'średni',
  low: 'niski',
};

export const HEIGHT_RULES_PL: Readonly<Record<Height, string>> = {
  high: 'najwyższa karta A, K lub Q',
  middle: 'najwyższa karta J, T lub 9',
  low: 'najwyższa karta 8 lub niższa',
};

/** Rank index of the queen and the nine (0 = deuce). */
const HIGH_FROM = 10;
const MIDDLE_FROM = 7;

export interface FlopTexture {
  paired: boolean;
  suits: Suits;
  height: Height;
  /** Pairs of distinct ranks (r1 < r2) that make a straight together with the flop. */
  straightPairs: number;
  straightRankPairs: Array<[number, number]>;
  /** Pairs of distinct ranks without a straight where at least two different ranks would complete one. */
  oesdPairs: number;
  /** Not rainbow, or a straight is possible, or at least 3 rank pairs give an OESD / double gutshot. */
  wet: boolean;
}

function assertFlop(flop: readonly Card[]): void {
  if (flop.length !== 3) throw new Error(`A flop has 3 cards, got ${flop.length}`);
  for (const c of flop) if (!Number.isInteger(c) || c < 0 || c > 51) throw new Error(`Invalid card index: ${c}`);
  assertDistinct(flop);
}

export function heightOf(flop: readonly Card[]): Height {
  const top = Math.max(...flop.map(rankOf));
  if (top >= HIGH_FROM) return 'high';
  if (top >= MIDDLE_FROM) return 'middle';
  return 'low';
}

/** Number of ranks that, added to the rank mask, make a straight. */
function completingRanks(mask: number): number {
  let n = 0;
  for (let r = 0; r < 13; r++) if (!(mask & (1 << r)) && straightHighOfMask(mask | (1 << r)) >= 0) n++;
  return n;
}

export function flopTexture(flop: readonly Card[]): FlopTexture {
  assertFlop(flop);
  const ranks = flop.map(rankOf);
  const flopMask = ranks.reduce((m, r) => m | (1 << r), 0);
  const suitCount = new Set(flop.map(suitOf)).size;
  const suits: Suits = suitCount === 3 ? 'rainbow' : suitCount === 2 ? 'twoTone' : 'monotone';

  const straightRankPairs: Array<[number, number]> = [];
  let oesdPairs = 0;
  for (let r1 = 0; r1 < 13; r1++) {
    for (let r2 = r1 + 1; r2 < 13; r2++) {
      const mask = flopMask | (1 << r1) | (1 << r2);
      if (straightHighOfMask(mask) >= 0) straightRankPairs.push([r1, r2]);
      else if (completingRanks(mask) >= 2) oesdPairs++;
    }
  }

  const straightPairs = straightRankPairs.length;
  return {
    paired: new Set(ranks).size < 3,
    suits,
    height: heightOf(flop),
    straightPairs,
    straightRankPairs,
    oesdPairs,
    wet: suits !== 'rainbow' || straightPairs > 0 || oesdPairs >= 3,
  };
}

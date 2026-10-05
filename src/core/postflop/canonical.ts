import type { Card } from '../cards';
import { formatCard, makeCard, rankOf, suitOf } from '../cards';
import type { Rng } from '../rng';
import { shuffleInPlace } from '../rng';

// Ranges are made of whole hand classes, so renaming suits (e.g. ♠→♥, ♥→♠) never changes an
// analysis. Every flop maps to one canonical form; the cache and the precomputed library use it.

export type SuitPermutation = readonly [number, number, number, number];

const PERMUTATIONS: SuitPermutation[] = [];
for (let a = 0; a < 4; a++)
  for (let b = 0; b < 4; b++)
    for (let c = 0; c < 4; c++)
      for (let d = 0; d < 4; d++) if (new Set([a, b, c, d]).size === 4) PERMUTATIONS.push([a, b, c, d]);

export const permuteSuits = (cards: readonly Card[], perm: SuitPermutation): Card[] =>
  cards.map((c) => makeCard(rankOf(c), perm[suitOf(c)]!));

const sortedDesc = (cards: readonly Card[]): Card[] => [...cards].sort((a, b) => b - a);

function lexLess(a: readonly Card[], b: readonly Card[]): boolean {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i]! < b[i]!;
  return false;
}

/** Canonical form: of all suit renamings, the one whose descending card list is smallest. */
export function canonicalFlop(flop: readonly Card[]): Card[] {
  let best = sortedDesc(flop);
  for (const perm of PERMUTATIONS) {
    const cand = sortedDesc(permuteSuits(flop, perm));
    if (lexLess(cand, best)) best = cand;
  }
  return best;
}

/** Key like "Ks7d2c" for maps and the library file. */
export const canonicalKey = (flop: readonly Card[]): string => canonicalFlop(flop).map(formatCard).join('');

export function randomSuitPermutation(rng: Rng): SuitPermutation {
  return shuffleInPlace([0, 1, 2, 3], rng) as unknown as SuitPermutation;
}

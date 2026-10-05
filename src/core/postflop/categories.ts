import type { Card } from '../cards';
import { RANK_CHARS, assertDistinct, rankOf, suitOf } from '../cards';
import { HandCategory, categoryOf, handValue, straightHighOfMask } from '../evaluator';
import type { Combo } from '../range';

// Flop hand categories, always judged by what the hole cards add:
// strong     trips/set or better, or two pair with each hole card pairing a different flop card;
// tpGood     top pair with a kicker of T or better, or an overpair;
// tpWeak     top pair with a kicker below T;
// weakPair   any other pair made with a hole card (pocket pairs below the top card included);
// draw       no such pair, but a flush draw (4 to a suit) or 2+ ranks completing a straight;
// nothing    the rest.

export const HAND_CATEGORIES = ['strong', 'tpGood', 'tpWeak', 'weakPair', 'draw', 'nothing'] as const;
export type HandCat = (typeof HAND_CATEGORIES)[number];

export const HAND_CATEGORY_NAMES_PL: Readonly<Record<HandCat, string>> = {
  strong: 'silne',
  tpGood: 'TP dobry kicker',
  tpWeak: 'TP słaby kicker',
  weakPair: 'słabsza para',
  draw: 'draw',
  nothing: 'nic',
};

/** Statistics group "TP+": top pair or overpair, strong hands included. */
export const isTopPairPlus = (c: HandCat): boolean => c === 'strong' || c === 'tpGood' || c === 'tpWeak';

/** Rank index of the ten: top pair with a kicker from here up is a good kicker. */
const GOOD_KICKER = 8;

export interface HandDescription {
  category: HandCat;
  /** Polish phrase explaining the category, e.g. "top para (K) z kickerem 9 — kicker poniżej T". */
  reason: string;
}

const rankName = (r: number): string => RANK_CHARS[r]!;

function straightCompletions(mask: number): number[] {
  const out: number[] = [];
  for (let r = 0; r < 13; r++) if (!(mask & (1 << r)) && straightHighOfMask(mask | (1 << r)) >= 0) out.push(r);
  return out;
}

const STRONG_NAMES: Partial<Record<HandCategory, string>> = {
  [HandCategory.Straight]: 'strit',
  [HandCategory.Flush]: 'kolor',
  [HandCategory.FullHouse]: 'full',
  [HandCategory.Quads]: 'kareta',
  [HandCategory.StraightFlush]: 'poker',
};

export function describeHand(hole: Combo, flop: readonly Card[]): HandDescription {
  const all = [hole[0], hole[1], ...flop];
  assertDistinct(all);
  const category = categoryOf(handValue(all));
  const flopRanks = flop.map(rankOf);
  const top = Math.max(...flopRanks);
  const h1 = rankOf(hole[0]);
  const h2 = rankOf(hole[1]);
  const pocket = h1 === h2;
  const boardTrips = flopRanks[0] === flopRanks[1] && flopRanks[1] === flopRanks[2];
  const hits = (r: number) => flopRanks.includes(r);

  // ---------- strong ----------
  if (category >= HandCategory.Straight) {
    return { category: 'strong', reason: `${STRONG_NAMES[category]} — silna ręka` };
  }
  if (category === HandCategory.Trips && !boardTrips) {
    const what = pocket ? `set (${rankName(h1)}${rankName(h1)})` : `trójka (${rankName(hits(h1) ? h1 : h2)})`;
    return { category: 'strong', reason: `${what} — silna ręka` };
  }
  if (!pocket && hits(h1) && hits(h2)) {
    return { category: 'strong', reason: `dwie pary z obu kart z ręki (${rankName(h1)} i ${rankName(h2)}) — silna ręka` };
  }

  // ---------- pairs made with a hole card ----------
  if (pocket) {
    if (h1 > top) {
      return { category: 'tpGood', reason: `overpara ${rankName(h1)}${rankName(h1)} — para w ręce wyższa niż najwyższa karta flopu` };
    }
    return {
      category: 'weakPair',
      reason: `para w ręce ${rankName(h1)}${rankName(h1)} poniżej najwyższej karty flopu (${rankName(top)}) — słabsza para`,
    };
  }
  if (h1 === top || h2 === top) {
    const kicker = h1 === top ? h2 : h1;
    const good = kicker >= GOOD_KICKER;
    return {
      category: good ? 'tpGood' : 'tpWeak',
      reason: `top para (${rankName(top)}) z kickerem ${rankName(kicker)} — kicker ${good ? 'T lub wyższy' : 'poniżej T'}`,
    };
  }
  if (hits(h1) || hits(h2)) {
    const paired = hits(h1) ? h1 : h2;
    return { category: 'weakPair', reason: `para ${rankName(paired)} z kartą z ręki, ale nie top para — słabsza para` };
  }

  // ---------- draws ----------
  const suitCounts = [0, 0, 0, 0];
  for (const c of all) suitCounts[suitOf(c)]!++;
  const flushDraw = hole.some((c) => suitCounts[suitOf(c)] === 4);
  const mask = all.reduce((m, c) => m | (1 << rankOf(c)), 0);
  const completions = straightCompletions(mask);
  const straightDraw = completions.length >= 2;
  if (flushDraw || straightDraw) {
    const parts: string[] = [];
    if (flushDraw) parts.push('flush draw (4 karty do koloru)');
    if (straightDraw) parts.push(`OESD / double gutshot (strit dają: ${completions.map(rankName).join(', ')})`);
    return { category: 'draw', reason: `${parts.join(' + ')} — draw` };
  }

  const notes: string[] = [];
  if (completions.length === 1) notes.push(`tylko gutshot (strit daje ${rankName(completions[0]!)})`);
  if (boardTrips || category === HandCategory.Pair || category === HandCategory.TwoPair) notes.push('para tylko na boardzie');
  const overcards = [h1, h2].filter((r) => r > top).length;
  if (overcards === 2) notes.push('dwie overkarty');
  const detail = notes.length > 0 ? ` (${notes.join(', ')})` : '';
  return { category: 'nothing', reason: `bez pary z kartą z ręki i bez silnego drawu${detail} — nic` };
}

export const handCategory = (hole: Combo, flop: readonly Card[]): HandCat => describeHand(hole, flop).category;

export type CategoryCounts = Record<HandCat, number>;

export const emptyCounts = (): CategoryCounts => ({ strong: 0, tpGood: 0, tpWeak: 0, weakPair: 0, draw: 0, nothing: 0 });

/** Category counts of a range on a flop (combos that collide with the flop already removed). */
export interface RangeSummary {
  combos: number;
  counts: CategoryCounts;
}

export function summarizeRange(combos: readonly Combo[], flop: readonly Card[]): RangeSummary {
  const flopSet = new Set(flop);
  const counts = emptyCounts();
  let n = 0;
  for (const c of combos) {
    if (flopSet.has(c[0]) || flopSet.has(c[1])) continue;
    counts[handCategory(c, flop)]++;
    n++;
  }
  return { combos: n, counts };
}

/** Share (0..1) of a category, or of the TP+ group. */
export function shareOf(s: RangeSummary, what: HandCat | 'tpPlus'): number {
  if (s.combos === 0) return 0;
  const n = what === 'tpPlus' ? s.counts.strong + s.counts.tpGood + s.counts.tpWeak : s.counts[what];
  return n / s.combos;
}

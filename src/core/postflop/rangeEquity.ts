import type { Card } from '../cards';
import { assertDistinct } from '../cards';
import { handValue } from '../evaluator';
import type { Combo } from '../range';

// Exact range-vs-range equity on the flop. Every (hero combo, villain combo, turn+river) triple
// without a shared card weighs the same.
//
// Instead of comparing every hero combo with every villain combo on every runout, each runout
// evaluates every combo once and sorts the villain values; a hero combo then counts the villain
// combos it beats or ties with binary search. Card removal stays exact: the villain combos holding
// one of the hero's two cards are counted the same way in per-card sorted lists and subtracted,
// and the one combo identical to the hero's (subtracted twice) is added back.

export interface EquityCount {
  /** 2·wins + ties over all valid triples. */
  points: number;
  /** Number of valid (hero combo, villain combo, runout) triples. */
  triples: number;
}

/** Equity as a fraction in [0, 1]. */
export const equityOf = (c: EquityCount): number => (c.triples === 0 ? Number.NaN : c.points / (2 * c.triples));

export interface Matchup {
  /** Index into the ranges list. */
  hero: number;
  villain: number;
}

export type ProgressCallback = (done: number, total: number) => void;

const COMBO_SLOTS = 1326;
/** Packs (value, position) into one sortable number; positions are < 2048. */
const POS_RADIX = 2048;

/** Index of the combo {a, b} among all 1326 two-card combos. */
export const comboIndex = (a: Card, b: Card): number => {
  const hi = a > b ? a : b;
  const lo = a > b ? b : a;
  return (hi * (hi - 1)) / 2 + lo;
};

interface PreparedRange {
  size: number;
  slot: Int32Array;
  c0: Int32Array;
  c1: Int32Array;
  isVillain: boolean;
  /** Position in this range of each of the 1326 combos, or −1 (villain side only). */
  posOfSlot: Int32Array;
  /** (value, position) pairs of live combos on the current runout, sorted. */
  packed: Float64Array;
  /** Villain values on the current runout, ascending; first `alive` entries are valid. */
  sorted: Int32Array;
  alive: number;
  /** For each card: ascending values of the live combos holding it, `cardLen[c]` of them. */
  cardVals: Int32Array[];
  cardLen: Int32Array;
}

function prepare(combos: readonly Combo[], flop: readonly Card[], isVillain: boolean): PreparedRange {
  const flopSet = new Set(flop);
  const live = combos.filter(([a, b]) => !flopSet.has(a) && !flopSet.has(b));
  const size = live.length;
  if (size >= POS_RADIX) throw new Error('Range too large');
  const slot = new Int32Array(size);
  const c0 = new Int32Array(size);
  const c1 = new Int32Array(size);
  const posOfSlot = new Int32Array(isVillain ? COMBO_SLOTS : 0).fill(-1);
  const perCard = new Int32Array(52);
  live.forEach(([a, b], i) => {
    slot[i] = comboIndex(a, b);
    c0[i] = a;
    c1[i] = b;
    if (isVillain) posOfSlot[slot[i]!] = i;
    perCard[a]!++;
    perCard[b]!++;
  });
  return {
    size,
    slot,
    c0,
    c1,
    isVillain,
    posOfSlot,
    packed: new Float64Array(isVillain ? size : 0),
    sorted: new Int32Array(isVillain ? size : 0),
    alive: 0,
    // Hero ranges get empty lists: same object shape for both sides.
    cardVals: Array.from(perCard, (n) => new Int32Array(isVillain ? n : 0)),
    cardLen: new Int32Array(52),
  };
}

function lowerBound(arr: Int32Array, n: number, x: number): number {
  let lo = 0;
  let hi = n;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid]! < x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function upperBound(arr: Int32Array, n: number, x: number, from: number): number {
  let lo = from;
  let hi = n;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid]! <= x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Sorts the villain's live values for this runout, overall and per card. */
function sortVillain(v: PreparedRange, values: Int32Array): void {
  const { packed, sorted, cardVals, cardLen, c0, c1 } = v;
  let n = 0;
  for (let k = 0; k < v.size; k++) {
    const val = values[v.slot[k]!]!;
    if (val >= 0) packed[n++] = val * POS_RADIX + k;
  }
  packed.subarray(0, n).sort();
  cardLen.fill(0);
  for (let i = 0; i < n; i++) {
    const p = packed[i]!;
    const k = p % POS_RADIX;
    const val = (p - k) / POS_RADIX;
    sorted[i] = val;
    const a = c0[k]!;
    const b = c1[k]!;
    cardVals[a]![cardLen[a]!++] = val;
    cardVals[b]![cardLen[b]!++] = val;
  }
  v.alive = n;
}

// ---------- hot loops (run once per runout) ----------

/** Hand value of every needed combo on the board in buf[2..6]; −1 for combos holding a turn/river card. */
function evaluateRunout(buf: Int32Array, slots: Int32Array, c0: Int32Array, c1: Int32Array, values: Int32Array): void {
  const turn = buf[5]!;
  const river = buf[6]!;
  for (let k = 0; k < slots.length; k++) {
    const a = c0[k]!;
    const b = c1[k]!;
    if (a === turn || a === river || b === turn || b === river) {
      values[slots[k]!] = -1;
      continue;
    }
    buf[0] = a;
    buf[1] = b;
    values[slots[k]!] = handValue(buf, 7);
  }
}

/** Points (2·wins + ties) and number of valid pairs of one matchup on this runout, into out[0], out[1]. */
function countMatchup(hero: PreparedRange, vil: PreparedRange, values: Int32Array, out: Float64Array): void {
  const { sorted, cardVals, cardLen, posOfSlot } = vil;
  const n = vil.alive;
  let pts = 0;
  let cnt = 0;
  for (let h = 0; h < hero.size; h++) {
    const slot = hero.slot[h]!;
    const x = values[slot]!;
    if (x < 0) continue;
    const lo = lowerBound(sorted, n, x);
    let less = lo;
    let equal = upperBound(sorted, n, x, lo) - lo;
    let count = n;

    const h0 = hero.c0[h]!;
    const arr0 = cardVals[h0]!;
    const len0 = cardLen[h0]!;
    const lo0 = lowerBound(arr0, len0, x);
    less -= lo0;
    equal -= upperBound(arr0, len0, x, lo0) - lo0;
    count -= len0;

    const h1 = hero.c1[h]!;
    const arr1 = cardVals[h1]!;
    const len1 = cardLen[h1]!;
    const lo1 = lowerBound(arr1, len1, x);
    less -= lo1;
    equal -= upperBound(arr1, len1, x, lo1) - lo1;
    count -= len1;

    // The villain combo identical to the hero's sits in both card lists: add it back once.
    if (posOfSlot[slot]! >= 0) {
      count++;
      equal++;
    }
    pts += 2 * less + equal;
    cnt += count;
  }
  out[0] = pts;
  out[1] = cnt;
}

/**
 * Exact equity of each matchup (hero range vs villain range) on a flop, enumerating all turns and
 * rivers. Combos that collide with the flop are dropped. Ranges are shared between matchups, so
 * each combo is evaluated once per runout no matter how many matchups use it.
 */
export function rangeEquities(
  flop: readonly Card[],
  ranges: readonly (readonly Combo[])[],
  matchups: readonly Matchup[],
  onProgress?: ProgressCallback,
): EquityCount[] {
  if (flop.length !== 3) throw new Error(`A flop has 3 cards, got ${flop.length}`);
  assertDistinct(flop);
  for (const m of matchups) {
    if (!ranges[m.hero] || !ranges[m.villain]) throw new Error('Matchup refers to a missing range');
  }

  const villainIdx = new Set(matchups.map((m) => m.villain));
  const prepared = ranges.map((r, i) => prepare(r, flop, villainIdx.has(i)));
  const villains = prepared.filter((p) => p.isVillain);

  // Every combo needed by any range, evaluated once per runout.
  const needed = new Uint8Array(COMBO_SLOTS);
  const neededSlots: number[] = [];
  const neededC0: number[] = [];
  const neededC1: number[] = [];
  for (const p of prepared) {
    for (let i = 0; i < p.size; i++) {
      const s = p.slot[i]!;
      if (needed[s]) continue;
      needed[s] = 1;
      neededSlots.push(s);
      neededC0.push(p.c0[i]!);
      neededC1.push(p.c1[i]!);
    }
  }
  const nSlots = Int32Array.from(neededSlots);
  const nC0 = Int32Array.from(neededC0);
  const nC1 = Int32Array.from(neededC1);
  const values = new Int32Array(COMBO_SLOTS);

  const flopSet = new Set(flop);
  const deck: Card[] = [];
  for (let c = 0; c < 52; c++) if (!flopSet.has(c)) deck.push(c);
  const totalRunouts = (deck.length * (deck.length - 1)) / 2;

  const points = new Float64Array(matchups.length);
  const triples = new Float64Array(matchups.length);
  const buf = new Int32Array(7);
  buf[2] = flop[0]!;
  buf[3] = flop[1]!;
  buf[4] = flop[2]!;

  const totals = new Float64Array(2);
  let done = 0;
  for (let i = 0; i < deck.length; i++) {
    buf[5] = deck[i]!;
    for (let j = i + 1; j < deck.length; j++) {
      buf[6] = deck[j]!;
      evaluateRunout(buf, nSlots, nC0, nC1, values);
      for (const v of villains) sortVillain(v, values);
      for (let m = 0; m < matchups.length; m++) {
        countMatchup(prepared[matchups[m]!.hero]!, prepared[matchups[m]!.villain]!, values, totals);
        points[m]! += totals[0]!;
        triples[m]! += totals[1]!;
      }
      done++;
    }
    onProgress?.(done, totalRunouts);
  }

  return matchups.map((_, m) => ({ points: points[m]!, triples: triples[m]! }));
}

/** Single matchup convenience wrapper. */
export const rangeEquity = (
  flop: readonly Card[],
  hero: readonly Combo[],
  villain: readonly Combo[],
  onProgress?: ProgressCallback,
): EquityCount => rangeEquities(flop, [hero, villain], [{ hero: 0, villain: 1 }], onProgress)[0]!;

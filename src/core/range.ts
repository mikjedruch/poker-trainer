import type { Card } from './cards';
import { RANK_CHARS, makeCard, parseCards, rankOf, suitOf } from './cards';

/** Two hole cards, higher card first. */
export type Combo = readonly [Card, Card];

/** Hand class like "AA", "AKs", "AKo". */
export type HandClass = string;

const RANK = `[${RANK_CHARS}]`;
const EXACT_RE = new RegExp(`^${RANK}[cdhs]${RANK}[cdhs]$`, 'i');
const CLASS_RE = new RegExp(`^(${RANK})(${RANK})([so])?(\\+)?$`, 'i');
const SPAN_RE = new RegExp(`^(${RANK})(${RANK})([so])?-(${RANK})(${RANK})([so])?$`, 'i');

const rankIndex = (ch: string): number => RANK_CHARS.indexOf(ch.toUpperCase());
const comboKey = (combo: Combo): number => combo[0] * 52 + combo[1];

function makeCombo(a: Card, b: Card): Combo {
  return a > b ? [a, b] : [b, a];
}

function pairCombos(rank: number): Combo[] {
  const out: Combo[] = [];
  for (let s1 = 0; s1 < 4; s1++)
    for (let s2 = s1 + 1; s2 < 4; s2++) out.push(makeCombo(makeCard(rank, s1), makeCard(rank, s2)));
  return out;
}

function unpairedCombos(high: number, low: number, kind: 's' | 'o' | 'any'): Combo[] {
  const out: Combo[] = [];
  for (let s1 = 0; s1 < 4; s1++)
    for (let s2 = 0; s2 < 4; s2++) {
      const suited = s1 === s2;
      if ((kind === 's' && !suited) || (kind === 'o' && suited)) continue;
      out.push(makeCombo(makeCard(high, s1), makeCard(low, s2)));
    }
  return out;
}

function parseClassParts(r1: string, r2: string, suffix: string | undefined, token: string) {
  let high = rankIndex(r1);
  let low = rankIndex(r2);
  if (high < low) [high, low] = [low, high];
  const kind = (suffix?.toLowerCase() ?? 'any') as 's' | 'o' | 'any';
  if (high === low && kind !== 'any') throw new Error(`Pair cannot be suited or offsuit: "${token}"`);
  return { high, low, kind };
}

function parseToken(token: string): Combo[] {
  if (EXACT_RE.test(token)) {
    const [a, b] = parseCards(token) as [Card, Card];
    return [makeCombo(a, b)];
  }

  const cls = CLASS_RE.exec(token);
  if (cls) {
    const { high, low, kind } = parseClassParts(cls[1]!, cls[2]!, cls[3], token);
    const plus = cls[4] === '+';
    if (high === low) {
      const out: Combo[] = [];
      for (let r = high; r <= (plus ? 12 : high); r++) out.push(...pairCombos(r));
      return out;
    }
    const out: Combo[] = [];
    for (let k = low; k <= (plus ? high - 1 : low); k++) out.push(...unpairedCombos(high, k, kind));
    return out;
  }

  const span = SPAN_RE.exec(token);
  if (span) {
    const a = parseClassParts(span[1]!, span[2]!, span[3], token);
    const b = parseClassParts(span[4]!, span[5]!, span[6], token);
    const aPair = a.high === a.low;
    const bPair = b.high === b.low;
    if (aPair && bPair) {
      const out: Combo[] = [];
      for (let r = Math.min(a.high, b.high); r <= Math.max(a.high, b.high); r++) out.push(...pairCombos(r));
      return out;
    }
    if (!aPair && !bPair && a.high === b.high && a.kind === b.kind) {
      const out: Combo[] = [];
      for (let k = Math.min(a.low, b.low); k <= Math.max(a.low, b.low); k++) out.push(...unpairedCombos(a.high, k, a.kind));
      return out;
    }
    throw new Error(`Invalid range span: "${token}"`);
  }

  throw new Error(`Invalid range token: "${token}"`);
}

/** Parses "AA, 77+, 22-55, AJs+, KQo, A2s-A5s, AK, AsKs" into unique combos. */
export function parseRange(text: string): Combo[] {
  const byKey = new Map<number, Combo>();
  for (const token of text.split(/[\s,]+/).filter(Boolean)) {
    for (const combo of parseToken(token)) byKey.set(comboKey(combo), combo);
  }
  return [...byKey.values()].sort((x, y) => comboKey(y) - comboKey(x));
}

export function removeDead(combos: readonly Combo[], dead: readonly Card[]): Combo[] {
  const deadSet = new Set(dead);
  return combos.filter(([a, b]) => !deadSet.has(a) && !deadSet.has(b));
}

export const rangeCombos = (text: string, dead: readonly Card[] = []): Combo[] => removeDead(parseRange(text), dead);

export function handClassOf(combo: Combo): HandClass {
  const r1 = rankOf(combo[0]);
  const r2 = rankOf(combo[1]);
  const high = Math.max(r1, r2);
  const low = Math.min(r1, r2);
  if (high === low) return RANK_CHARS[high]!.repeat(2);
  return RANK_CHARS[high]! + RANK_CHARS[low]! + (suitOf(combo[0]) === suitOf(combo[1]) ? 's' : 'o');
}

// Grid: row/column 0 = ace … 12 = deuce. Pairs on the diagonal, suited above it, offsuit below.
const gridRank = (index: number): number => 12 - index;

export function gridLabel(row: number, col: number): HandClass {
  if (row === col) return RANK_CHARS[gridRank(row)]!.repeat(2);
  const high = gridRank(Math.min(row, col));
  const low = gridRank(Math.max(row, col));
  return RANK_CHARS[high]! + RANK_CHARS[low]! + (row < col ? 's' : 'o');
}

export function gridCellOf(handClass: HandClass): [number, number] {
  const m = CLASS_RE.exec(handClass);
  if (!m || m[4]) throw new Error(`Invalid hand class: "${handClass}"`);
  const { high, low, kind } = parseClassParts(m[1]!, m[2]!, m[3], handClass);
  if (high === low) return [gridRank(high), gridRank(high)];
  if (kind === 'any') throw new Error(`Hand class needs s or o: "${handClass}"`);
  return kind === 's' ? [gridRank(high), gridRank(low)] : [gridRank(low), gridRank(high)];
}

export const classCombos = (handClass: HandClass): Combo[] => parseToken(handClass);

/** Fraction (0..1) of each cell's combos present in the list. */
export function combosToGrid(combos: readonly Combo[]): number[][] {
  const counts = Array.from({ length: 13 }, () => new Array<number>(13).fill(0));
  for (const combo of combos) {
    const [r, c] = gridCellOf(handClassOf(combo));
    counts[r]![c]!++;
  }
  return counts.map((row, r) => row.map((n, c) => n / classCombos(gridLabel(r, c)).length));
}

export function gridToCombos(selected: readonly (readonly boolean[])[]): Combo[] {
  const out: Combo[] = [];
  for (let r = 0; r < 13; r++)
    for (let c = 0; c < 13; c++) if (selected[r]?.[c]) out.push(...classCombos(gridLabel(r, c)));
  return out;
}

// ---------- whole hand classes ----------

export interface ClassRange {
  /** Hand classes the range covers completely. */
  classes: Set<HandClass>;
  /** Classes the range covers only partly (e.g. "AsKs" alone covers 1 of 4 AKs combos). */
  partial: HandClass[];
}

/** Splits a range into fully covered hand classes and partly covered ones. */
export function classRange(text: string): ClassRange {
  const counts = new Map<HandClass, number>();
  for (const combo of parseRange(text)) {
    const cls = handClassOf(combo);
    counts.set(cls, (counts.get(cls) ?? 0) + 1);
  }
  const classes = new Set<HandClass>();
  const partial: HandClass[] = [];
  for (const [cls, n] of counts) {
    if (n === classCombos(cls).length) classes.add(cls);
    else partial.push(cls);
  }
  return { classes, partial };
}

/** All combos of the given hand classes, without combos using dead cards. */
export function classesToCombos(classes: Iterable<HandClass>, dead: readonly Card[] = []): Combo[] {
  const out: Combo[] = [];
  for (const cls of classes) out.push(...classCombos(cls));
  return removeDead(out, dead);
}

/**
 * Shortest usual notation for a set of hand classes: "22-JJ, AQs+, A2s-A5s, KTo+".
 * Pairs first, then suited and offsuit hands by high card. parseRange(formatRange(x)) gives x back.
 */
export function formatRange(classes: Iterable<HandClass>): string {
  const set = new Set(classes);
  const parts: string[] = [];
  const r = (rank: number) => RANK_CHARS[rank]!;

  /** Runs of consecutive ranks from `top` down to 0 for which `has` is true, highest first. */
  const runs = (top: number, has: (rank: number) => boolean): Array<[number, number]> => {
    const out: Array<[number, number]> = [];
    let rank = top;
    while (rank >= 0) {
      if (!has(rank)) {
        rank--;
        continue;
      }
      const high = rank;
      while (rank >= 0 && has(rank)) rank--;
      out.push([rank + 1, high]);
    }
    return out;
  };

  for (const [low, high] of runs(12, (k) => set.has(r(k) + r(k)))) {
    if (low === high) parts.push(r(low) + r(low));
    else if (high === 12) parts.push(`${r(low)}${r(low)}+`);
    else parts.push(`${r(low)}${r(low)}-${r(high)}${r(high)}`);
  }
  for (const kind of ['s', 'o'] as const) {
    for (let h = 12; h >= 1; h--) {
      const cls = (k: number) => r(h) + r(k) + kind;
      for (const [low, high] of runs(h - 1, (k) => set.has(cls(k)))) {
        if (low === high) parts.push(cls(low));
        else if (high === h - 1) parts.push(`${cls(low)}+`);
        else parts.push(`${cls(low)}-${cls(high)}`);
      }
    }
  }
  return parts.join(', ');
}

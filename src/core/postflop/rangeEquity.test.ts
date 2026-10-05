import { describe, expect, it } from 'vitest';
import type { Card } from '../cards';
import { parseCards, remainingDeck } from '../cards';
import { handValue } from '../evaluator';
import type { Combo } from '../range';
import { rangeCombos } from '../range';
import { createRng, randomInt } from '../rng';
import { referenceEquityCounts } from '../testing/referenceEvaluator';
import { builtInProfile } from './profiles';
import type { EquityCount } from './rangeEquity';
import { comboIndex, equityOf, rangeEquities, rangeEquity } from './rangeEquity';
import { openRange } from './scenarios';
import { classesToCombos } from '../range';

const shares = (a: Combo, b: Combo) => a[0] === b[0] || a[0] === b[1] || a[1] === b[0] || a[1] === b[1];

/** Straightforward triple loop: every runout × hero combo × villain combo, compared directly. */
function naiveRangeEquity(flop: Card[], hero: Combo[], villain: Combo[]): EquityCount {
  const deck = remainingDeck(flop);
  const live = (c: Combo) => !flop.includes(c[0]) && !flop.includes(c[1]);
  const h = hero.filter(live);
  const v = villain.filter(live);
  const buf = new Int32Array(7);
  buf.set(flop, 2);
  const value = (c: Combo) => {
    buf[0] = c[0];
    buf[1] = c[1];
    return handValue(buf, 7);
  };
  let points = 0;
  let triples = 0;
  for (let i = 0; i < deck.length; i++)
    for (let j = i + 1; j < deck.length; j++) {
      const t = deck[i]!;
      const r = deck[j]!;
      buf[5] = t;
      buf[6] = r;
      const onRunout = (c: Combo) => c[0] === t || c[0] === r || c[1] === t || c[1] === r;
      const hv = h.map((c) => (onRunout(c) ? -1 : value(c)));
      const vv = v.map((c) => (onRunout(c) ? -1 : value(c)));
      for (let a = 0; a < h.length; a++) {
        if (hv[a]! < 0) continue;
        for (let b = 0; b < v.length; b++) {
          if (vv[b]! < 0 || shares(h[a]!, v[b]!)) continue;
          const d = hv[a]! - vv[b]!;
          points += d > 0 ? 2 : d === 0 ? 1 : 0;
          triples++;
        }
      }
    }
  return { points, triples };
}

describe('range vs range equity', () => {
  it('matches the naive triple loop exactly (UTG open vs BB defence, Ks 7d 2c)', () => {
    const flop = parseCards('Ks 7d 2c');
    const hero = classesToCombos(openRange('UTG'));
    const villain = classesToCombos(builtInProfile('baseline').ranges.bbVsEarly);
    expect(rangeEquity(flop, hero, villain)).toEqual(naiveRangeEquity(flop, hero, villain));
  });

  it('handles overlapping ranges and card removal exactly (same combos on both sides)', () => {
    const flop = parseCards('Ah Kh 5c');
    const hero = rangeCombos('AA, KK, AKs, QhJh, 55, 76s');
    const villain = rangeCombos('AA, KK, AKs, QJs, 76s, 22');
    expect(rangeEquity(flop, hero, villain)).toEqual(naiveRangeEquity(flop, hero, villain));
  });

  it('agrees with the independent reference evaluator on small ranges', () => {
    const flop = parseCards('9h 8h 4h');
    const hero = rangeCombos('AhQd, Th7c, 9s9c');
    const villain = rangeCombos('KhKd, 8s4s, Jh2c, QsTd');
    let points = 0;
    let triples = 0;
    for (const a of hero)
      for (const b of villain) {
        if (shares(a, b)) continue;
        const r = referenceEquityCounts(a, b, flop, remainingDeck([...a, ...b, ...flop]));
        points += 2 * r.wins + r.ties;
        triples += r.boards;
      }
    expect(rangeEquity(flop, hero, villain)).toEqual({ points, triples });
  });

  it('agrees with an independent Monte Carlo (200 000 random triples, ±0.5 pp)', () => {
    const flop = parseCards('Ks 7d 2c');
    const live = (c: Combo) => !flop.includes(c[0]) && !flop.includes(c[1]);
    const hero = classesToCombos(openRange('UTG')).filter(live);
    const villain = classesToCombos(builtInProfile('loose-live').ranges.bbVsEarly).filter(live);
    const exact = equityOf(rangeEquity(flop, hero, villain));

    // Uniform over valid (hero, villain) pairs by rejection; every pair has the same number of runouts.
    const rng = createRng(20261005);
    let points = 0;
    const trials = 200_000;
    for (let t = 0; t < trials; t++) {
      let a: Combo;
      let b: Combo;
      do {
        a = hero[randomInt(rng, hero.length)]!;
        b = villain[randomInt(rng, villain.length)]!;
      } while (shares(a, b));
      const deck = remainingDeck([...flop, ...a, ...b]);
      const i = randomInt(rng, deck.length);
      let j = randomInt(rng, deck.length - 1);
      if (j >= i) j++;
      const board = [...flop, deck[i]!, deck[j]!];
      const d = handValue([...a, ...board]) - handValue([...b, ...board]);
      points += d > 0 ? 2 : d === 0 ? 1 : 0;
    }
    const mc = points / (2 * trials);
    expect(Math.abs(mc - exact) * 100).toBeLessThan(0.5);
    expect(exact * 100).toBeCloseTo(65.93, 2);
  });

  it('computes several matchups in one pass with the same results', () => {
    const flop = parseCards('7h 6h 5c');
    const hero = classesToCombos(openRange('BTN'));
    const a = classesToCombos(builtInProfile('baseline').ranges.bbVsLate);
    const b = classesToCombos(builtInProfile('loose-live').ranges.bbVsLate);
    const [ra, rb] = rangeEquities(flop, [hero, a, b], [
      { hero: 0, villain: 1 },
      { hero: 0, villain: 2 },
    ]);
    expect(ra).toEqual(rangeEquity(flop, hero, a));
    expect(rb).toEqual(rangeEquity(flop, hero, b));
  });

  it('reports progress up to all 1176 runouts', () => {
    const calls: number[] = [];
    rangeEquity(parseCards('Ks 7d 2c'), rangeCombos('AA'), rangeCombos('KK'), (done, total) => {
      expect(total).toBe(1176);
      calls.push(done);
    });
    expect(calls[calls.length - 1]).toBe(1176);
    expect(calls).toEqual([...calls].sort((x, y) => x - y));
  });

  it('indexes all 1326 combos uniquely', () => {
    const seen = new Set<number>();
    for (let a = 0; a < 52; a++) for (let b = 0; b < a; b++) seen.add(comboIndex(a, b));
    expect(seen.size).toBe(1326);
    expect(Math.max(...seen)).toBe(1325);
    expect(comboIndex(5, 9)).toBe(comboIndex(9, 5));
  });
});

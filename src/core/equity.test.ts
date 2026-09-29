import { describe, expect, it } from 'vitest';
import { parseCards, remainingDeck } from './cards';
import { equityExact, equityMonteCarlo } from './equity';
import { referenceEquityCounts } from './testing/referenceEvaluator';

const pct = (x: number) => x * 100;
/** Table values are rounded to 3 decimals, so the exact value must round to them. */
const expectRounded = (actualFraction: number, expectedPct: number) =>
  expect(Math.abs(pct(actualFraction) - expectedPct)).toBeLessThanOrEqual(0.0005 + 1e-9);

describe('equity: preflop exact enumeration (1,712,304 boards)', () => {
  const cases: Array<[string, string, number, number]> = [
    ['As Ah', 'Kd Kc', 81.065, 0.382],
    ['Ah Kh', '2s 2c', 49.77, 0.629],
    ['Ah Kd', 'Qs Qc', 42.664, 0.342],
  ];
  for (const [hero, villain, win, tie] of cases) {
    it(`${hero} vs ${villain}: win ${win}%, tie ${tie}%`, () => {
      const r = equityExact(parseCards(hero), parseCards(villain));
      expect(r.boards).toBe(1_712_304);
      expect(r.wins + r.ties + r.losses).toBe(r.boards);
      expectRounded(r.win, win);
      expectRounded(r.tie, tie);
      expect(r.equity).toBeCloseTo(r.win + r.tie / 2, 12);
    });
  }
});

describe('equity: postflop exact', () => {
  const cases: Array<[string, string, string, number, number]> = [
    ['Ah 5h', 'Ks Kd', 'Kh 9h 2c', 25.556, 990],
    ['8s 7s', 'Ad Ac', '6h 5d 2c', 34.242, 990],
    ['Ah 5h', 'Ks Kd', 'Kh 9h 2c 3d', 22.727, 44],
  ];
  for (const [hero, villain, board, win, boards] of cases) {
    it(`${hero} vs ${villain} on ${board}: win ${win}% over ${boards} boards`, () => {
      const h = parseCards(hero);
      const v = parseCards(villain);
      const b = parseCards(board);
      const r = equityExact(h, v, b);
      expect(r.boards).toBe(boards);
      expectRounded(r.win, win);

      // Independent check with the naive reference evaluator.
      const ref = referenceEquityCounts(h, v, b, remainingDeck([...h, ...v, ...b]));
      expect({ wins: r.wins, ties: r.ties, losses: r.losses, boards: r.boards }).toEqual(ref);
    });
  }

  it('river: a single showdown', () => {
    const r = equityExact(parseCards('Ah Kh'), parseCards('Qs Qc'), parseCards('2d 7c 9s Jd Kc'));
    expect(r.boards).toBe(1);
    expect(r.wins).toBe(1);
    expect(r.equity).toBe(1);
  });

  it('dead cards are removed from the deck', () => {
    const r = equityExact(parseCards('Ah 5h'), parseCards('Ks Kd'), parseCards('Kh 9h 2c 3d'), parseCards('4s 4c'));
    expect(r.boards).toBe(42);
    expect(r.wins).toBe(8);
  });
});

describe('equity: validation', () => {
  it('rejects duplicate cards', () => {
    expect(() => equityExact(parseCards('As Ah'), parseCards('As Kc'))).toThrow();
    expect(() => equityExact(parseCards('As Ah'), parseCards('Kd Kc'), parseCards('As 2c 3c'))).toThrow();
  });
  it('rejects bad hand or board sizes', () => {
    expect(() => equityExact(parseCards('As'), parseCards('Kd Kc'))).toThrow();
    expect(() => equityExact(parseCards('As Ah'), parseCards('Kd Kc'), parseCards('2c 3c'))).toThrow();
  });
});

describe('equity: Monte Carlo', () => {
  it('AsAh vs KdKc with 200,000 trials is within 0.5 pp of the exact value', () => {
    const exact = 0.81065 + 0.00382 / 2;
    const r = equityMonteCarlo(parseCards('As Ah'), parseCards('Kd Kc'), [], { trials: 200_000, seed: 2024 });
    expect(r.boards).toBe(200_000);
    expect(Math.abs(r.equity - exact)).toBeLessThan(0.005);
  });

  it('is reproducible with the same seed and defaults to 50,000 trials', () => {
    const a = equityMonteCarlo(parseCards('Ah Kh'), parseCards('2s 2c'), [], { seed: 99 });
    const b = equityMonteCarlo(parseCards('Ah Kh'), parseCards('2s 2c'), [], { seed: 99 });
    expect(a).toEqual(b);
    expect(a.boards).toBe(50_000);
  });

  it('works postflop too', () => {
    const r = equityMonteCarlo(parseCards('8s 7s'), parseCards('Ad Ac'), parseCards('6h 5d 2c'), {
      trials: 100_000,
      seed: 5,
    });
    expect(Math.abs(r.win - 0.34242)).toBeLessThan(0.01);
  });
});

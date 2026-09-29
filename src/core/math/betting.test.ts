import { describe, expect, it } from 'vitest';
import { createRng } from '../rng';
import { STARTING_STACK, generateBetSpot, roundBet, stackBehind } from './betting';

describe('betting spots', () => {
  it('rounds bets to $5 with a $5 minimum', () => {
    expect(roundBet(21.7)).toBe(20);
    expect(roundBet(22.5)).toBe(25);
    expect(roundBet(2)).toBe(5);
  });

  it('assumes the hero put half of the pot in', () => {
    expect(stackBehind(100)).toBe(STARTING_STACK - 50);
    expect(stackBehind(15)).toBe(STARTING_STACK - 8);
  });

  it('generates realistic spots: pot $15-$300, bet ≤ stack, standard sizes', () => {
    const allowed = [1 / 3, 1 / 2, 2 / 3, 3 / 4, 1, 1.5];
    for (let seed = 1; seed <= 2000; seed++) {
      const s = generateBetSpot(createRng(seed));
      expect(s.pot).toBeGreaterThanOrEqual(15);
      expect(s.pot).toBeLessThanOrEqual(300);
      expect(Number.isInteger(s.pot)).toBe(true);
      expect(s.stack).toBe(stackBehind(s.pot));
      expect(s.bet).toBeGreaterThan(0);
      expect(s.bet).toBeLessThanOrEqual(s.stack);
      expect(s.allIn).toBe(s.bet === s.stack);
      if (s.fraction !== null) {
        expect(allowed).toContain(s.fraction);
        expect(s.bet).toBe(roundBet(s.pot * s.fraction));
      } else {
        expect(s.allIn).toBe(true);
      }
    }
  });

  it('never goes all-in when all-in is not allowed', () => {
    for (let seed = 1; seed <= 1000; seed++) {
      const s = generateBetSpot(createRng(seed), { allowAllIn: false });
      expect(s.bet).toBeLessThan(s.stack);
      expect(s.allIn).toBe(false);
    }
  });

  it('forced all-in shoves are between 0.5x and 2x pot', () => {
    for (let seed = 1; seed <= 1000; seed++) {
      const s = generateBetSpot(createRng(seed), { forceAllIn: true });
      expect(s.allIn).toBe(true);
      expect(s.bet).toBe(s.stack);
      expect(s.bet).toBeLessThanOrEqual(2 * s.pot);
      expect(s.bet).toBeGreaterThanOrEqual(0.5 * s.pot);
    }
  });
});

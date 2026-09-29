import { describe, expect, it } from 'vitest';
import { createRng, randomInt, shuffleInPlace } from './rng';

describe('rng', () => {
  it('is deterministic for a given seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });

  it('differs between seeds and stays in [0, 1)', () => {
    const a = createRng(1);
    const b = createRng(2);
    let same = 0;
    for (let i = 0; i < 1000; i++) {
      const x = a();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
      if (x === b()) same++;
    }
    expect(same).toBeLessThan(5);
  });

  it('randomInt covers the whole range uniformly enough', () => {
    const rng = createRng(7);
    const counts = new Array<number>(6).fill(0);
    for (let i = 0; i < 60_000; i++) counts[randomInt(rng, 6)]!++;
    for (const c of counts) expect(Math.abs(c - 10_000)).toBeLessThan(500);
  });

  it('shuffle keeps all elements', () => {
    const arr = Array.from({ length: 52 }, (_, i) => i);
    shuffleInPlace(arr, createRng(3));
    expect([...arr].sort((x, y) => x - y)).toEqual(Array.from({ length: 52 }, (_, i) => i));
  });
});

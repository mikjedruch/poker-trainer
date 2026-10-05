import { describe, expect, it } from 'vitest';
import { parseCards } from '../cards';
import type { Height, Suits } from './texture';
import { flopTexture, heightOf } from './texture';

// Required texture table from the specification (height: A/K/Q high, J–9 middle, 8 and lower low).
const CASES: Array<[string, Suits, number, number, boolean, Height, boolean]> = [
  ['Ks 7d 2c', 'rainbow', 0, 0, false, 'high', false],
  ['7h 6h 5c', 'twoTone', 3, 21, true, 'low', false],
  ['Qs Jd Tc', 'rainbow', 3, 21, true, 'high', false],
  ['8s 8d 3c', 'rainbow', 0, 0, false, 'low', true],
  ['Ah Kh 5c', 'twoTone', 0, 0, true, 'high', false],
  ['9h 8h 4h', 'monotone', 0, 3, true, 'middle', false],
  ['Td 6s 2c', 'rainbow', 0, 0, false, 'middle', false],
];

describe('flop texture', () => {
  it.each(CASES)('%s', (flop, suits, straightPairs, oesdPairs, wet, height, paired) => {
    const t = flopTexture(parseCards(flop));
    expect(t.suits).toBe(suits);
    expect(t.straightPairs).toBe(straightPairs);
    expect(t.oesdPairs).toBe(oesdPairs);
    expect(t.wet).toBe(wet);
    expect(t.height).toBe(height);
    expect(t.paired).toBe(paired);
  });

  it('lists the rank pairs that make a straight', () => {
    expect(flopTexture(parseCards('7h 6h 5c')).straightRankPairs).toEqual([
      [1, 2],
      [2, 6],
      [6, 7],
    ]);
    expect(flopTexture(parseCards('Qs Jd Tc')).straightRankPairs).toEqual([
      [6, 7],
      [7, 11],
      [11, 12],
    ]);
  });

  it('wheel straights count: A-2-3 makes a straight with 4-5', () => {
    const t = flopTexture(parseCards('As 2d 3c'));
    expect(t.straightRankPairs).toContainEqual([2, 3]);
    expect(t.straightPairs).toBeGreaterThan(0);
    expect(t.wet).toBe(true);
  });

  it('height thresholds by the highest card', () => {
    expect(heightOf(parseCards('Qd 3c 2s'))).toBe('high');
    expect(heightOf(parseCards('Jd 3c 2s'))).toBe('middle');
    expect(heightOf(parseCards('9d 3c 2s'))).toBe('middle');
    expect(heightOf(parseCards('8d 3c 2s'))).toBe('low');
  });

  it('a paired board can never make a straight with two hole cards', () => {
    const t = flopTexture(parseCards('7s 7d 6c'));
    expect(t.straightPairs).toBe(0);
    expect(t.oesdPairs).toBeGreaterThan(0);
  });

  it('rejects anything that is not three distinct cards', () => {
    expect(() => flopTexture(parseCards('Ks 7d'))).toThrow();
    expect(() => flopTexture([0, 0, 1])).toThrow();
  });
});

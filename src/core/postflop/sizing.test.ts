import { describe, expect, it } from 'vitest';
import { createRng } from '../rng';
import { SIZING_FRACTIONS, bluffShare, fractionText, generateSizingTask, isSizingCorrect, minimumDefense, sizingNumbers, sizingTask } from './sizing';

describe('sizing', () => {
  it('bluff share s / (1 + 2s): examples from the specification', () => {
    expect(bluffShare(1 / 3) * 100).toBeCloseTo(20, 10);
    expect(bluffShare(1 / 2) * 100).toBeCloseTo(25, 10);
    expect(bluffShare(2 / 3) * 100).toBeCloseTo(28.571, 3);
    expect(bluffShare(1) * 100).toBeCloseTo(33.333, 3);
  });

  it('MDF 1 / (1 + s)', () => {
    expect(minimumDefense(1 / 2) * 100).toBeCloseTo(66.667, 3);
    expect(minimumDefense(1) * 100).toBeCloseTo(50, 10);
    expect(minimumDefense(2) * 100).toBeCloseTo(33.333, 3);
  });

  it('slider numbers: equity needed to call equals the bluff share', () => {
    const n = sizingNumbers(0.75);
    expect(n.callEquity).toBeCloseTo(n.bluffShare, 12);
    expect(n.mdf).toBeCloseTo(1 / 1.75, 12);
  });

  it('dollar amounts give the same answer as the fraction', () => {
    const t = sizingTask('bluff', { num: 2, den: 3 }, 60);
    expect(t.bet).toBe(40);
    expect(t.answerPct).toBeCloseTo((40 / (60 + 80)) * 100, 10);
    const m = sizingTask('mdf', { num: 3, den: 4 }, 48);
    expect(m.answerPct).toBeCloseTo((48 / (48 + 36)) * 100, 10);
  });

  it('±2 pp tolerance', () => {
    const t = sizingTask('bluff', { num: 1, den: 2 }, 24);
    expect(isSizingCorrect(t, 25)).toBe(true);
    expect(isSizingCorrect(t, 27)).toBe(true);
    expect(isSizingCorrect(t, 23)).toBe(true);
    expect(isSizingCorrect(t, 27.1)).toBe(false);
    expect(isSizingCorrect(t, Number.NaN)).toBe(false);
  });

  it('random tasks: sizes from the list, whole-dollar bets, both questions', () => {
    const rng = createRng(5);
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i++) {
      const t = generateSizingTask(rng);
      expect(SIZING_FRACTIONS).toContainEqual(t.size);
      expect(Number.isInteger(t.bet)).toBe(true);
      expect(t.pot).toBeGreaterThanOrEqual(24);
      expect(t.pot).toBeLessThanOrEqual(240);
      expect(t.bet / t.pot).toBeCloseTo(t.size.num / t.size.den, 12);
      expect(isSizingCorrect(t, t.answerPct)).toBe(true);
      expect(t.formulas.length).toBeGreaterThan(0);
      seen.add(t.question);
    }
    expect(seen).toEqual(new Set(['bluff', 'mdf']));
  });
});

describe('sizing text', () => {
  it('names the size as the object of "Betujesz …"', () => {
    expect(fractionText({ num: 1, den: 3 })).toBe('1/3 puli');
    expect(fractionText({ num: 1, den: 1 })).toBe('pulę');
    expect(fractionText({ num: 3, den: 2 })).toBe('1.5× pulę');
    expect(fractionText({ num: 2, den: 1 })).toBe('2× pulę');
  });
});

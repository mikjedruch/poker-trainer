import { describe, expect, it } from 'vitest';
import type { HandCat, RangeSummary } from './categories';
import { HAND_CATEGORIES, emptyCounts } from './categories';
import type { DecisionColumn, HandContext } from './rule';
import { boardStrategy, decisionLabel, formatPp, handDecision } from './rule';

const summary = (combos: number, strong: number): RangeSummary => ({ combos, counts: { ...emptyCounts(), strong, nothing: combos - strong } });

describe('board strategy (reguła bazowa v1)', () => {
  it('E < 50 → mostly check', () => {
    const d = boardStrategy({ points: 99, triples: 100 }, summary(100, 10), summary(100, 0), false);
    expect(d.strategy).toBe('check');
    expect(d.rules).toEqual(['lowEquity']);
  });

  it('exactly 50% equity is not "below 50"', () => {
    expect(boardStrategy({ points: 100, triples: 100 }, summary(100, 0), summary(100, 0), false).strategy).toBe('small');
  });

  it('N < −3 pp → mostly check even with an equity edge', () => {
    const d = boardStrategy({ points: 120, triples: 100 }, summary(100, 1), summary(100, 5), false);
    expect(d.nutPp).toBeCloseTo(-4, 10);
    expect(d.strategy).toBe('check');
    expect(d.rules).toEqual(['nutDisadvantage']);
  });

  it('N exactly −3 pp is not below −3', () => {
    expect(boardStrategy({ points: 120, triples: 100 }, summary(100, 2), summary(100, 5), true).strategy).toBe('large');
  });

  it('both reasons are reported', () => {
    expect(boardStrategy({ points: 90, triples: 100 }, summary(100, 0), summary(100, 9), false).rules).toEqual([
      'lowEquity',
      'nutDisadvantage',
    ]);
  });

  it('dry → small, wet → large', () => {
    expect(boardStrategy({ points: 110, triples: 100 }, summary(50, 2), summary(80, 2), false)).toMatchObject({
      strategy: 'small',
      ruleNumber: 2,
    });
    expect(boardStrategy({ points: 110, triples: 100 }, summary(50, 2), summary(80, 2), true)).toMatchObject({
      strategy: 'large',
      ruleNumber: 3,
    });
  });

  it('formats N with a sign', () => {
    expect(formatPp(1.37)).toBe('+1.4 pp');
    expect(formatPp(-5.56)).toBe('−5.6 pp');
    expect(formatPp(-0.04)).toBe('0.0 pp');
    expect(formatPp(0.01)).toBe('0.0 pp');
  });
});

describe('decision table (specification)', () => {
  const base: HandContext = { callsTooMuch: false, inPosition: true };
  const loose: HandContext = { callsTooMuch: true, inPosition: true };
  const oop: HandContext = { callsTooMuch: false, inPosition: false };

  // [category, small, large (baseline), large (loose-live), check, multiway]
  const TABLE: Array<[HandCat, string, string, string, string, string]> = [
    ['strong', 'bet 1/3', 'bet 2/3', 'bet 2/3', 'bet 2/3', 'bet 1/2'],
    ['tpGood', 'bet 1/3', 'bet 2/3', 'bet 2/3', 'check', 'bet 1/2'],
    ['tpWeak', 'bet 1/3', 'check', 'bet 2/3', 'check', 'check'],
    ['weakPair', 'bet 1/3', 'check', 'check', 'check', 'check'],
    ['draw', 'bet 1/3', 'bet 2/3', 'bet 2/3', 'check', 'bet 1/2'],
    ['nothing', 'bet 1/3', 'check', 'check', 'check', 'check'],
  ];
  const label = (c: HandCat, col: DecisionColumn, ctx: HandContext) => decisionLabel(handDecision(c, col, ctx));

  it.each(TABLE)('%s', (category, small, largeBase, largeLoose, check, multiway) => {
    expect(label(category, 'small', base)).toBe(small);
    expect(label(category, 'large', base)).toBe(largeBase);
    expect(label(category, 'large', loose)).toBe(largeLoose);
    expect(label(category, 'check', base)).toBe(check);
    expect(label(category, 'check', loose)).toBe(check);
    expect(label(category, 'multiway', base)).toBe(multiway);
    expect(label(category, 'multiway', loose)).toBe(multiway);
  });

  it('nothing with a small c-bet: bet only against baseline and in position', () => {
    expect(label('nothing', 'small', base)).toBe('bet 1/3');
    expect(label('nothing', 'small', loose)).toBe('check');
    expect(label('nothing', 'small', oop)).toBe('check');
    expect(label('nothing', 'small', { callsTooMuch: true, inPosition: false })).toBe('check');
    expect(handDecision('nothing', 'small', { callsTooMuch: true, inPosition: false }).reasons).toHaveLength(2);
  });

  it('out of position only changes the "nothing" row', () => {
    for (const c of HAND_CATEGORIES) {
      if (c === 'nothing') continue;
      for (const col of ['small', 'large', 'check', 'multiway'] as const) expect(label(c, col, oop)).toBe(label(c, col, base));
    }
  });

  it('every decision explains itself', () => {
    for (const c of HAND_CATEGORIES)
      for (const col of ['small', 'large', 'check', 'multiway'] as const)
        for (const ctx of [base, loose, oop]) expect(handDecision(c, col, ctx).reasons.length).toBeGreaterThan(0);
  });
});

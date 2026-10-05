import { describe, expect, it } from 'vitest';
import { parseCards } from '../cards';
import { shareOf } from './categories';
import { analyzeHeadsUp } from './analysis';
import type { BoardStrategy } from './rule';
import { builtInProfile } from './profiles';
import type { HuScenario } from './scenarios';

// Required analysis table from the specification. Tolerance: equity ±0.01 pp, category shares ±0.1 pp.
type Row = [string, HuScenario, string, number, [number, number], [number, number], [number, number], BoardStrategy];
const ROWS: Row[] = [
  ['Ks 7d 2c', 'P1', 'baseline', 59.87, [4.2, 2.9], [29.6, 17.1], [0.0, 0.0], 'small'],
  ['Ks 7d 2c', 'P1', 'loose-live', 65.93, [4.2, 2.9], [29.6, 15.2], [0.0, 0.0], 'small'],
  ['Ks 7d 2c', 'P3', 'baseline', 54.12, [2.6, 2.1], [20.1, 16.8], [0.0, 0.0], 'small'],
  ['Ks 7d 2c', 'P3', 'loose-live', 54.95, [2.6, 2.9], [20.1, 15.2], [0.0, 0.0], 'small'],
  ['7h 6h 5c', 'P1', 'baseline', 50.71, [4.0, 9.5], [31.8, 25.2], [10.6, 13.3], 'check'],
  ['7h 6h 5c', 'P1', 'loose-live', 52.91, [4.0, 8.4], [31.8, 22.9], [10.6, 21.0], 'check'],
  ['7h 6h 5c', 'P3', 'baseline', 49.57, [4.6, 9.2], [21.1, 22.3], [12.2, 13.1], 'check'],
  ['7h 6h 5c', 'P3', 'loose-live', 48.86, [4.6, 8.4], [21.1, 22.9], [12.2, 21.0], 'check'],
];

const pp = (x: number) => x * 100;

describe('heads-up range analysis (specification table)', () => {
  it.each(ROWS)('%s %s %s', (flop, scenario, profileId, e, strong, tpPlus, draw, strategy) => {
    const a = analyzeHeadsUp(scenario, builtInProfile(profileId), parseCards(flop));
    expect(Math.abs(a.strategy.equityPct - e)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(pp(shareOf(a.hero, 'strong')) - strong[0])).toBeLessThanOrEqual(0.1);
    expect(Math.abs(pp(shareOf(a.villain, 'strong')) - strong[1])).toBeLessThanOrEqual(0.1);
    expect(Math.abs(pp(shareOf(a.hero, 'tpPlus')) - tpPlus[0])).toBeLessThanOrEqual(0.1);
    expect(Math.abs(pp(shareOf(a.villain, 'tpPlus')) - tpPlus[1])).toBeLessThanOrEqual(0.1);
    expect(Math.abs(pp(shareOf(a.hero, 'draw')) - draw[0])).toBeLessThanOrEqual(0.1);
    expect(Math.abs(pp(shareOf(a.villain, 'draw')) - draw[1])).toBeLessThanOrEqual(0.1);
    expect(a.strategy.strategy).toBe(strategy);
  });

  it('N is hero strong share minus villain strong share, in percentage points', () => {
    const a = analyzeHeadsUp('P1', builtInProfile('baseline'), parseCards('7h 6h 5c'));
    expect(a.strategy.nutPp).toBeCloseTo(pp(shareOf(a.hero, 'strong') - shareOf(a.villain, 'strong')), 10);
    expect(a.strategy.nutPp).toBeLessThan(-3);
    expect(a.strategy.rules).toEqual(['nutDisadvantage']);
    expect(a.strategy.ruleNumber).toBe(1);
  });

  it('the result does not depend on which suits the flop uses', () => {
    const a = analyzeHeadsUp('P2', builtInProfile('loose-live'), parseCards('Ah Kh 5c'));
    const b = analyzeHeadsUp('P2', builtInProfile('loose-live'), parseCards('Ad Kd 5s'));
    expect(b.equity).toEqual(a.equity);
    expect(b.hero).toEqual(a.hero);
    expect(b.villain).toEqual(a.villain);
  });
});

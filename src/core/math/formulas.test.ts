import { describe, expect, it } from 'vitest';
import {
  bluffBreakEven,
  callEv,
  impliedOddsNeeded,
  minimumDefenseFrequency,
  requiredEquity,
  ruleOf2And4,
} from './formulas';

describe('formulas', () => {
  it('required equity = X / (P + 2X)', () => {
    expect(requiredEquity(65, 40)).toBeCloseTo(40 / 145, 12);
    expect(requiredEquity(100, 100)).toBeCloseTo(1 / 3, 12);
    expect(requiredEquity(100, 50)).toBeCloseTo(0.25, 12);
  });

  it('EV(call) = e(P + 2X) − X', () => {
    expect(callEv(0.5, 100, 50)).toBeCloseTo(50, 12);
    expect(callEv(0.25, 100, 50)).toBeCloseTo(0, 12);
    expect(callEv(0.2, 100, 50)).toBeCloseTo(-10, 12);
    // EV is zero exactly at the required equity.
    expect(callEv(requiredEquity(65, 40), 65, 40)).toBeCloseTo(0, 12);
  });

  it('MDF = P / (P + X)', () => {
    expect(minimumDefenseFrequency(100, 50)).toBeCloseTo(2 / 3, 12);
    expect(minimumDefenseFrequency(100, 100)).toBeCloseTo(0.5, 12);
  });

  it('bluff break-even = X / (P + X)', () => {
    expect(bluffBreakEven(100, 50)).toBeCloseTo(1 / 3, 12);
    expect(bluffBreakEven(100, 100)).toBeCloseTo(0.5, 12);
    expect(bluffBreakEven(65, 40) + minimumDefenseFrequency(65, 40)).toBeCloseTo(1, 12);
  });

  it('implied odds W = (1 − e)X / e − P − X', () => {
    // Ah5h vs KsKd on Kh 9h 2c 3d: 10 outs of 44.
    expect(impliedOddsNeeded(10 / 44, 65, 40)).toBeCloseTo(31, 9);
    // With W added to the pot the call breaks even.
    const e = 0.2;
    const w = impliedOddsNeeded(e, 50, 50);
    expect(e * (50 + 50 + w) - (1 - e) * 50).toBeCloseTo(0, 9);
  });

  it('implied odds are 0 when the call is already +EV, infinite with zero equity', () => {
    expect(impliedOddsNeeded(0.5, 100, 50)).toBe(0);
    expect(impliedOddsNeeded(0, 100, 50)).toBe(Infinity);
  });

  it('rule of 2 and 4', () => {
    expect(ruleOf2And4(9, 'flop')).toBeCloseTo(0.36, 12);
    expect(ruleOf2And4(9, 'turn')).toBeCloseTo(0.18, 12);
    expect(ruleOf2And4(30, 'flop')).toBe(1);
  });

  it('rejects nonsense inputs', () => {
    expect(() => requiredEquity(0, 0)).toThrow();
    expect(() => requiredEquity(100, -5)).toThrow();
    expect(() => callEv(1.5, 100, 50)).toThrow();
  });
});

import { describe, expect, it } from 'vitest';
import { scenarioRanges } from '../preflop/data';
import { parseRange } from '../range';
import {
  BUILT_IN_PROFILES,
  RANGE_KEYS,
  builtInProfile,
  comboCountOf,
  copyProfile,
  fromStored,
  parseProfileRange,
  rangeSignature,
  sanitizeStoredProfiles,
  toStored,
} from './profiles';

describe('built-in profiles', () => {
  it('loose-live: 648 combos in BB defence and 328 in the cold call (specification)', () => {
    const loose = builtInProfile('loose-live');
    expect(comboCountOf(loose.ranges.bbVsEarly)).toBe(648);
    expect(comboCountOf(loose.ranges.bbVsLate)).toBe(648);
    expect(comboCountOf(loose.ranges.ccVsEarly)).toBe(328);
    expect(comboCountOf(loose.ranges.ccVsLate)).toBe(328);
    expect(loose.source).toBe('assumption-v1');
    expect(loose.callsTooMuch).toBe(true);
  });

  it('baseline reuses the preflop call ranges', () => {
    const base = builtInProfile('baseline');
    expect(base.ranges.bbVsEarly).toEqual(scenarioRanges('BB_VS_EARLY').call);
    expect(base.ranges.bbVsLate).toEqual(scenarioRanges('BB_VS_LATE').call);
    expect(base.ranges.ccVsEarly).toEqual(scenarioRanges('VS_EARLY_IP').call);
    expect(base.ranges.ccVsLate).toEqual(scenarioRanges('VS_LATE_BTN').call);
    expect(comboCountOf(base.ranges.bbVsEarly)).toBe(232);
    expect(comboCountOf(base.ranges.ccVsLate)).toBe(166);
    expect(base.callsTooMuch).toBe(false);
  });

  it('has the required fields', () => {
    for (const p of BUILT_IN_PROFILES) {
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(p.assumptions).toBeTruthy();
      expect(p.source).toBeTruthy();
      for (const k of RANGE_KEYS) expect(p.ranges[k].size).toBeGreaterThan(0);
    }
  });
});

describe('profile ranges', () => {
  it('parses references and notation, rejects partial classes', () => {
    expect(parseProfileRange('@BB_VS_EARLY.raise')).toEqual(scenarioRanges('BB_VS_EARLY').raise);
    expect([...parseProfileRange('QQ+, AKs')].sort()).toEqual(['AA', 'AKs', 'KK', 'QQ']);
    expect(parseProfileRange('')).toEqual(new Set());
    expect(() => parseProfileRange('AsKs')).toThrow(/AKs/);
    expect(() => parseProfileRange('@NOPE.call')).toThrow();
    expect(() => parseProfileRange('ZZ')).toThrow();
  });

  it('signature is the canonical notation and parses back to the same combos', () => {
    const loose = builtInProfile('loose-live');
    const sig = rangeSignature(loose.ranges.bbVsEarly);
    expect(parseRange(sig)).toHaveLength(648);
    expect(sig).toBe(rangeSignature(parseProfileRange(sig)));
  });
});

describe('custom profiles', () => {
  it('copies a profile and round-trips through storage', () => {
    const copy = copyProfile(builtInProfile('loose-live'), 'custom-1', '  Mój   stół ');
    expect(copy.name).toBe('Mój stół');
    expect(copy.builtIn).toBe(false);
    expect(copy.callsTooMuch).toBe(true);
    const back = fromStored(JSON.parse(JSON.stringify(toStored(copy, 'loose-live'))));
    expect(back).not.toBeNull();
    expect(back!.basedOn).toBe('loose-live');
    for (const k of RANGE_KEYS) expect(back!.ranges[k]).toEqual(copy.ranges[k]);
  });

  it('a copy is independent of the original', () => {
    const base = builtInProfile('baseline');
    const copy = copyProfile(base, 'custom-2', 'x');
    (copy.ranges.bbVsEarly as Set<string>).add('72o');
    expect(base.ranges.bbVsEarly.has('72o')).toBe(false);
  });

  it('survives garbage from storage', () => {
    const good = toStored(copyProfile(builtInProfile('baseline'), 'custom-3', 'Dobry'), 'baseline');
    const list = sanitizeStoredProfiles([
      good,
      good,
      { ...good, id: 'baseline' },
      { ...good, id: 'custom-4', name: '' },
      { ...good, id: 'custom-5', ranges: { ...good.ranges, ccVsLate: 'AsKs' } },
      { ...good, id: 'custom-6', ranges: { ...good.ranges, ccVsLate: '@BB_VS_LATE.call' } },
      { ...good, id: 'custom-7', callsTooMuch: 'yes' },
      null,
      42,
    ]);
    expect(list.map((p) => p.id)).toEqual(['custom-3']);
    expect(sanitizeStoredProfiles('nope')).toEqual([]);
  });
});

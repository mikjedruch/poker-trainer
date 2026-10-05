import { describe, expect, it } from 'vitest';
import rawLibrary from '../../data/flop-library.json';
import { formatCards, parseCards } from '../cards';
import { createRng } from '../rng';
import { analyzeHeadsUp } from './analysis';
import { canonicalKey, permuteSuits } from './canonical';
import { LIBRARY_PROFILES, STRATA, indexLibrary, libraryAnalysis, libraryCovers, librarySignatures, stratumOf, validateLibrary } from './library';
import { builtInProfile, copyProfile } from './profiles';
import { HU_SCENARIOS } from './scenarios';

const lib = validateLibrary(rawLibrary);
const index = indexLibrary(lib);

describe('precomputed flop library', () => {
  it('is up to date with the current ranges (otherwise run: npm run precompute)', () => {
    expect(lib.ranges).toEqual(librarySignatures());
  });

  it('150 distinct canonical flops, 10 from each of the 15 texture strata', () => {
    expect(STRATA).toHaveLength(15);
    expect(lib.flops).toHaveLength(150);
    expect(new Set(lib.flops.map((f) => f.flop)).size).toBe(150);
    for (const s of STRATA) expect(lib.flops.filter((f) => f.stratum === s)).toHaveLength(10);
    for (const f of lib.flops) {
      const cards = parseCards(f.flop);
      expect(stratumOf(cards)).toBe(f.stratum);
      expect(canonicalKey(cards)).toBe(f.flop);
    }
  });

  it('numbers equal a fresh computation (sample of flops, every scenario and profile)', () => {
    const rng = createRng(99);
    const sample = [0, 1, 2].map(() => lib.flops[Math.floor(rng() * lib.flops.length)]!);
    for (const entry of sample) {
      const flop = parseCards(entry.flop);
      for (const s of HU_SCENARIOS)
        for (const id of LIBRARY_PROFILES) {
          const fresh = analyzeHeadsUp(s, builtInProfile(id), flop);
          const stored = libraryAnalysis(index, s, builtInProfile(id), flop)!;
          expect(stored.equity).toEqual(fresh.equity);
          expect(stored.hero).toEqual(fresh.hero);
          expect(stored.villain).toEqual(fresh.villain);
          expect(stored.strategy).toEqual(fresh.strategy);
        }
    }
  });

  it('works for any suits of a library flop and keeps the actual cards', () => {
    const flop = parseCards(lib.flops[17]!.flop);
    const moved = permuteSuits(flop, [2, 0, 3, 1]);
    const a = libraryAnalysis(index, 'P2', builtInProfile('baseline'), moved)!;
    expect(formatCards(a.flop)).toBe(formatCards(moved));
    expect(a.equity).toEqual(libraryAnalysis(index, 'P2', builtInProfile('baseline'), flop)!.equity);
  });

  it('is not used for custom profiles, unknown flops or changed ranges', () => {
    const custom = copyProfile(builtInProfile('baseline'), 'custom-x', 'x');
    expect(libraryCovers(index, 'P1', custom)).toBe(false);
    const missing = parseCards('As Ad Ah');
    const inLibrary = lib.flops.some((f) => f.flop === canonicalKey(missing));
    if (!inLibrary) expect(libraryAnalysis(index, 'P1', builtInProfile('baseline'), missing)).toBeNull();
    const stale = { ...index, current: { ...index.current, 'baseline:bbVsEarly': 'AA' } };
    expect(libraryCovers(stale, 'P1', builtInProfile('baseline'))).toBe(false);
    expect(libraryCovers(stale, 'P2', builtInProfile('baseline'))).toBe(true);
  });

  it('rejects malformed data', () => {
    expect(() => validateLibrary(null)).toThrow();
    expect(() => validateLibrary({ ...lib, version: 99 })).toThrow();
    expect(() => validateLibrary({ ...lib, flops: [{ ...lib.flops[0]!, flop: 'XxYyZz' }] })).toThrow();
    expect(() => validateLibrary({ ...lib, flops: [{ ...lib.flops[0]!, hero: {} }] })).toThrow();
  });
});

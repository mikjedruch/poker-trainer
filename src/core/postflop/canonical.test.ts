import { describe, expect, it } from 'vitest';
import { FULL_DECK, parseCards } from '../cards';
import { createRng } from '../rng';
import { canonicalFlop, canonicalKey, permuteSuits, randomSuitPermutation } from './canonical';
import { flopTexture } from './texture';

describe('canonical flops', () => {
  it('suit renamings share one key, different suit patterns do not', () => {
    expect(canonicalKey(parseCards('Ks 7d 2c'))).toBe(canonicalKey(parseCards('Kh 7s 2d')));
    expect(canonicalKey(parseCards('7h 6h 5c'))).toBe(canonicalKey(parseCards('6d 7d 5s')));
    expect(canonicalKey(parseCards('7h 6h 5c'))).not.toBe(canonicalKey(parseCards('7h 6c 5h')));
    expect(canonicalKey(parseCards('7h 6h 5c'))).not.toBe(canonicalKey(parseCards('7h 6d 5c')));
  });

  it('there are 1755 strategically different flops', () => {
    const keys = new Set<string>();
    for (let a = 0; a < 52; a++) for (let b = a + 1; b < 52; b++) for (let c = b + 1; c < 52; c++) keys.add(canonicalKey([a, b, c]));
    expect(keys.size).toBe(1755);
  });

  it('keeps ranks and texture', () => {
    const rng = createRng(11);
    for (let i = 0; i < 300; i++) {
      const flop = [FULL_DECK[i % 52]!, FULL_DECK[(i * 7 + 3) % 52]!, FULL_DECK[(i * 13 + 5) % 52]!];
      if (new Set(flop).size < 3) continue;
      const canon = canonicalFlop(flop);
      const t1 = flopTexture(flop);
      const t2 = flopTexture(canon);
      expect(t2).toEqual(t1);
      const moved = permuteSuits(flop, randomSuitPermutation(rng));
      expect(canonicalKey(moved)).toBe(canonicalKey(flop));
    }
  });
});

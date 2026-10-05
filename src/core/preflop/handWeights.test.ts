import { describe, expect, it } from 'vitest';
import { createRng } from '../rng';
import { ALL_CLASSES, actionFor } from './data';
import { BORDERLINE_WEIGHT, OBVIOUS_WEIGHT, gridNeighbours, handWeight, pickHandClass } from './handWeights';

describe('hand weights', () => {
  it('uses the four grid neighbours', () => {
    expect(gridNeighbours('AA').sort()).toEqual(['AKo', 'AKs']);
    expect(gridNeighbours('77').sort()).toEqual(['76o', '76s', '87o', '87s']);
    expect(gridNeighbours('A9s').sort()).toEqual(['A8s', 'ATs', 'K9s'].sort());
  });

  it('weights borderline hands 3, obvious folds 0.3, the rest 1', () => {
    expect(handWeight('RFI_UTG', 'UTG', 'A9s')).toBe(BORDERLINE_WEIGHT); // raise next to A8s fold
    expect(handWeight('RFI_UTG', 'UTG', 'A8s')).toBe(BORDERLINE_WEIGHT); // fold next to A9s raise
    expect(handWeight('RFI_UTG', 'UTG', '72o')).toBe(OBVIOUS_WEIGHT);
    expect(handWeight('RFI_UTG', 'UTG', 'AA')).toBe(1);
    expect(handWeight('LIMP_BB', 'BB', '72o')).toBe(OBVIOUS_WEIGHT); // obvious check in the BB
  });

  it('after a 3bet only hands from the hero open range can be dealt', () => {
    for (const cls of ALL_CLASSES) {
      const inRange = actionFor('RFI_UTG', cls) === 'raise';
      expect(handWeight('VS3B_OOP', 'UTG', cls) > 0).toBe(inRange);
    }
    const rng = createRng(11);
    for (let i = 0; i < 500; i++) expect(actionFor('RFI_UTG', pickHandClass(rng, 'VS3B_IP', 'UTG'))).toBe('raise');
  });

  it('borderline hands come up more often than obvious folds', () => {
    const rng = createRng(5);
    const counts = new Map<string, number>();
    for (let i = 0; i < 20_000; i++) {
      const cls = pickHandClass(rng, 'RFI_UTG', 'UTG');
      counts.set(cls, (counts.get(cls) ?? 0) + 1);
    }
    // Both suited (4 combos): 3 vs 0.3 weight → about 10× more often.
    expect((counts.get('A8s') ?? 0) / Math.max(1, counts.get('72s') ?? 0)).toBeGreaterThan(5);
  });
});

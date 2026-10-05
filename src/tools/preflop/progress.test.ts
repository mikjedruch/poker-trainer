import { describe, expect, it } from 'vitest';
import { drillWeights, emptyPreflopProgress, recordPreflop, sanitizePreflopProgress } from './progress';

describe('preflop progress', () => {
  it('tracks accuracy per family and per position', () => {
    let p = emptyPreflopProgress();
    p = recordPreflop(p, 'vs3bet', 'CO', false);
    p = recordPreflop(p, 'rfi', 'CO', true);
    expect(p.family.vs3bet).toEqual({ recent: [false], attempts: 1, correct: 0 });
    expect(p.family.rfi).toEqual({ recent: [true], attempts: 1, correct: 1 });
    expect(p.position.CO).toEqual({ recent: [false, true], attempts: 2, correct: 1 });
    expect(p.position.UTG.attempts).toBe(0);
  });

  it('weights weak families and positions up (min 0.1, untried 1)', () => {
    let p = emptyPreflopProgress();
    for (let i = 0; i < 10; i++) p = recordPreflop(p, 'rfi', 'BTN', true);
    const w = drillWeights(p);
    expect(w.family?.rfi).toBeCloseTo(0.1);
    expect(w.family?.limpers).toBe(1);
    expect(w.position?.BTN).toBeCloseTo(0.1);
    expect(w.position?.SB).toBe(1);
  });

  it('survives garbage from storage', () => {
    const p = sanitizePreflopProgress({ family: { rfi: { recent: [true, 'x'], attempts: 3, correct: 9 } }, position: 5 });
    expect(p.family.rfi).toEqual({ recent: [true], attempts: 3, correct: 3 });
    expect(p.position.BB.attempts).toBe(0);
    expect(sanitizePreflopProgress(null)).toEqual(emptyPreflopProgress());
  });
});

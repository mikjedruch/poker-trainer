import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { emptyPostflopProgress, pickQuizType, pickScenario, recordPostflop, sanitizePostflopProgress } from './progress';

describe('postflop progress', () => {
  it('tracks accuracy per quiz type and per scenario', () => {
    let p = emptyPostflopProgress();
    p = recordPostflop(p, 'hand', 'P4', false);
    p = recordPostflop(p, 'texture', null, true);
    expect(p.type.hand).toEqual({ recent: [false], attempts: 1, correct: 0 });
    expect(p.type.texture).toEqual({ recent: [true], attempts: 1, correct: 1 });
    expect(p.scenario.P4).toEqual({ recent: [false], attempts: 1, correct: 0 });
    expect(p.scenario.P1.attempts).toBe(0);
  });

  it('weak types and scenarios come up more often', () => {
    let p = emptyPostflopProgress();
    for (let i = 0; i < 20; i++) {
      p = recordPostflop(p, 'texture', null, true);
      p = recordPostflop(p, 'strategy', 'P1', true);
    }
    const rng = createRng(1);
    const counts = { texture: 0, strategy: 0, hand: 0, sizing: 0 };
    for (let i = 0; i < 4000; i++) counts[pickQuizType(p, rng)]++;
    expect(counts.hand).toBeGreaterThan(counts.texture * 5);
    expect(counts.texture).toBeGreaterThan(0); // minimum weight 0.1
    let p1 = 0;
    for (let i = 0; i < 4000; i++) if (pickScenario(p, rng, ['P1', 'P2'] as const) === 'P1') p1++;
    expect(p1).toBeLessThan(800);
  });

  it('survives garbage from storage', () => {
    const p = sanitizePostflopProgress({ type: { hand: { recent: [true, 1], attempts: 2, correct: 7 } }, scenario: 'x' });
    expect(p.type.hand).toEqual({ recent: [true], attempts: 2, correct: 2 });
    expect(p.scenario.PM.attempts).toBe(0);
    expect(sanitizePostflopProgress(undefined)).toEqual(emptyPostflopProgress());
  });
});

import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { TASK_TYPES } from '../../core/math/tasks';
import {
  RECENT_WINDOW,
  emptyProgress,
  pickWeightedType,
  recentAccuracy,
  recordResult,
  sanitizeProgress,
  typeWeight,
} from './progress';

describe('math progress', () => {
  it('starts empty for all 7 types', () => {
    const p = emptyProgress();
    expect(Object.keys(p).sort()).toEqual([...TASK_TYPES].sort());
    for (const t of TASK_TYPES) expect(recentAccuracy(p[t])).toBeNull();
  });

  it('records results and keeps only the last 20 for accuracy', () => {
    let p = emptyProgress();
    for (let i = 0; i < 25; i++) p = recordResult(p, 'mdf', i < 5 ? false : true);
    expect(p.mdf.attempts).toBe(25);
    expect(p.mdf.correct).toBe(20);
    expect(p.mdf.recent).toHaveLength(RECENT_WINDOW);
    expect(recentAccuracy(p.mdf)).toBe(1);
  });

  it('does not mutate the input', () => {
    const p = emptyProgress();
    recordResult(p, 'outs', true);
    expect(p.outs.attempts).toBe(0);
  });

  it('weight = max(0.1, 1 − recent accuracy); untried types get full weight', () => {
    let p = emptyProgress();
    expect(typeWeight(p.outs)).toBe(1);
    for (let i = 0; i < 10; i++) p = recordResult(p, 'outs', true);
    expect(typeWeight(p.outs)).toBe(0.1);
    for (let i = 0; i < 10; i++) p = recordResult(p, 'bluff', i % 2 === 0);
    expect(typeWeight(p.bluff)).toBeCloseTo(0.5, 12);
  });

  it('weighted pick favours weak types in proportion to their weight', () => {
    let p = emptyProgress();
    for (const t of TASK_TYPES) for (let i = 0; i < 20; i++) p = recordResult(p, t, true); // all weight 0.1
    for (let i = 0; i < 20; i++) p = recordResult(p, 'implied', false); // weight 1
    const rng = createRng(1);
    const counts = new Map<string, number>();
    const n = 32_000;
    for (let i = 0; i < n; i++) {
      const t = pickWeightedType(p, rng);
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    // implied: 1 / (1 + 6 × 0.1) = 62.5%
    expect((counts.get('implied') ?? 0) / n).toBeCloseTo(0.625, 1);
    expect((counts.get('mdf') ?? 0) / n).toBeCloseTo(0.0625, 1);
  });

  it('sanitizes corrupted or old stored data', () => {
    expect(sanitizeProgress(null)).toEqual(emptyProgress());
    expect(sanitizeProgress('garbage')).toEqual(emptyProgress());
    const partial = sanitizeProgress({ outs: { recent: [true, 'x', false], attempts: 3, correct: 1 }, unknown: {} });
    expect(partial.outs).toEqual({ recent: [true, false], attempts: 3, correct: 1 });
    expect(partial.mdf).toEqual(emptyProgress().mdf);
  });
});

import type { TaskType } from '../../core/math/tasks';
import { TASK_TYPES } from '../../core/math/tasks';
import type { Rng } from '../../core/rng';

export const RECENT_WINDOW = 20;
export const MIN_WEIGHT = 0.1;
export const PROGRESS_KEY = 'poker-trainer/math-progress/v1';

export interface TypeStats {
  /** Most recent results, oldest first, at most RECENT_WINDOW. */
  recent: boolean[];
  attempts: number;
  correct: number;
}

export type Progress = Record<TaskType, TypeStats>;

const emptyStats = (): TypeStats => ({ recent: [], attempts: 0, correct: 0 });

export function emptyProgress(): Progress {
  return Object.fromEntries(TASK_TYPES.map((t) => [t, emptyStats()])) as Progress;
}

export function recordResult(progress: Progress, type: TaskType, correct: boolean): Progress {
  const old = progress[type];
  return {
    ...progress,
    [type]: {
      recent: [...old.recent, correct].slice(-RECENT_WINDOW),
      attempts: old.attempts + 1,
      correct: old.correct + (correct ? 1 : 0),
    },
  };
}

export function recentAccuracy(stats: TypeStats): number | null {
  if (stats.recent.length === 0) return null;
  return stats.recent.filter(Boolean).length / stats.recent.length;
}

/** Weight ∝ 1 − accuracy over the last 20 attempts, at least 0.1. Untried types get 1. */
export function typeWeight(stats: TypeStats): number {
  const accuracy = recentAccuracy(stats);
  return Math.max(MIN_WEIGHT, 1 - (accuracy ?? 0));
}

export function pickWeightedType(progress: Progress, rng: Rng): TaskType {
  const weights = TASK_TYPES.map((t) => typeWeight(progress[t]));
  const total = weights.reduce((a, b) => a + b, 0);
  let x = rng() * total;
  for (let i = 0; i < TASK_TYPES.length; i++) {
    x -= weights[i]!;
    if (x < 0) return TASK_TYPES[i]!;
  }
  return TASK_TYPES[TASK_TYPES.length - 1]!;
}

const nonNegativeInt = (v: unknown): number => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : 0);

/** Accepts anything read from storage and returns a valid Progress. */
export function sanitizeProgress(raw: unknown): Progress {
  const result = emptyProgress();
  if (typeof raw !== 'object' || raw === null) return result;
  for (const type of TASK_TYPES) {
    const s = (raw as Record<string, unknown>)[type];
    if (typeof s !== 'object' || s === null) continue;
    const stats = s as Record<string, unknown>;
    const recent = Array.isArray(stats.recent)
      ? stats.recent.filter((x): x is boolean => typeof x === 'boolean').slice(-RECENT_WINDOW)
      : [];
    const attempts = nonNegativeInt(stats.attempts);
    result[type] = { recent, attempts, correct: Math.min(nonNegativeInt(stats.correct), attempts) };
  }
  return result;
}

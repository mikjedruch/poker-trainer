import type { TaskType } from '../../core/math/tasks';
import { TASK_TYPES } from '../../core/math/tasks';
import type { Rng } from '../../core/rng';
import type { TypeStats } from '../../shared/accuracy';
import { addResult, emptyStats, sanitizeStats, typeWeight } from '../../shared/accuracy';

export { MIN_WEIGHT, RECENT_WINDOW, recentAccuracy, typeWeight } from '../../shared/accuracy';
export type { TypeStats } from '../../shared/accuracy';

export const PROGRESS_KEY = 'poker-trainer/math-progress/v1';

export type Progress = Record<TaskType, TypeStats>;

export function emptyProgress(): Progress {
  return Object.fromEntries(TASK_TYPES.map((t) => [t, emptyStats()])) as Progress;
}

export function recordResult(progress: Progress, type: TaskType, correct: boolean): Progress {
  return { ...progress, [type]: addResult(progress[type], correct) };
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

/** Accepts anything read from storage and returns a valid Progress. */
export function sanitizeProgress(raw: unknown): Progress {
  const obj = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  return Object.fromEntries(TASK_TYPES.map((t) => [t, sanitizeStats(obj[t])])) as Progress;
}

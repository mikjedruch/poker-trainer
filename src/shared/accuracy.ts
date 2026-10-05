// Accuracy tracking shared by all trainers: last-20 accuracy and error weighting
// (weight ∝ 1 − accuracy over the last 20 attempts, at least 0.1; untried = 1).

export const RECENT_WINDOW = 20;
export const MIN_WEIGHT = 0.1;

export interface TypeStats {
  /** Most recent results, oldest first, at most RECENT_WINDOW. */
  recent: boolean[];
  attempts: number;
  correct: number;
}

export const emptyStats = (): TypeStats => ({ recent: [], attempts: 0, correct: 0 });

export function addResult(stats: TypeStats, correct: boolean): TypeStats {
  return {
    recent: [...stats.recent, correct].slice(-RECENT_WINDOW),
    attempts: stats.attempts + 1,
    correct: stats.correct + (correct ? 1 : 0),
  };
}

export function recentAccuracy(stats: TypeStats): number | null {
  if (stats.recent.length === 0) return null;
  return stats.recent.filter(Boolean).length / stats.recent.length;
}

export function typeWeight(stats: TypeStats): number {
  const accuracy = recentAccuracy(stats);
  return Math.max(MIN_WEIGHT, 1 - (accuracy ?? 0));
}

const nonNegativeInt = (v: unknown): number => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : 0);

/** Accepts anything read from storage and returns valid stats. */
export function sanitizeStats(raw: unknown): TypeStats {
  if (typeof raw !== 'object' || raw === null) return emptyStats();
  const stats = raw as Record<string, unknown>;
  const recent = Array.isArray(stats.recent)
    ? stats.recent.filter((x): x is boolean => typeof x === 'boolean').slice(-RECENT_WINDOW)
    : [];
  const attempts = nonNegativeInt(stats.attempts);
  return { recent, attempts, correct: Math.min(nonNegativeInt(stats.correct), attempts) };
}

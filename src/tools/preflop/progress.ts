import type { Family } from '../../core/preflop/data';
import { FAMILIES } from '../../core/preflop/data';
import type { DrillWeights } from '../../core/preflop/situation';
import type { Position } from '../../core/table';
import { POSITIONS } from '../../core/table';
import type { TypeStats } from '../../shared/accuracy';
import { addResult, emptyStats, sanitizeStats, typeWeight } from '../../shared/accuracy';

export const PREFLOP_PROGRESS_KEY = 'poker-trainer/preflop-progress/v1';

/** Accuracy per scenario family and per hero position. */
export interface PreflopProgress {
  family: Record<Family, TypeStats>;
  position: Record<Position, TypeStats>;
}

const fill = <K extends string>(keys: readonly K[], value: (k: K) => TypeStats): Record<K, TypeStats> =>
  Object.fromEntries(keys.map((k) => [k, value(k)])) as Record<K, TypeStats>;

export function emptyPreflopProgress(): PreflopProgress {
  return { family: fill(FAMILIES, emptyStats), position: fill(POSITIONS, emptyStats) };
}

export function recordPreflop(p: PreflopProgress, family: Family, position: Position, correct: boolean): PreflopProgress {
  return {
    family: { ...p.family, [family]: addResult(p.family[family], correct) },
    position: { ...p.position, [position]: addResult(p.position[position], correct) },
  };
}

/** Error weighting for the drill: weaker families and positions come up more often. */
export function drillWeights(p: PreflopProgress): DrillWeights {
  return {
    family: Object.fromEntries(FAMILIES.map((f) => [f, typeWeight(p.family[f])])),
    position: Object.fromEntries(POSITIONS.map((pos) => [pos, typeWeight(p.position[pos])])),
  };
}

export function sanitizePreflopProgress(raw: unknown): PreflopProgress {
  const obj = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const part = (key: string) => (typeof obj[key] === 'object' && obj[key] !== null ? (obj[key] as Record<string, unknown>) : {});
  const family = part('family');
  const position = part('position');
  return {
    family: fill(FAMILIES, (f) => sanitizeStats(family[f])),
    position: fill(POSITIONS, (pos) => sanitizeStats(position[pos])),
  };
}

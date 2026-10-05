import type { Position } from '../table';
import { POSITIONS } from '../table';
import type { Situation } from './situation';
import { positionsAfter, positionsBefore } from './situation';

// Test helper: every situation the drill can produce (85 in total).

function subsets<T>(items: readonly T[], size: number): T[][] {
  if (size === 0) return [[]];
  if (items.length < size) return [];
  const [first, ...rest] = items;
  return [...subsets(rest, size - 1).map((s) => [first!, ...s]), ...subsets(rest, size)];
}

export function allSituations(): Situation[] {
  const base = { limpers: [] as Position[], opener: null, threeBettor: null };
  const out: Situation[] = [];
  for (const hero of POSITIONS) {
    if (hero !== 'BB') out.push({ ...base, family: 'rfi', hero });
    for (let n = 1; n <= 3; n++)
      for (const limpers of subsets(positionsBefore(hero), n)) out.push({ ...base, family: 'limpers', hero, limpers });
    if (hero !== 'UTG') for (const opener of positionsBefore(hero)) out.push({ ...base, family: 'vsOpen', hero, opener });
    if (hero !== 'BB') for (const threeBettor of positionsAfter(hero)) out.push({ ...base, family: 'vs3bet', hero, threeBettor });
  }
  return out;
}

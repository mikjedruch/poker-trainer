import type { HandClass } from '../range';
import { gridCellOf, gridLabel } from '../range';
import type { Rng } from '../rng';
import type { Position } from '../table';
import type { ScenarioId } from './data';
import { ALL_CLASSES, actionFor, comboCount, reachable, scenarioRanges } from './data';

// Borderline hands teach the most: a hand whose action differs from at least one neighbouring
// grid cell is drawn 3× as often; an obvious no-play hand (it and all neighbours take the
// scenario's default action: fold, or check in the BB) only 0.3×. Weights are per combo,
// so offsuit hands keep their natural 12-combo frequency.

export const BORDERLINE_WEIGHT = 3;
export const OBVIOUS_WEIGHT = 0.3;

/** Orthogonal neighbours in the 13×13 grid (up, down, left, right). */
export function gridNeighbours(cls: HandClass): HandClass[] {
  const [r, c] = gridCellOf(cls);
  const out: HandClass[] = [];
  for (const [dr, dc] of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ] as const) {
    const nr = r + dr;
    const nc = c + dc;
    if (nr >= 0 && nr < 13 && nc >= 0 && nc < 13) out.push(gridLabel(nr, nc));
  }
  return out;
}

/** Weight of one combo of `cls`; 0 if the hero cannot hold it in this scenario. */
export function handWeight(id: ScenarioId, hero: Position, cls: HandClass): number {
  if (!reachable(id, hero, cls)) return 0;
  const action = actionFor(id, cls);
  if (gridNeighbours(cls).some((n) => actionFor(id, n) !== action)) return BORDERLINE_WEIGHT;
  return action === scenarioRanges(id).rest ? OBVIOUS_WEIGHT : 1;
}

export function pickHandClass(rng: Rng, id: ScenarioId, hero: Position): HandClass {
  const weights = ALL_CLASSES.map((cls) => handWeight(id, hero, cls) * comboCount(cls));
  const total = weights.reduce((a, b) => a + b, 0);
  let x = rng() * total;
  for (let i = 0; i < ALL_CLASSES.length; i++) {
    x -= weights[i]!;
    if (x < 0) return ALL_CLASSES[i]!;
  }
  // Floating-point edge: last class with a positive weight.
  for (let i = ALL_CLASSES.length - 1; i >= 0; i--) if (weights[i]! > 0) return ALL_CLASSES[i]!;
  throw new Error(`No reachable hand in ${id}`);
}

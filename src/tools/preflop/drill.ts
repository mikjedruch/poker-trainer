import { usd } from '../../core/math/format';
import type { Action, Family, ScenarioId } from '../../core/preflop/data';
import { FAMILIES, SCENARIO_IDS, SCENARIO_INFO, actionCombos, actionFor, reachable, scenarioRanges } from '../../core/preflop/data';
import type { PreflopExplanation } from '../../core/preflop/explain';
import { explainSpot } from '../../core/preflop/explain';
import type { ActionOption, HistoryEntry, PreflopSpot } from '../../core/preflop/situation';
import { EXAMPLE_SITUATIONS, buildSpot, randomSpot } from '../../core/preflop/situation';
import type { HandClass } from '../../core/range';
import { classCombos } from '../../core/range';
import type { Rng } from '../../core/rng';
import type { PreflopProgress } from './progress';
import { drillWeights } from './progress';

// Screen logic for the preflop drill and range browser, kept out of the components so it can be tested.
// Every correct answer comes from src/core/preflop.

export type DrillMode = 'mixed' | Family;
export const DRILL_MODES: readonly DrillMode[] = ['mixed', ...FAMILIES];

export const MODE_NAMES: Readonly<Record<DrillMode, string>> = {
  mixed: 'Mieszane',
  rfi: 'Open',
  limpers: 'Limperzy',
  vsOpen: 'Open przed Tobą',
  vs3bet: '3bet',
};

export function isDrillMode(x: unknown): x is DrillMode {
  return typeof x === 'string' && (DRILL_MODES as readonly string[]).includes(x);
}

/** Next drill spot: weaker families and positions come up more often. */
export function newSpot(mode: DrillMode, progress: PreflopProgress, rng: Rng): PreflopSpot {
  return randomSpot(rng, drillWeights(progress), mode === 'mixed' ? undefined : mode);
}

export interface Grade {
  correct: boolean;
  given: ActionOption;
  answer: ActionOption;
}

export function gradeAnswer(spot: PreflopSpot, action: Action): Grade {
  const option = (a: Action) => {
    const found = spot.options.find((o) => o.action === a);
    if (!found) throw new Error(`Action ${a} is not offered in ${spot.scenario}`);
    return found;
  };
  return { correct: action === spot.correct, given: option(action), answer: option(spot.correct) };
}

// ---------- action history text ----------

function entryText(e: HistoryEntry): string {
  const amount = usd(e.amount ?? 0);
  switch (e.kind) {
    case 'fold':
      return 'fold';
    case 'limp':
      return `limp ${amount}`;
    case 'complete':
      return `dopłata do ${amount}`;
    case 'open':
      return `raise do ${amount}`;
    case 'threeBet':
      return `3bet do ${amount}`;
  }
}

const joinPl = (items: readonly string[]): string =>
  items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} i ${items[items.length - 1]}`;

/** "UTG limp $2, HJ i CO fold"; consecutive folds are grouped. Empty when the hero acts first. */
export function historyText(history: readonly HistoryEntry[]): string {
  const parts: string[] = [];
  let folds: string[] = [];
  const flush = () => {
    if (folds.length > 0) parts.push(`${joinPl(folds)} fold`);
    folds = [];
  };
  for (const e of history) {
    if (e.kind === 'fold' && !e.hero) {
      folds.push(e.position);
      continue;
    }
    flush();
    parts.push(`${e.hero ? 'Ty' : e.position} ${entryText(e)}`);
  }
  flush();
  return parts.join(', ');
}

/** Full situation line, e.g. "UTG limp $2, HJ limp $2 — Ty na CO". */
export function situationLine(spot: PreflopSpot): string {
  const before = historyText(spot.history);
  const hero = `Ty na ${spot.situation.hero}`;
  return before ? `${before} — ${hero}` : `Jesteś pierwszy do akcji — ${hero}`;
}

// ---------- range browser ----------

/** Name of each action in a scenario's legend and cell details. */
export function actionName(id: ScenarioId, action: Action): string {
  const family = SCENARIO_INFO[id].family;
  switch (action) {
    case 'fold':
      return 'Fold';
    case 'check':
      return 'Check';
    case 'call':
      if (family === 'limpers') return id === 'LIMP_SB' ? 'Dopłata' : 'Limp';
      return 'Call';
    case 'raise':
      if (family === 'limpers') return 'Raise (izolacja)';
      if (family === 'vsOpen') return '3bet';
      if (family === 'vs3bet') return '4bet';
      return 'Raise';
  }
}

export interface LegendItem {
  action: Action;
  label: string;
  combos: number;
  /** Range in the data file's notation; empty for the default action. */
  range: string;
}

/** Actions of a scenario with combo counts (out of 1326): raise, call (if any), then fold or check. */
export function legendItems(id: ScenarioId): LegendItem[] {
  const counts = actionCombos(id);
  const ranges = scenarioRanges(id);
  const actions: Action[] = ['raise', ...(ranges.call.size > 0 ? (['call'] as const) : []), ranges.rest];
  const range = (a: Action) => (a === 'raise' ? ranges.raiseText : a === 'call' ? ranges.callText : '');
  return actions.map((action) => ({ action, label: actionName(id, action), combos: counts[action], range: range(action) }));
}

export interface CellDetail {
  handClass: HandClass;
  action: Action;
  actionLabel: string;
  /** Typical situation the explanation is written for. */
  exampleLine: string;
  explanation: PreflopExplanation;
  /** False in 3bet spots for hands the hero would not have opened (they never come up in the drill). */
  reachable: boolean;
}

/** What tapping a grid cell shows: the action and the explanation for the scenario's typical situation. */
export function cellDetail(id: ScenarioId, cls: HandClass): CellDetail {
  const situation = EXAMPLE_SITUATIONS[id];
  const spot = buildSpot(situation, classCombos(cls)[0]!);
  const action = actionFor(id, cls);
  return {
    handClass: cls,
    action,
    actionLabel: actionName(id, action),
    exampleLine: situationLine(spot),
    explanation: explainSpot(spot),
    reachable: reachable(id, situation.hero, cls),
  };
}

/** Scenarios grouped by family, for the scenario picker. */
export const SCENARIOS_BY_FAMILY: ReadonlyArray<readonly [Family, readonly ScenarioId[]]> = FAMILIES.map(
  (f) => [f, SCENARIO_IDS.filter((id) => SCENARIO_INFO[id].family === f)] as const,
);

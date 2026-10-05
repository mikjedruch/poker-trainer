import rawData from '../../data/preflop.json';
import type { HandClass } from '../range';
import { classCombos, gridLabel, handClassOf, parseRange } from '../range';
import type { Position } from '../table';

// Preflop ranges and bet sizes come from src/data/preflop.json; this module validates them
// and turns them into a hand-class → action lookup. No range is written in code.

export type Action = 'raise' | 'call' | 'fold' | 'check';

export const FAMILIES = ['rfi', 'limpers', 'vsOpen', 'vs3bet'] as const;
export type Family = (typeof FAMILIES)[number];

export const SCENARIO_IDS = [
  'RFI_UTG',
  'RFI_HJ',
  'RFI_CO',
  'RFI_BTN',
  'RFI_SB',
  'LIMP1_IP',
  'LIMP2_IP',
  'LIMP_SB',
  'LIMP_BB',
  'VS_EARLY_IP',
  'VS_LATE_BTN',
  'VS_OPEN_SB',
  'BB_VS_EARLY',
  'BB_VS_LATE',
  'VS3B_IP',
  'VS3B_OOP',
] as const;
export type ScenarioId = (typeof SCENARIO_IDS)[number];

export interface ScenarioInfo {
  family: Family;
  /** Short Polish description for pickers. */
  label: string;
}

export const SCENARIO_INFO: Readonly<Record<ScenarioId, ScenarioInfo>> = {
  RFI_UTG: { family: 'rfi', label: 'Open z UTG' },
  RFI_HJ: { family: 'rfi', label: 'Open z HJ' },
  RFI_CO: { family: 'rfi', label: 'Open z CO' },
  RFI_BTN: { family: 'rfi', label: 'Open z BTN' },
  RFI_SB: { family: 'rfi', label: 'Open z SB' },
  LIMP1_IP: { family: 'limpers', label: '1 limper, Ty na HJ/CO/BTN' },
  LIMP2_IP: { family: 'limpers', label: '2+ limperów, Ty na CO/BTN' },
  LIMP_SB: { family: 'limpers', label: 'Limperzy, Ty na SB' },
  LIMP_BB: { family: 'limpers', label: 'Limperzy, Ty na BB' },
  VS_EARLY_IP: { family: 'vsOpen', label: 'Open z UTG/HJ, Ty na HJ/CO/BTN' },
  VS_LATE_BTN: { family: 'vsOpen', label: 'Open z CO, Ty na BTN' },
  VS_OPEN_SB: { family: 'vsOpen', label: 'Open, Ty na SB' },
  BB_VS_EARLY: { family: 'vsOpen', label: 'Open z UTG/HJ, Ty na BB' },
  BB_VS_LATE: { family: 'vsOpen', label: 'Open z CO/BTN/SB, Ty na BB' },
  VS3B_IP: { family: 'vs3bet', label: '3bet z blindów (Ty w pozycji)' },
  VS3B_OOP: { family: 'vs3bet', label: '3bet od gracza w pozycji' },
};

export const FAMILY_NAMES_PL: Readonly<Record<Family, string>> = {
  rfi: 'Open (wszyscy spasowali)',
  limpers: 'Limperzy przed Tobą',
  vsOpen: 'Open przed Tobą',
  vs3bet: '3bet po Twoim opencie',
};

export const RFI_SCENARIO: Readonly<Partial<Record<Position, ScenarioId>>> = {
  UTG: 'RFI_UTG',
  HJ: 'RFI_HJ',
  CO: 'RFI_CO',
  BTN: 'RFI_BTN',
  SB: 'RFI_SB',
};

export interface Sizes {
  villainOpen: number;
  villainThreeBetInPosition: number;
  villainThreeBetFromBlinds: number;
  open: number;
  openFromSmallBlind: number;
  isolateOneLimper: number;
  isolatePerExtraLimper: number;
  isolateFromBlindsExtra: number;
  threeBetInPosition: number;
  threeBetOutOfPosition: number;
  fourBet: number;
}

export interface Stakes {
  smallBlind: number;
  bigBlind: number;
  stack: number;
}

export interface ScenarioRanges {
  id: ScenarioId;
  /** Range text exactly as written in the data file. */
  raiseText: string;
  callText: string;
  /** Action for every hand class not listed. */
  rest: 'fold' | 'check';
  raise: ReadonlySet<HandClass>;
  call: ReadonlySet<HandClass>;
  raiseCombos: number;
  callCombos: number;
}

/** All 169 hand classes, grid order (AA, AKs, … 22). */
export const ALL_CLASSES: readonly HandClass[] = Array.from({ length: 169 }, (_, i) => gridLabel(Math.floor(i / 13), i % 13));

function positiveInt(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) throw new Error(`preflop.json: ${name} must be a positive integer`);
  return value;
}

/** Parses a range into whole hand classes; a range that splits a class is an error (strategies are pure). */
function rangeClasses(text: string, where: string): { classes: Set<HandClass>; combos: number } {
  const combos = parseRange(text);
  const counts = new Map<HandClass, number>();
  for (const c of combos) {
    const cls = handClassOf(c);
    counts.set(cls, (counts.get(cls) ?? 0) + 1);
  }
  for (const [cls, n] of counts) {
    if (n !== classCombos(cls).length) throw new Error(`preflop.json ${where}: range covers only part of ${cls}`);
  }
  return { classes: new Set(counts.keys()), combos: combos.length };
}

function loadData() {
  const raw = rawData as unknown as {
    stakes: Record<string, unknown>;
    sizes: Record<string, unknown>;
    scenarios: Array<Record<string, unknown>>;
  };

  const stakes: Stakes = {
    smallBlind: positiveInt(raw.stakes.smallBlind, 'stakes.smallBlind'),
    bigBlind: positiveInt(raw.stakes.bigBlind, 'stakes.bigBlind'),
    stack: positiveInt(raw.stakes.stack, 'stakes.stack'),
  };

  const sizeKeys: Array<keyof Sizes> = [
    'villainOpen',
    'villainThreeBetInPosition',
    'villainThreeBetFromBlinds',
    'open',
    'openFromSmallBlind',
    'isolateOneLimper',
    'isolatePerExtraLimper',
    'isolateFromBlindsExtra',
    'threeBetInPosition',
    'threeBetOutOfPosition',
    'fourBet',
  ];
  const sizes = Object.fromEntries(sizeKeys.map((k) => [k, positiveInt(raw.sizes[k], `sizes.${k}`)])) as unknown as Sizes;

  const scenarios = new Map<ScenarioId, ScenarioRanges>();
  for (const s of raw.scenarios) {
    const id = s.id as ScenarioId;
    if (!SCENARIO_IDS.includes(id)) throw new Error(`preflop.json: unknown scenario ${String(s.id)}`);
    if (scenarios.has(id)) throw new Error(`preflop.json: duplicate scenario ${id}`);
    const raiseText = String(s.raise ?? '');
    const callText = String(s.call ?? '');
    const rest = s.rest === 'check' ? 'check' : s.rest === 'fold' ? 'fold' : null;
    if (!rest) throw new Error(`preflop.json ${id}: rest must be "fold" or "check"`);
    const raise = rangeClasses(raiseText, `${id}.raise`);
    const call = rangeClasses(callText, `${id}.call`);
    for (const cls of call.classes) {
      if (raise.classes.has(cls)) throw new Error(`preflop.json ${id}: ${cls} is both raise and call`);
    }
    scenarios.set(id, {
      id,
      raiseText,
      callText,
      rest,
      raise: raise.classes,
      call: call.classes,
      raiseCombos: raise.combos,
      callCombos: call.combos,
    });
  }
  for (const id of SCENARIO_IDS) if (!scenarios.has(id)) throw new Error(`preflop.json: missing scenario ${id}`);

  return { stakes, sizes, scenarios };
}

const DATA = loadData();

export const STAKES: Readonly<Stakes> = DATA.stakes;
export const SIZES: Readonly<Sizes> = DATA.sizes;

export function scenarioRanges(id: ScenarioId): ScenarioRanges {
  return DATA.scenarios.get(id)!;
}

/** The single correct action for a hand class in a scenario. */
export function actionFor(id: ScenarioId, cls: HandClass): Action {
  const s = scenarioRanges(id);
  if (s.raise.has(cls)) return 'raise';
  if (s.call.has(cls)) return 'call';
  return s.rest;
}

/** Hands the hero can hold in a scenario: after hero's own open (3bet spots) only hands from that open range. */
export function reachable(id: ScenarioId, heroPosition: Position, cls: HandClass): boolean {
  if (SCENARIO_INFO[id].family !== 'vs3bet') return true;
  const rfi = RFI_SCENARIO[heroPosition];
  return rfi !== undefined && actionFor(rfi, cls) === 'raise';
}

export const comboCount = (cls: HandClass): number => classCombos(cls).length;

/** 13×13 grid of actions (row/column 0 = ace), as in the range grid UI. */
export function scenarioGrid(id: ScenarioId): Action[][] {
  return Array.from({ length: 13 }, (_, r) => Array.from({ length: 13 }, (_, c) => actionFor(id, gridLabel(r, c))));
}

/** Number of combos (out of 1326) taking each action. */
export function actionCombos(id: ScenarioId): Record<Action, number> {
  const out: Record<Action, number> = { raise: 0, call: 0, fold: 0, check: 0 };
  for (const cls of ALL_CLASSES) out[actionFor(id, cls)] += comboCount(cls);
  return out;
}

import type { HandClass } from '../range';
import { classCombos, handClassOf } from '../range';
import type { Combo } from '../range';
import type { Rng } from '../rng';
import { pick, randomInt } from '../rng';
import type { Position } from '../table';
import { POSITIONS } from '../table';
import type { Action, Family, ScenarioId } from './data';
import { FAMILIES, RFI_SCENARIO, SCENARIO_INFO, SIZES, STAKES, actionFor } from './data';
import { pickHandClass } from './handWeights';

// A preflop drill situation: who did what before the hero, the money on the table,
// the hero's options with amounts and the single correct action.

export interface Situation {
  family: Family;
  hero: Position;
  /** Limpers in action order (limpers family only). */
  limpers: Position[];
  /** Villain who opened to $7 (vsOpen family only). */
  opener: Position | null;
  /** Villain who 3bet the hero's open (vs3bet family only). */
  threeBettor: Position | null;
}

export interface ActionOption {
  action: Action;
  /** Button text, e.g. "Raise do $16". */
  label: string;
  /** Hero's total bet after this action, or null for fold/check. */
  total: number | null;
}

export type HistoryKind = 'fold' | 'limp' | 'complete' | 'open' | 'threeBet';

export interface HistoryEntry {
  position: Position;
  kind: HistoryKind;
  amount: number | null;
  hero: boolean;
}

export interface SeatState {
  position: Position;
  /** Money in front of the seat (blinds included). */
  bet: number;
  folded: boolean;
}

export interface PreflopSpot {
  situation: Situation;
  scenario: ScenarioId;
  hand: Combo;
  handClass: HandClass;
  options: ActionOption[];
  correct: Action;
  seats: SeatState[];
  pot: number;
  history: HistoryEntry[];
}

// ---------- positions ----------

const PREFLOP_INDEX: Readonly<Record<Position, number>> = { UTG: 0, HJ: 1, CO: 2, BTN: 3, SB: 4, BB: 5 };
/** Postflop the blinds act first and the button last. */
const POSTFLOP_INDEX: Readonly<Record<Position, number>> = { SB: 0, BB: 1, UTG: 2, HJ: 3, CO: 4, BTN: 5 };

export const isBlind = (p: Position): boolean => p === 'SB' || p === 'BB';
export const positionsBefore = (p: Position): Position[] => POSITIONS.filter((q) => PREFLOP_INDEX[q] < PREFLOP_INDEX[p]);
export const positionsAfter = (p: Position): Position[] => POSITIONS.filter((q) => PREFLOP_INDEX[q] > PREFLOP_INDEX[p]);
/** True if `a` acts after `b` on every postflop street. */
export const inPositionOver = (a: Position, b: Position): boolean => POSTFLOP_INDEX[a] > POSTFLOP_INDEX[b];

// ---------- sizes ----------

export const blindOf = (p: Position): number => (p === 'SB' ? STAKES.smallBlind : p === 'BB' ? STAKES.bigBlind : 0);
export const openSize = (hero: Position): number => (hero === 'SB' ? SIZES.openFromSmallBlind : SIZES.open);
export function isolationSize(hero: Position, limpers: number): number {
  const base = SIZES.isolateOneLimper + SIZES.isolatePerExtraLimper * (limpers - 1);
  return isBlind(hero) ? base + SIZES.isolateFromBlindsExtra : base;
}
export const threeBetSize = (hero: Position): number => (isBlind(hero) ? SIZES.threeBetOutOfPosition : SIZES.threeBetInPosition);
export const villainThreeBetSize = (villain: Position): number =>
  isBlind(villain) ? SIZES.villainThreeBetFromBlinds : SIZES.villainThreeBetInPosition;

// ---------- scenario ----------

/** Hero is out of position after the flop against everyone still in the hand. */
export function heroOutOfPosition(s: Situation): boolean {
  switch (s.family) {
    case 'rfi':
      return s.hero === 'SB'; // only the big blind is left, and it acts after the small blind
    case 'limpers':
      return isBlind(s.hero);
    case 'vsOpen':
      return !inPositionOver(s.hero, s.opener!);
    case 'vs3bet':
      return !inPositionOver(s.hero, s.threeBettor!);
  }
}

export function scenarioOf(s: Situation): ScenarioId {
  switch (s.family) {
    case 'rfi': {
      const id = RFI_SCENARIO[s.hero];
      if (!id) throw new Error(`No open-raise scenario for ${s.hero}`);
      return id;
    }
    case 'limpers':
      if (s.hero === 'SB') return 'LIMP_SB';
      if (s.hero === 'BB') return 'LIMP_BB';
      return s.limpers.length === 1 ? 'LIMP1_IP' : 'LIMP2_IP';
    case 'vsOpen': {
      const early = s.opener === 'UTG' || s.opener === 'HJ';
      if (s.hero === 'BB') return early ? 'BB_VS_EARLY' : 'BB_VS_LATE';
      if (s.hero === 'SB') return 'VS_OPEN_SB';
      if (s.hero === 'BTN' && s.opener === 'CO') return 'VS_LATE_BTN';
      if (early) return 'VS_EARLY_IP';
      throw new Error(`No scenario for an open from ${s.opener} with hero on ${s.hero}`);
    }
    case 'vs3bet':
      return heroOutOfPosition(s) ? 'VS3B_OOP' : 'VS3B_IP';
  }
}

/** Throws if the situation could not happen at a 6-max table. */
export function validateSituation(s: Situation): void {
  const before = positionsBefore(s.hero);
  const after = positionsAfter(s.hero);
  const none = (what: string, ok: boolean) => {
    if (!ok) throw new Error(`Inconsistent situation: ${what}`);
  };
  none('limpers only in the limpers family', (s.family === 'limpers') === s.limpers.length > 0);
  none('opener only when facing an open', (s.family === 'vsOpen') === (s.opener !== null));
  none('3bettor only when facing a 3bet', (s.family === 'vs3bet') === (s.threeBettor !== null));
  if (s.family === 'rfi') none('BB cannot open-raise', s.hero !== 'BB');
  if (s.family === 'limpers') {
    none('1–3 limpers', s.limpers.length >= 1 && s.limpers.length <= 3);
    none('limpers sit before the hero', s.limpers.every((p) => before.includes(p)));
    none('limpers are distinct and ordered', s.limpers.every((p, i) => i === 0 || PREFLOP_INDEX[s.limpers[i - 1]!] < PREFLOP_INDEX[p]));
  }
  if (s.family === 'vsOpen') none('opener sits before the hero', before.includes(s.opener!));
  if (s.family === 'vs3bet') {
    none('hero opened, so hero is not the BB', s.hero !== 'BB');
    none('3bettor sits after the hero', after.includes(s.threeBettor!));
  }
  scenarioOf(s); // throws if no scenario covers it
}

// ---------- options, table, history ----------

export function optionsFor(s: Situation): ActionOption[] {
  const fold: ActionOption = { action: 'fold', label: 'Fold', total: null };
  switch (s.family) {
    case 'rfi': {
      const open = openSize(s.hero);
      return [fold, { action: 'raise', label: `Raise do $${open}`, total: open }];
    }
    case 'limpers': {
      const iso = isolationSize(s.hero, s.limpers.length);
      const raise: ActionOption = { action: 'raise', label: `Raise do $${iso}`, total: iso };
      const bb = STAKES.bigBlind;
      if (s.hero === 'BB') return [{ action: 'check', label: 'Check', total: null }, raise];
      if (s.hero === 'SB') return [fold, { action: 'call', label: `Dopłać do $${bb}`, total: bb }, raise];
      return [fold, { action: 'call', label: `Limp $${bb}`, total: bb }, raise];
    }
    case 'vsOpen': {
      const open = SIZES.villainOpen;
      const tb = threeBetSize(s.hero);
      return [
        fold,
        { action: 'call', label: `Call $${open}`, total: open },
        { action: 'raise', label: `3bet do $${tb}`, total: tb },
      ];
    }
    case 'vs3bet': {
      const tb = villainThreeBetSize(s.threeBettor!);
      return [
        fold,
        { action: 'call', label: `Call $${tb}`, total: tb },
        { action: 'raise', label: `4bet do $${SIZES.fourBet}`, total: SIZES.fourBet },
      ];
    }
  }
}

/** Money in front of each seat and who has folded, at the moment the hero must act. */
export function seatsFor(s: Situation): SeatState[] {
  const seats = new Map<Position, SeatState>(POSITIONS.map((p) => [p, { position: p, bet: blindOf(p), folded: false }]));
  const set = (p: Position, patch: Partial<SeatState>) => Object.assign(seats.get(p)!, patch);
  const before = positionsBefore(s.hero);

  switch (s.family) {
    case 'rfi':
      before.forEach((p) => set(p, { folded: true }));
      break;
    case 'limpers':
      before.forEach((p) => (s.limpers.includes(p) ? set(p, { bet: STAKES.bigBlind }) : set(p, { folded: true })));
      break;
    case 'vsOpen':
      before.forEach((p) => (p === s.opener ? set(p, { bet: SIZES.villainOpen }) : set(p, { folded: true })));
      break;
    case 'vs3bet':
      POSITIONS.forEach((p) => {
        if (p === s.hero) set(p, { bet: openSize(s.hero) });
        else if (p === s.threeBettor) set(p, { bet: villainThreeBetSize(p) });
        else set(p, { folded: true });
      });
      break;
  }
  return POSITIONS.map((p) => seats.get(p)!);
}

/** Everything that happened before the hero's decision, in action order. */
export function historyFor(s: Situation): HistoryEntry[] {
  const entry = (position: Position, kind: HistoryKind, amount: number | null = null): HistoryEntry => ({
    position,
    kind,
    amount,
    hero: position === s.hero,
  });
  const before = positionsBefore(s.hero);
  switch (s.family) {
    case 'rfi':
      return before.map((p) => entry(p, 'fold'));
    case 'limpers':
      return before.map((p) =>
        s.limpers.includes(p) ? entry(p, p === 'SB' ? 'complete' : 'limp', STAKES.bigBlind) : entry(p, 'fold'),
      );
    case 'vsOpen':
      return before.map((p) => (p === s.opener ? entry(p, 'open', SIZES.villainOpen) : entry(p, 'fold')));
    case 'vs3bet': {
      const out = before.map((p) => entry(p, 'fold'));
      out.push(entry(s.hero, 'open', openSize(s.hero)));
      for (const p of positionsAfter(s.hero)) {
        out.push(p === s.threeBettor ? entry(p, 'threeBet', villainThreeBetSize(p)) : entry(p, 'fold'));
      }
      return out;
    }
  }
}

export function buildSpot(situation: Situation, hand: Combo): PreflopSpot {
  validateSituation(situation);
  const scenario = scenarioOf(situation);
  const handClass = handClassOf(hand);
  const seats = seatsFor(situation);
  return {
    situation,
    scenario,
    hand,
    handClass,
    options: optionsFor(situation),
    correct: actionFor(scenario, handClass),
    seats,
    pot: seats.reduce((sum, seat) => sum + seat.bet, 0),
    history: historyFor(situation),
  };
}

// ---------- random drill spots ----------

/** Family mix from the specification, before error weighting. */
export const FAMILY_BASE: Readonly<Record<Family, number>> = { rfi: 0.3, limpers: 0.3, vsOpen: 0.25, vs3bet: 0.15 };
/** Number of limpers: 1 (50%), 2 (35%), 3 (15%). */
export const LIMPER_COUNTS: ReadonlyArray<readonly [number, number]> = [
  [1, 0.5],
  [2, 0.35],
  [3, 0.15],
];

const HERO_POSITIONS: Readonly<Record<Exclude<Family, 'limpers'>, readonly Position[]>> = {
  rfi: ['UTG', 'HJ', 'CO', 'BTN', 'SB'],
  vsOpen: ['HJ', 'CO', 'BTN', 'SB', 'BB'],
  vs3bet: ['UTG', 'HJ', 'CO', 'BTN', 'SB'],
};

export interface DrillWeights {
  /** Multiplies the base family mix (error weighting); missing = 1. */
  family?: Partial<Record<Family, number>>;
  /** Weight of each hero position (error weighting); missing = 1. */
  position?: Partial<Record<Position, number>>;
}

export function pickWeighted<T>(rng: Rng, items: readonly T[], weight: (item: T) => number): T {
  const weights = items.map(weight);
  const total = weights.reduce((a, b) => a + b, 0);
  if (!(total > 0)) throw new Error('pickWeighted: no positive weight');
  let x = rng() * total;
  for (let i = 0; i < items.length; i++) {
    x -= weights[i]!;
    if (x < 0) return items[i]!;
  }
  return items[items.length - 1]!;
}

function randomSubset<T>(rng: Rng, items: readonly T[], size: number): T[] {
  const pool = [...items];
  const chosen: T[] = [];
  for (let i = 0; i < size; i++) chosen.push(pool.splice(randomInt(rng, pool.length), 1)[0]!);
  return chosen;
}

export function randomSituation(rng: Rng, weights: DrillWeights = {}, only?: Family): Situation {
  const posWeight = (p: Position) => weights.position?.[p] ?? 1;
  const family = only ?? pickWeighted(rng, FAMILIES, (f) => FAMILY_BASE[f] * (weights.family?.[f] ?? 1));
  const base: Situation = { family, hero: 'UTG', limpers: [], opener: null, threeBettor: null };

  switch (family) {
    case 'rfi':
      return { ...base, hero: pickWeighted(rng, HERO_POSITIONS.rfi, posWeight) };
    case 'limpers': {
      const count = pickWeighted(rng, LIMPER_COUNTS, ([, p]) => p)[0];
      const heroes = POSITIONS.filter((p) => positionsBefore(p).length >= count);
      const hero = pickWeighted(rng, heroes, posWeight);
      const limpers = randomSubset(rng, positionsBefore(hero), count).sort((a, b) => PREFLOP_INDEX[a] - PREFLOP_INDEX[b]);
      return { ...base, hero, limpers };
    }
    case 'vsOpen': {
      const hero = pickWeighted(rng, HERO_POSITIONS.vsOpen, posWeight);
      return { ...base, hero, opener: pick(rng, positionsBefore(hero)) };
    }
    case 'vs3bet': {
      const hero = pickWeighted(rng, HERO_POSITIONS.vs3bet, posWeight);
      return { ...base, hero, threeBettor: pick(rng, positionsAfter(hero)) };
    }
  }
}

export function randomSpot(rng: Rng, weights: DrillWeights = {}, only?: Family): PreflopSpot {
  const situation = randomSituation(rng, weights, only);
  const cls = pickHandClass(rng, scenarioOf(situation), situation.hero);
  return buildSpot(situation, pick(rng, classCombos(cls)));
}

/** A fixed, typical situation for each scenario: used by the range browser for its explanations. */
export const EXAMPLE_SITUATIONS: Readonly<Record<ScenarioId, Situation>> = (() => {
  const s = (family: Family, hero: Position, extra: Partial<Situation> = {}): Situation => ({
    family,
    hero,
    limpers: [],
    opener: null,
    threeBettor: null,
    ...extra,
  });
  return {
    RFI_UTG: s('rfi', 'UTG'),
    RFI_HJ: s('rfi', 'HJ'),
    RFI_CO: s('rfi', 'CO'),
    RFI_BTN: s('rfi', 'BTN'),
    RFI_SB: s('rfi', 'SB'),
    LIMP1_IP: s('limpers', 'CO', { limpers: ['UTG'] }),
    LIMP2_IP: s('limpers', 'BTN', { limpers: ['UTG', 'HJ'] }),
    LIMP_SB: s('limpers', 'SB', { limpers: ['CO'] }),
    LIMP_BB: s('limpers', 'BB', { limpers: ['HJ', 'SB'] }),
    VS_EARLY_IP: s('vsOpen', 'CO', { opener: 'UTG' }),
    VS_LATE_BTN: s('vsOpen', 'BTN', { opener: 'CO' }),
    VS_OPEN_SB: s('vsOpen', 'SB', { opener: 'BTN' }),
    BB_VS_EARLY: s('vsOpen', 'BB', { opener: 'UTG' }),
    BB_VS_LATE: s('vsOpen', 'BB', { opener: 'BTN' }),
    VS3B_IP: s('vs3bet', 'CO', { threeBettor: 'BB' }),
    VS3B_OOP: s('vs3bet', 'HJ', { threeBettor: 'BTN' }),
  };
})();

export const familyOf = (id: ScenarioId): Family => SCENARIO_INFO[id].family;

import type { Card } from '../cards';
import type { ScenarioId } from '../preflop/data';
import { RFI_SCENARIO, SIZES, scenarioRanges } from '../preflop/data';
import { blindOf, inPositionOver, positionsAfter } from '../preflop/situation';
import type { Combo, HandClass } from '../range';
import { classesToCombos } from '../range';
import type { Rng } from '../rng';
import { pick, shuffleInPlace } from '../rng';
import type { Position } from '../table';
import { POSITIONS } from '../table';
import type { Profile, RangeKey } from './profiles';

// Postflop scenarios: the hero raised first in, one or two players called, and the hero decides
// about a c-bet on the flop. The hero's range is the open-raise range from preflop.json.

export const HU_SCENARIOS = ['P1', 'P2', 'P3', 'P4', 'P5'] as const;
export type HuScenario = (typeof HU_SCENARIOS)[number];
export const POSTFLOP_SCENARIOS = [...HU_SCENARIOS, 'PM'] as const;
export type PostflopScenario = (typeof POSTFLOP_SCENARIOS)[number];

export const isHeadsUp = (s: PostflopScenario): s is HuScenario => s !== 'PM';

export interface HuScenarioDef {
  id: HuScenario;
  hero: Position;
  villain: Position;
  heroRfi: ScenarioId;
  villainRange: RangeKey;
  /** Hero acts last on every postflop street. */
  inPosition: boolean;
}

const hu = (id: HuScenario, hero: Position, villain: Position, villainRange: RangeKey): HuScenarioDef => ({
  id,
  hero,
  villain,
  heroRfi: RFI_SCENARIO[hero]!,
  villainRange,
  inPosition: inPositionOver(hero, villain),
});

export const HU_SCENARIO_DEFS: Readonly<Record<HuScenario, HuScenarioDef>> = {
  P1: hu('P1', 'UTG', 'BB', 'bbVsEarly'),
  P2: hu('P2', 'CO', 'BB', 'bbVsLate'),
  P3: hu('P3', 'BTN', 'BB', 'bbVsLate'),
  P4: hu('P4', 'UTG', 'BTN', 'ccVsEarly'),
  P5: hu('P5', 'CO', 'BTN', 'ccVsLate'),
};

export const SCENARIO_NAMES_PL: Readonly<Record<PostflopScenario, string>> = {
  P1: 'P1 · open z UTG, BB sprawdza',
  P2: 'P2 · open z CO, BB sprawdza',
  P3: 'P3 · open z BTN, BB sprawdza',
  P4: 'P4 · open z UTG, BTN sprawdza',
  P5: 'P5 · open z CO, BTN sprawdza',
  PM: 'PM · open + 2 callerów (multiway)',
};

/** Positions the hero can open from with two callers behind (PM). */
export const MULTIWAY_HEROES: readonly Position[] = ['UTG', 'HJ', 'CO', 'BTN'];

/** Who is in the hand on the flop. */
export interface FlopSeats {
  scenario: PostflopScenario;
  hero: Position;
  opponents: Position[];
  /** Pot on the flop in dollars: everyone in the hand put in the open, plus dead blinds. */
  pot: number;
  /** Hero acts last against everyone still in the hand. */
  inPosition: boolean;
}

export function potOnFlop(hero: Position, opponents: readonly Position[]): number {
  const inHand = new Set([hero, ...opponents]);
  const dead = POSITIONS.filter((p) => !inHand.has(p)).reduce((sum, p) => sum + blindOf(p), 0);
  return SIZES.open * inHand.size + dead;
}

export function headsUpSeats(id: HuScenario): FlopSeats {
  const def = HU_SCENARIO_DEFS[id];
  return { scenario: id, hero: def.hero, opponents: [def.villain], pot: potOnFlop(def.hero, [def.villain]), inPosition: def.inPosition };
}

export function multiwaySeats(hero: Position, callers: readonly Position[]): FlopSeats {
  if (!MULTIWAY_HEROES.includes(hero)) throw new Error(`Hero cannot open from ${hero} in PM`);
  const after = positionsAfter(hero);
  if (callers.length !== 2 || new Set(callers).size !== 2 || callers.some((c) => !after.includes(c))) {
    throw new Error(`PM needs two different callers acting after ${hero}`);
  }
  const opponents = [...callers].sort((a, b) => POSITIONS.indexOf(a) - POSITIONS.indexOf(b));
  return {
    scenario: 'PM',
    hero,
    opponents,
    pot: potOnFlop(hero, opponents),
    inPosition: opponents.every((o) => inPositionOver(hero, o)),
  };
}

export function randomMultiwaySeats(rng: Rng): FlopSeats {
  const hero = pick(rng, MULTIWAY_HEROES);
  const callers = shuffleInPlace(positionsAfter(hero), rng).slice(0, 2);
  return multiwaySeats(hero, callers);
}

/** The hero's opening range (hand classes) from a position. */
export function openRange(hero: Position): ReadonlySet<HandClass> {
  const id = RFI_SCENARIO[hero];
  if (!id) throw new Error(`No open-raise range for ${hero}`);
  return scenarioRanges(id).raise;
}

export const heroCombos = (hero: Position, flop: readonly Card[]): Combo[] => classesToCombos(openRange(hero), flop);

export const villainRange = (id: HuScenario, profile: Profile): ReadonlySet<HandClass> =>
  profile.ranges[HU_SCENARIO_DEFS[id].villainRange];

/** Bet in whole dollars. */
export const betAmount = (pot: number, fraction: number): number => Math.round(pot * fraction);

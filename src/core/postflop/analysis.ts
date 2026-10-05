import type { Card } from '../cards';
import type { Combo, HandClass } from '../range';
import { classesToCombos, gridLabel } from '../range';
import type { Position } from '../table';
import type { HandDescription, RangeSummary } from './categories';
import { describeHand, summarizeRange } from './categories';
import type { Profile } from './profiles';
import type { EquityCount, ProgressCallback } from './rangeEquity';
import { rangeEquities } from './rangeEquity';
import type { DecisionColumn, HandContext, HandDecision, StrategyDecision } from './rule';
import { boardStrategy, handDecision } from './rule';
import type { HuScenario } from './scenarios';
import { HU_SCENARIO_DEFS, openRange, villainRange } from './scenarios';
import type { FlopTexture } from './texture';
import { flopTexture } from './texture';

// Range analysis on a flop: exact equity E, nut advantage N, category distributions and the
// board strategy that the decision rule derives from them.

export interface VillainResult {
  equity: EquityCount;
  summary: RangeSummary;
}

export interface RangeAnalysis {
  hero: RangeSummary;
  villains: VillainResult[];
}

/** Hero range against one or more villain ranges (hand classes) on a flop. */
export function analyzeRanges(
  flop: readonly Card[],
  hero: Iterable<HandClass>,
  villains: ReadonlyArray<Iterable<HandClass>>,
  onProgress?: ProgressCallback,
): RangeAnalysis {
  const heroCombos = classesToCombos(hero, flop);
  const villainCombos = villains.map((v) => classesToCombos(v, flop));
  const equities = rangeEquities(
    flop,
    [heroCombos, ...villainCombos],
    villainCombos.map((_, i) => ({ hero: 0, villain: i + 1 })),
    onProgress,
  );
  return {
    hero: summarizeRange(heroCombos, flop),
    villains: villainCombos.map((combos, i) => ({ equity: equities[i]!, summary: summarizeRange(combos, flop) })),
  };
}

export interface HeadsUpAnalysis {
  scenario: HuScenario;
  flop: Card[];
  texture: FlopTexture;
  equity: EquityCount;
  hero: RangeSummary;
  villain: RangeSummary;
  strategy: StrategyDecision;
}

/** Builds the full heads-up analysis from computed numbers (fresh, cached or precomputed). */
export function headsUpAnalysis(scenario: HuScenario, flop: readonly Card[], hero: RangeSummary, villain: VillainResult): HeadsUpAnalysis {
  const texture = flopTexture(flop);
  return {
    scenario,
    flop: [...flop],
    texture,
    equity: villain.equity,
    hero,
    villain: villain.summary,
    strategy: boardStrategy(villain.equity, hero, villain.summary, texture.wet),
  };
}

export function analyzeHeadsUp(scenario: HuScenario, profile: Profile, flop: readonly Card[], onProgress?: ProgressCallback): HeadsUpAnalysis {
  const r = analyzeRanges(flop, openRange(HU_SCENARIO_DEFS[scenario].hero), [villainRange(scenario, profile)], onProgress);
  return headsUpAnalysis(scenario, flop, r.hero, r.villains[0]!);
}

// ---------- the hero's action with every hand ----------

export interface ComboAction {
  combo: Combo;
  hand: HandDescription;
  decision: HandDecision;
}

export interface ActionCell {
  handClass: HandClass;
  /** Combos the hero can hold here (in the open range, no card on the flop). */
  combos: ComboAction[];
  bets: number;
}

/** 13×13 grid (row/column 0 = ace) of the hero's decisions with each combo of the open range. */
export function heroActionGrid(hero: Position, flop: readonly Card[], column: DecisionColumn, ctx: HandContext): ActionCell[][] {
  const range = openRange(hero);
  return Array.from({ length: 13 }, (_, r) =>
    Array.from({ length: 13 }, (_, c) => {
      const handClass = gridLabel(r, c);
      const combos: ComboAction[] = range.has(handClass)
        ? classesToCombos([handClass], flop).map((combo) => {
            const hand = describeHand(combo, flop);
            return { combo, hand, decision: handDecision(hand.category, column, ctx) };
          })
        : [];
      return { handClass, combos, bets: combos.filter((x) => x.decision.action === 'bet').length };
    }),
  );
}

/** Share of the hero's range (combos) that bets, for the grid legend. */
export function betShare(grid: readonly (readonly ActionCell[])[]): { bets: number; combos: number } {
  let bets = 0;
  let combos = 0;
  for (const row of grid) for (const cell of row) {
    bets += cell.bets;
    combos += cell.combos.length;
  }
  return { bets, combos };
}

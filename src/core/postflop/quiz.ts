import type { Card } from '../cards';
import { RANK_CHARS, rankOf } from '../cards';
import { usd } from '../math/format';
import type { Combo } from '../range';
import type { Rng } from '../rng';
import { pick, randomInt } from '../rng';
import type { Position } from '../table';
import type { HeadsUpAnalysis } from './analysis';
import type { HandCat, HandDescription } from './categories';
import { HAND_CATEGORIES, HAND_CATEGORY_NAMES_PL, describeHand, handCategory } from './categories';
import type { Profile } from './profiles';
import type { BetSize, BoardStrategy, DecisionColumn, HandContext, HandDecision } from './rule';
import {
  BET_FRACTIONS,
  BET_SIZE_SHORT,
  COLUMN_NAMES_PL,
  RULE_LABEL_PL,
  STRATEGY_NAMES_PL,
  decisionLabel,
  handDecision,
} from './rule';
import type { FlopSeats } from './scenarios';
import { betAmount, heroCombos } from './scenarios';
import type { FlopTexture, Height, Suits } from './texture';
import { HEIGHT_NAMES_PL, HEIGHT_RULES_PL, SUITS_DESCRIPTIONS_PL, SUITS_NAMES_PL, flopTexture } from './texture';

// Quiz items for the postflop trainer. Every correct answer and explanation comes from here.

export const QUIZ_TYPES = ['texture', 'strategy', 'hand', 'sizing'] as const;
export type QuizType = (typeof QUIZ_TYPES)[number];

export const QUIZ_TYPE_NAMES_PL: Readonly<Record<QuizType, string>> = {
  texture: 'Tekstura flopu',
  strategy: 'Strategia na flopie',
  hand: 'Decyzja ręką',
  sizing: 'Sizing',
};

// ---------- texture ----------

export interface TextureAnswer {
  suits: Suits;
  height: Height;
  wet: boolean;
}

export interface TextureGrade {
  correct: boolean;
  suits: boolean;
  height: boolean;
  wet: boolean;
  texture: FlopTexture;
}

/** Random flop; dry and wet flops come up equally often. */
export function randomTextureFlop(rng: Rng): Card[] {
  const wantWet = rng() < 0.5;
  for (;;) {
    const a = randomInt(rng, 52);
    const b = randomInt(rng, 52);
    const c = randomInt(rng, 52);
    if (a === b || a === c || b === c) continue;
    const flop = [a, b, c].sort((x, y) => y - x);
    if (flopTexture(flop).wet === wantWet) return flop;
  }
}

export function gradeTexture(flop: readonly Card[], answer: TextureAnswer): TextureGrade {
  const texture = flopTexture(flop);
  const suits = answer.suits === texture.suits;
  const height = answer.height === texture.height;
  const wet = answer.wet === texture.wet;
  return { correct: suits && height && wet, suits, height, wet, texture };
}

const rankPair = ([low, high]: readonly [number, number]): string => RANK_CHARS[high]! + RANK_CHARS[low]!;

export function explainTexture(flop: readonly Card[], t: FlopTexture = flopTexture(flop)): string[] {
  const top = RANK_CHARS[Math.max(...flop.map(rankOf))]!;
  const lines = [
    `Kolory: ${SUITS_NAMES_PL[t.suits]} — ${SUITS_DESCRIPTIONS_PL[t.suits]}.`,
    `Wysokość: ${HEIGHT_NAMES_PL[t.height]} — najwyższa karta ${top} (${HEIGHT_RULES_PL[t.height]}).`,
  ];
  if (t.paired) lines.push('Flop jest sparowany: z dwiema kartami z ręki nie da się tu zrobić stritu.');

  const straight =
    t.straightPairs > 0
      ? `${t.straightPairs} ${t.straightPairs === 1 ? 'para rang daje' : t.straightPairs < 5 ? 'pary rang dają' : 'par rang daje'} strit (${t.straightRankPairs.map(rankPair).join(', ')})`
      : 'żadna para rang nie daje stritu';
  const oesd = `${t.oesdPairs} ${t.oesdPairs === 1 ? 'para rang daje' : t.oesdPairs > 1 && t.oesdPairs < 5 ? 'pary rang dają' : 'par rang daje'} OESD lub double gutshot`;
  if (t.wet) {
    const why: string[] = [];
    if (t.suits !== 'rainbow') why.push(t.suits === 'monotone' ? 'trzy karty w kolorze (gotowe kolory i flush drawy)' : 'dwie karty w kolorze (flush drawy)');
    if (t.straightPairs > 0) why.push(straight);
    if (t.oesdPairs >= 3) why.push(oesd);
    lines.push(`Mokry: ${why.join('; ')}.`);
  } else {
    lines.push(`Suchy: rainbow, ${straight}, a tylko ${oesd} (mokry od 3).`);
  }
  return lines;
}

// ---------- strategy ----------

/** Balanced pick: a strategy uniformly among those present, then a flop with that strategy. */
export function pickStrategyFlop<T extends { strategy: BoardStrategy }>(rng: Rng, candidates: readonly T[]): T {
  const present = [...new Set(candidates.map((c) => c.strategy))];
  const target = pick(rng, present);
  return pick(
    rng,
    candidates.filter((c) => c.strategy === target),
  );
}

export const gradeStrategy = (a: HeadsUpAnalysis, given: BoardStrategy): boolean => a.strategy.strategy === given;

export function explainStrategy(a: HeadsUpAnalysis): string[] {
  return [`${RULE_LABEL_PL[0]!.toUpperCase()}${RULE_LABEL_PL.slice(1)} (heurystyka):`, ...a.strategy.reasons];
}

// ---------- hand ----------

export type HandOptionId = 'check' | BetSize;

export interface HandOption {
  id: HandOptionId;
  /** Button text, e.g. "Bet $6 (1/3)". */
  label: string;
  amount: number | null;
}

export function handOptions(pot: number, multiway: boolean): HandOption[] {
  const bet = (size: BetSize): HandOption => {
    const amount = betAmount(pot, BET_FRACTIONS[size]);
    return { id: size, label: `Bet ${usd(amount)} (${BET_SIZE_SHORT[size]})`, amount };
  };
  return multiway
    ? [{ id: 'check', label: 'Check', amount: null }, bet('half')]
    : [{ id: 'check', label: 'Check', amount: null }, bet('third'), bet('twoThirds')];
}

export interface HandSpot {
  seats: FlopSeats;
  flop: Card[];
  hand: Combo;
  description: HandDescription;
  column: DecisionColumn;
  ctx: HandContext;
  decision: HandDecision;
  options: HandOption[];
  correct: HandOptionId;
  /** Range analysis (heads-up only). */
  analysis: HeadsUpAnalysis | null;
}

/** Hand for the quiz: a category uniformly among those in the hero's range on this flop, then a combo. */
export function pickQuizHand(rng: Rng, hero: Position, flop: readonly Card[]): Combo {
  const byCategory = new Map<HandCat, Combo[]>();
  for (const c of heroCombos(hero, flop)) {
    const cat = handCategory(c, flop);
    byCategory.set(cat, [...(byCategory.get(cat) ?? []), c]);
  }
  const present = HAND_CATEGORIES.filter((c) => byCategory.has(c));
  return pick(rng, byCategory.get(pick(rng, present))!);
}

export function buildHandSpot(seats: FlopSeats, flop: readonly Card[], hand: Combo, profile: Profile, analysis: HeadsUpAnalysis | null): HandSpot {
  const multiway = seats.scenario === 'PM';
  if (!multiway && (!analysis || analysis.scenario !== seats.scenario)) throw new Error('Heads-up spots need the range analysis');
  const column: DecisionColumn = multiway ? 'multiway' : analysis!.strategy.strategy;
  const ctx: HandContext = { callsTooMuch: profile.callsTooMuch, inPosition: seats.inPosition };
  const description = describeHand(hand, flop);
  const decision = handDecision(description.category, column, ctx);
  return {
    seats,
    flop: [...flop],
    hand,
    description,
    column,
    ctx,
    decision,
    options: handOptions(seats.pot, multiway),
    correct: decision.action === 'check' ? 'check' : decision.size!,
    analysis: multiway ? null : analysis,
  };
}

export const gradeHand = (spot: HandSpot, given: HandOptionId): boolean => spot.correct === given;

export function explainHand(spot: HandSpot): string[] {
  const lines = [`Twoja ręka: ${spot.description.reason}.`];
  if (spot.analysis) {
    lines.push(`Strategia na tym flopie: ${STRATEGY_NAMES_PL[spot.analysis.strategy.strategy].toLowerCase()} (${spot.analysis.strategy.reasons[0]})`);
  } else {
    lines.push('Multiway (open + 2 callerów): bez obliczeń zakresów, tylko reguła — bet 1/2 puli z mocnymi rękami i silnymi drawami.');
  }
  lines.push(
    `Tabela (${RULE_LABEL_PL}): wiersz „${HAND_CATEGORY_NAMES_PL[spot.description.category]}” × kolumna „${COLUMN_NAMES_PL[spot.column]}” → ${decisionLabel(spot.decision)}.`,
  );
  lines.push(...spot.decision.reasons);
  return lines;
}

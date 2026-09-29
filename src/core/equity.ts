import type { Card } from './cards';
import { assertDistinct, remainingDeck } from './cards';
import { handValue } from './evaluator';
import { createRng, randomInt, randomSeed } from './rng';

export interface EquityResult {
  wins: number;
  ties: number;
  losses: number;
  /** Number of boards enumerated (exact) or sampled (Monte Carlo). */
  boards: number;
  /** Fractions in [0, 1]. */
  win: number;
  tie: number;
  /** win + tie / 2 */
  equity: number;
}

export interface MonteCarloOptions {
  trials?: number;
  seed?: number;
  dead?: readonly Card[];
}

export const DEFAULT_MONTE_CARLO_TRIALS = 50_000;

function validate(hero: readonly Card[], villain: readonly Card[], board: readonly Card[], dead: readonly Card[]) {
  if (hero.length !== 2 || villain.length !== 2) throw new Error('Each hand needs exactly 2 cards');
  if (![0, 3, 4, 5].includes(board.length)) throw new Error(`Board must have 0, 3, 4 or 5 cards, got ${board.length}`);
  const all = [...hero, ...villain, ...board, ...dead];
  for (const c of all) if (!Number.isInteger(c) || c < 0 || c > 51) throw new Error(`Invalid card index: ${c}`);
  assertDistinct(all);
}

function toResult(wins: number, ties: number, losses: number): EquityResult {
  const boards = wins + ties + losses;
  return { wins, ties, losses, boards, win: wins / boards, tie: ties / boards, equity: (wins + ties / 2) / boards };
}

/** Hero and villain 7-card buffers with hole cards and known board already filled in. */
function buffers(hero: readonly Card[], villain: readonly Card[], board: readonly Card[]) {
  const h = new Int32Array(7);
  const v = new Int32Array(7);
  h[0] = hero[0]!;
  h[1] = hero[1]!;
  v[0] = villain[0]!;
  v[1] = villain[1]!;
  board.forEach((c, i) => {
    h[2 + i] = c;
    v[2 + i] = c;
  });
  return { h, v, base: 2 + board.length };
}

/** Exact hand-vs-hand equity by enumerating every possible runout. */
export function equityExact(
  hero: readonly Card[],
  villain: readonly Card[],
  board: readonly Card[] = [],
  dead: readonly Card[] = [],
): EquityResult {
  validate(hero, villain, board, dead);
  const deck = remainingDeck([...hero, ...villain, ...board, ...dead]);
  const need = 5 - board.length;
  const { h, v, base } = buffers(hero, villain, board);
  let wins = 0;
  let ties = 0;
  let losses = 0;

  const enumerate = (start: number, depth: number): void => {
    if (depth === need) {
      const diff = handValue(h, 7) - handValue(v, 7);
      if (diff > 0) wins++;
      else if (diff < 0) losses++;
      else ties++;
      return;
    }
    for (let i = start; i <= deck.length - (need - depth); i++) {
      h[base + depth] = deck[i]!;
      v[base + depth] = deck[i]!;
      enumerate(i + 1, depth + 1);
    }
  };
  enumerate(0, 0);
  return toResult(wins, ties, losses);
}

/** Monte Carlo hand-vs-hand equity with a seedable generator. */
export function equityMonteCarlo(
  hero: readonly Card[],
  villain: readonly Card[],
  board: readonly Card[] = [],
  options: MonteCarloOptions = {},
): EquityResult {
  const { trials = DEFAULT_MONTE_CARLO_TRIALS, seed = randomSeed(), dead = [] } = options;
  if (!Number.isInteger(trials) || trials <= 0) throw new Error('trials must be a positive integer');
  validate(hero, villain, board, dead);
  const deck = remainingDeck([...hero, ...villain, ...board, ...dead]);
  const need = 5 - board.length;
  const { h, v, base } = buffers(hero, villain, board);
  const rng = createRng(seed);
  let wins = 0;
  let ties = 0;
  let losses = 0;

  for (let t = 0; t < trials; t++) {
    // Partial Fisher-Yates: the first `need` slots become a uniform random runout.
    for (let k = 0; k < need; k++) {
      const j = k + randomInt(rng, deck.length - k);
      const tmp = deck[k]!;
      deck[k] = deck[j]!;
      deck[j] = tmp;
      h[base + k] = deck[k]!;
      v[base + k] = deck[k]!;
    }
    const diff = handValue(h, 7) - handValue(v, 7);
    if (diff > 0) wins++;
    else if (diff < 0) losses++;
    else ties++;
  }
  return toResult(wins, ties, losses);
}

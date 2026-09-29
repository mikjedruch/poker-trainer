import type { Rng } from '../rng';
import { pick, randomInt } from '../rng';

/** Effective stack at the start of the hand: 100bb at $1/$2. */
export const STARTING_STACK = 200;
export const MIN_POT = 15;
export const MAX_POT = 300;
export const BET_FRACTIONS: readonly number[] = [1 / 3, 1 / 2, 2 / 3, 3 / 4, 1, 1.5];

export interface BetSpot {
  /** Pot before the bet, in dollars. */
  pot: number;
  /** Bet facing hero (or hero's bluff size), in dollars. */
  bet: number;
  /** Effective stack behind before the bet goes in. */
  stack: number;
  /** Bet as a fraction of the pot, or null for an all-in that fits no standard size. */
  fraction: number | null;
  allIn: boolean;
}

export const roundBet = (amount: number): number => Math.max(5, Math.round(amount / 5) * 5);

/** Heads-up pot built equally: hero has put half of it in. */
export const stackBehind = (pot: number): number => STARTING_STACK - Math.round(pot / 2);

export function fractionLabel(fraction: number): string {
  const labels: Array<[number, string]> = [
    [1 / 3, '1/3 puli'],
    [1 / 2, '1/2 puli'],
    [2 / 3, '2/3 puli'],
    [3 / 4, '3/4 puli'],
    [1, 'pula'],
    [1.5, '1.5× puli'],
  ];
  return labels.find(([f]) => Math.abs(f - fraction) < 1e-9)?.[1] ?? `${Math.round(fraction * 100)}% puli`;
}

export function betLabel(spot: BetSpot): string {
  if (spot.allIn) return 'all‑in'; // non-breaking hyphen
  return spot.fraction === null ? '' : fractionLabel(spot.fraction);
}

export interface BetSpotOptions {
  /** If false, the bet always leaves money behind (needed for implied odds). */
  allowAllIn?: boolean;
  /** Villain shoves: bet = whole stack, pot chosen so the shove is 0.5×–2× pot. */
  forceAllIn?: boolean;
}

export function generateBetSpot(rng: Rng, options: BetSpotOptions = {}): BetSpot {
  const { allowAllIn = true, forceAllIn = false } = options;
  if (forceAllIn) {
    // stack = 200 − pot/2 lies within [pot/2, 2·pot] exactly when pot ∈ [80, 200].
    const pot = 80 + randomInt(rng, 121);
    const stack = stackBehind(pot);
    return { pot, bet: stack, stack, fraction: null, allIn: true };
  }
  for (;;) {
    const pot = MIN_POT + randomInt(rng, MAX_POT - MIN_POT + 1);
    const stack = stackBehind(pot);
    const fits = BET_FRACTIONS.filter((f) => {
      const bet = roundBet(pot * f);
      return allowAllIn ? bet <= stack : bet < stack;
    });
    if (fits.length > 0) {
      const fraction = pick(rng, fits);
      const bet = roundBet(pot * fraction);
      return { pot, bet, stack, fraction, allIn: bet === stack };
    }
    if (allowAllIn) return { pot, bet: stack, stack, fraction: null, allIn: true };
  }
}

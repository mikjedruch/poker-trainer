// Pot-odds formulas. P = pot before the bet, X = bet size, e = equity as a fraction.

function assertSpot(pot: number, bet: number): void {
  if (!(pot > 0) || !(bet > 0)) throw new Error(`Pot and bet must be positive (pot=${pot}, bet=${bet})`);
}

function assertEquity(equity: number): void {
  if (!(equity >= 0 && equity <= 1)) throw new Error(`Equity must be in [0, 1], got ${equity}`);
}

/** Equity needed for a break-even call: X / (P + 2X). */
export function requiredEquity(pot: number, bet: number): number {
  assertSpot(pot, bet);
  return bet / (pot + 2 * bet);
}

/** EV of calling when nothing more goes in: e·(P + 2X) − X. */
export function callEv(equity: number, pot: number, bet: number): number {
  assertSpot(pot, bet);
  assertEquity(equity);
  return equity * (pot + 2 * bet) - bet;
}

/** Minimum defense frequency: P / (P + X). */
export function minimumDefenseFrequency(pot: number, bet: number): number {
  assertSpot(pot, bet);
  return pot / (pot + bet);
}

/** How often a bluff of X into P must work to break even: X / (P + X). */
export function bluffBreakEven(pot: number, bet: number): number {
  assertSpot(pot, bet);
  return bet / (pot + bet);
}

/**
 * Extra money W hero must win on average after hitting, so that calling X into P breaks even:
 * e·(P + X + W) = (1 − e)·X  ⇒  W = (1 − e)·X / e − P − X. Zero if the call is already +EV.
 */
export function impliedOddsNeeded(equity: number, pot: number, bet: number): number {
  assertSpot(pot, bet);
  assertEquity(equity);
  if (equity === 0) return Infinity;
  return Math.max(0, ((1 - equity) * bet) / equity - pot - bet);
}

/** Rule of 4 on the flop (two cards to come), rule of 2 on the turn. Capped at 100%. */
export function ruleOf2And4(outs: number, street: 'flop' | 'turn'): number {
  return Math.min(1, (outs * (street === 'flop' ? 4 : 2)) / 100);
}

import type { Card } from './cards';
import { FULL_DECK, rankOf, suitOf } from './cards';
import { HandCategory, categoryOf, evaluateHand, handValue, straightHighOfMask } from './evaluator';
import { computeOuts } from './outs';
import type { Rng } from './rng';
import { randomInt } from './rng';

export type Street = 'flop' | 'turn';

export const DRAW_CATEGORIES = ['flushDraw', 'oesd', 'gutshot', 'comboDraw', 'overcards', 'pairPlusDraw'] as const;
export type DrawCategory = (typeof DRAW_CATEGORIES)[number];

export const DRAW_NAMES_PL: Readonly<Record<DrawCategory, string>> = {
  flushDraw: 'flush draw',
  oesd: 'OESD (otwarty strit)',
  gutshot: 'gutshot',
  comboDraw: 'combo draw (kolor + strit)',
  overcards: 'dwie overkarty',
  pairPlusDraw: 'para + draw',
};

export type StraightDraw = 'none' | 'gutshot' | 'oesd' | 'doubleGutshot' | 'made';

export interface DrawFeatures {
  flushDraw: boolean;
  madeFlush: boolean;
  straightDraw: StraightDraw;
  /** Ranks (0..12) that give hero a straight better than the board alone. */
  completingRanks: number[];
  boardPaired: boolean;
  heroCategory: HandCategory;
  /** Hole cards ranked above every board card. */
  overcards: number;
}

const rankMask = (cards: readonly Card[]): number => cards.reduce((m, c) => m | (1 << rankOf(c)), 0);

/** True if some four consecutive ranks are present and both ends complete a straight. */
function isOpenEnded(mask: number, completing: readonly number[]): boolean {
  // Extended rank -1 is the ace playing low.
  const has = (r: number) => (r === -1 ? (mask & (1 << 12)) !== 0 : (mask & (1 << r)) !== 0);
  for (let a = 0; a + 3 <= 12; a++) {
    if (!(has(a) && has(a + 1) && has(a + 2) && has(a + 3))) continue;
    const low = a - 1 === -1 ? 12 : a - 1;
    const high = a + 4;
    if (high <= 12 && completing.includes(low) && completing.includes(high)) return true;
  }
  return false;
}

export function drawFeatures(hero: readonly Card[], board: readonly Card[]): DrawFeatures {
  const all = [...hero, ...board];
  const suitCounts = [0, 0, 0, 0];
  for (const c of all) suitCounts[suitOf(c)]!++;
  const madeFlush = suitCounts.some((n) => n >= 5);
  const flushDraw = !madeFlush && hero.some((c) => suitCounts[suitOf(c)] === 4);

  const mask = rankMask(all);
  const boardMask = rankMask(board);
  const completingRanks: number[] = [];
  let straightDraw: StraightDraw;
  if (straightHighOfMask(mask) >= 0) {
    straightDraw = 'made';
  } else {
    for (let r = 0; r <= 12; r++) {
      if (mask & (1 << r)) continue;
      if (straightHighOfMask(mask | (1 << r)) > straightHighOfMask(boardMask | (1 << r))) completingRanks.push(r);
    }
    if (completingRanks.length === 0) straightDraw = 'none';
    else if (completingRanks.length === 1) straightDraw = 'gutshot';
    else straightDraw = isOpenEnded(mask, completingRanks) ? 'oesd' : 'doubleGutshot';
  }

  const boardRanks = board.map(rankOf);
  const maxBoard = Math.max(...boardRanks);
  return {
    flushDraw,
    madeFlush,
    straightDraw,
    completingRanks,
    boardPaired: new Set(boardRanks).size !== boardRanks.length,
    heroCategory: evaluateHand(all).category,
    overcards: hero.filter((c) => rankOf(c) > maxBoard).length,
  };
}

/**
 * Draw category of hero's hand, or null if it fits none of them.
 * Categories are disjoint; paired boards and double gutshots are left out on purpose.
 */
export function classifyDraw(hero: readonly Card[], board: readonly Card[]): DrawCategory | null {
  const f = drawFeatures(hero, board);
  if (f.boardPaired || f.madeFlush || f.straightDraw === 'made' || f.straightDraw === 'doubleGutshot') return null;
  const straight = f.straightDraw === 'oesd' || f.straightDraw === 'gutshot';

  if (f.heroCategory === HandCategory.HighCard) {
    if (f.flushDraw) return straight ? 'comboDraw' : 'flushDraw';
    if (f.straightDraw === 'oesd') return 'oesd';
    if (f.straightDraw === 'gutshot') return 'gutshot';
    return f.overcards === 2 ? 'overcards' : null;
  }
  if (f.heroCategory === HandCategory.Pair && (f.flushDraw || straight)) return 'pairPlusDraw';
  return null;
}

export interface DrawSpot {
  hero: Card[];
  villain: Card[];
  board: Card[];
  street: Street;
  category: DrawCategory;
}

/** Moves a uniformly random card from deck[from..] into each of the slots from..to-1. */
function drawInto(deck: Card[], from: number, to: number, rng: Rng): void {
  for (let k = from; k < to; k++) {
    const j = k + randomInt(rng, deck.length - k);
    const tmp = deck[k]!;
    deck[k] = deck[j]!;
    deck[j] = tmp;
  }
}

const VILLAIN_TRIES = 40;

/**
 * Rejection sampling: deal hero + board until hero's hand matches the category, then deal
 * villain hands until one is ahead with at least a pair and hero still has at least one out.
 */
export function generateDrawSpot(rng: Rng, category: DrawCategory, street: Street, maxAttempts = 500_000): DrawSpot {
  const boardSize = street === 'flop' ? 3 : 4;
  const deck = [...FULL_DECK];
  const known = 2 + boardSize;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    drawInto(deck, 0, known, rng);
    const hero = deck.slice(0, 2);
    const board = deck.slice(2, known);
    if (classifyDraw(hero, board) !== category) continue;

    const heroValue = handValue([...hero, ...board]);
    for (let t = 0; t < VILLAIN_TRIES; t++) {
      drawInto(deck, known, known + 2, rng);
      const villain = deck.slice(known, known + 2);
      const villainValue = handValue([...villain, ...board]);
      if (villainValue <= heroValue || categoryOf(villainValue) < HandCategory.Pair) continue;
      if (computeOuts(hero, villain, board).outs.length === 0) continue;
      return { hero, villain, board, street, category };
    }
  }
  throw new Error(`Could not generate a ${category} spot on the ${street}`);
}

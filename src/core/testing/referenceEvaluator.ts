// Deliberately naive reference evaluator used only by tests to cross-check
// the fast evaluator. It shares nothing with evaluator.ts except the card
// encoding: every 5-card subset is scored as a tuple and the best one wins.
import type { Card } from '../cards';
import { rankOf, suitOf } from '../cards';

export type RankTuple = number[];

export function compareTuples(a: RankTuple, b: RankTuple): number {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const d = (a[i] ?? -1) - (b[i] ?? -1);
    if (d !== 0) return Math.sign(d);
  }
  return 0;
}

export function referenceRank5(cards: readonly Card[]): RankTuple {
  if (cards.length !== 5) throw new Error('need 5 cards');
  const ranks = cards.map(rankOf).sort((a, b) => b - a);
  const isFlush = cards.every((c) => suitOf(c) === suitOf(cards[0]!));
  const unique = [...new Set(ranks)];
  let straightHigh = -1;
  if (unique.length === 5) {
    if (ranks[0]! - ranks[4]! === 4) straightHigh = ranks[0]!;
    else if (ranks.join(',') === '12,3,2,1,0') straightHigh = 3;
  }
  const counts = new Map<number, number>();
  for (const r of ranks) counts.set(r, (counts.get(r) ?? 0) + 1);
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const shape = groups.map((g) => g[1]).join('');
  const groupRanks = groups.map((g) => g[0]);

  if (isFlush && straightHigh >= 0) return [8, straightHigh];
  if (shape === '41') return [7, ...groupRanks];
  if (shape === '32') return [6, ...groupRanks];
  if (isFlush) return [5, ...ranks];
  if (straightHigh >= 0) return [4, straightHigh];
  if (shape === '311') return [3, ...groupRanks];
  if (shape === '221') return [2, ...groupRanks];
  if (shape === '2111') return [1, ...groupRanks];
  return [0, ...ranks];
}

export function referenceBest(cards: readonly Card[]): RankTuple {
  let best: RankTuple | null = null;
  const n = cards.length;
  for (let a = 0; a < n; a++)
    for (let b = a + 1; b < n; b++)
      for (let c = b + 1; c < n; c++)
        for (let d = c + 1; d < n; d++)
          for (let e = d + 1; e < n; e++) {
            const t = referenceRank5([cards[a]!, cards[b]!, cards[c]!, cards[d]!, cards[e]!]);
            if (best === null || compareTuples(t, best) > 0) best = t;
          }
  if (best === null) throw new Error('need at least 5 cards');
  return best;
}

/** Exact hand-vs-hand counts using only the reference evaluator (slow; small boards only). */
export function referenceEquityCounts(
  hero: readonly Card[],
  villain: readonly Card[],
  board: readonly Card[],
  deck: readonly Card[],
): { wins: number; ties: number; losses: number; boards: number } {
  const need = 5 - board.length;
  let wins = 0;
  let ties = 0;
  let losses = 0;
  let boards = 0;
  const pick = (start: number, chosen: Card[]): void => {
    if (chosen.length === need) {
      const full = [...board, ...chosen];
      const cmp = compareTuples(referenceBest([...hero, ...full]), referenceBest([...villain, ...full]));
      if (cmp > 0) wins++;
      else if (cmp < 0) losses++;
      else ties++;
      boards++;
      return;
    }
    for (let i = start; i < deck.length; i++) pick(i + 1, [...chosen, deck[i]!]);
  };
  pick(0, []);
  return { wins, ties, losses, boards };
}

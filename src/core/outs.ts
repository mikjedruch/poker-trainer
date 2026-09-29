import type { Card } from './cards';
import { assertDistinct, rankOf, remainingDeck } from './cards';
import type { HandEvaluation } from './evaluator';
import { HandCategory, categoryOf, evaluateHand, handValue } from './evaluator';

export interface OutCard {
  card: Card;
  /** Hero's and villain's hands after this card. */
  heroCategory: HandCategory;
  villainCategory: HandCategory;
}

export interface OutsResult {
  street: 'flop' | 'turn';
  /** Unseen cards (deck minus both hands and the board). */
  cardsLeft: number;
  heroNow: HandEvaluation;
  villainNow: HandEvaluation;
  heroAheadNow: boolean;
  /** Cards after which hero is strictly ahead. */
  outs: OutCard[];
  /**
   * Cards that improve hero's hand (beyond what the board alone makes) to something
   * that would beat villain's current hand, but improve villain even more, so hero still loses.
   */
  falseOuts: OutCard[];
  /** Cards after which the hands tie. Not counted as outs. */
  splits: OutCard[];
}

/** Category made by the board cards alone (4 or 5 cards). */
function boardCategory(board: readonly Card[]): HandCategory {
  if (board.length >= 5) return categoryOf(handValue(board));
  // Four cards cannot hold a straight or flush: only rank multiplicities matter.
  const counts = new Map<number, number>();
  for (const c of board) counts.set(rankOf(c), (counts.get(rankOf(c)) ?? 0) + 1);
  const shape = [...counts.values()].sort((a, b) => b - a).join('');
  if (shape === '4') return HandCategory.Quads;
  if (shape.startsWith('3')) return HandCategory.Trips;
  if (shape === '22') return HandCategory.TwoPair;
  if (shape.startsWith('2')) return HandCategory.Pair;
  return HandCategory.HighCard;
}

/** Classifies every unseen card for hero vs a known villain hand on a flop or turn. */
export function computeOuts(hero: readonly Card[], villain: readonly Card[], board: readonly Card[]): OutsResult {
  if (hero.length !== 2 || villain.length !== 2) throw new Error('Each hand needs exactly 2 cards');
  if (board.length !== 3 && board.length !== 4) throw new Error('Outs need a flop or a turn board');
  assertDistinct([...hero, ...villain, ...board]);

  const heroNow = evaluateHand([...hero, ...board]);
  const villainNow = evaluateHand([...villain, ...board]);
  const deck = remainingDeck([...hero, ...villain, ...board]);
  const heroCards = [...hero, ...board, 0];
  const villainCards = [...villain, ...board, 0];
  const last = heroCards.length - 1;

  const outs: OutCard[] = [];
  const falseOuts: OutCard[] = [];
  const splits: OutCard[] = [];
  for (const card of deck) {
    heroCards[last] = card;
    villainCards[last] = card;
    const heroValue = handValue(heroCards);
    const villainValue = handValue(villainCards);
    const entry: OutCard = { card, heroCategory: categoryOf(heroValue), villainCategory: categoryOf(villainValue) };
    if (heroValue > villainValue) outs.push(entry);
    else if (heroValue === villainValue) splits.push(entry);
    else if (heroValue > villainNow.value && entry.heroCategory > boardCategory([...board, card])) falseOuts.push(entry);
  }

  return {
    street: board.length === 3 ? 'flop' : 'turn',
    cardsLeft: deck.length,
    heroNow,
    villainNow,
    heroAheadNow: heroNow.value > villainNow.value,
    outs,
    falseOuts,
    splits,
  };
}

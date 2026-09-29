import { describe, expect, it } from 'vitest';
import { FULL_DECK, parseCards } from './cards';
import { CATEGORY_NAMES_PL, HandCategory, categoryOf, compareHands, evaluateHand, handValue } from './evaluator';
import { createRng, shuffleInPlace } from './rng';
import { compareTuples, referenceBest } from './testing/referenceEvaluator';

const value = (s: string) => handValue(parseCards(s));
const category = (s: string) => evaluateHand(parseCards(s)).category;

describe('evaluator: required cases', () => {
  it('wheel A-2-3-4-5 loses to 2-3-4-5-6', () => {
    expect(category('As 2d 3c 4h 5s')).toBe(HandCategory.Straight);
    expect(value('As 2d 3c 4h 5s')).toBeLessThan(value('2d 3c 4h 5s 6d'));
  });

  it('A-K-Q-J-T is the best straight', () => {
    expect(value('As Kd Qc Jh Ts')).toBeGreaterThan(value('Kd Qc Jh Ts 9s'));
    expect(value('As Kd Qc Jh Ts')).toBeGreaterThan(value('As 2d 3c 4h 5s'));
  });

  it('flush beats straight, full house beats flush', () => {
    expect(value('2h 7h 9h Jh Kh')).toBeGreaterThan(value('As Kd Qc Jh Ts'));
    expect(value('2s 2d 3c 3h 3s')).toBeGreaterThan(value('Ah Kh Qh Jh 9h'));
  });

  it('full house with higher trips wins regardless of the pair', () => {
    expect(value('Ks Kd Kc 2h 2s')).toBeGreaterThan(value('Qs Qd Qc Ah As'));
  });

  it('same two pair is decided by the kicker', () => {
    const board = 'Ks Kd 7c 7h 2s';
    expect(compareHands(parseCards(`Ah 3c ${board}`), parseCards(`Qh 3d ${board}`))).toBe(1);
  });

  it('board plays for both players: tie', () => {
    const board = 'As Ks Qd Jc Th';
    expect(compareHands(parseCards(`2c 3d ${board}`), parseCards(`4c 5d ${board}`))).toBe(0);
    const pairedBoard = 'As Ad Kc Kh Qs';
    expect(compareHands(parseCards(`2c 3d ${pairedBoard}`), parseCards(`4c 5h ${pairedBoard}`))).toBe(0);
  });

  it('7 cards: picks the top 5 of six flush cards', () => {
    const r = evaluateHand(parseCards('Ah Kh 9h 7h 4h 2h 3c'));
    expect(r.category).toBe(HandCategory.Flush);
    expect(r.value).toBe(value('Ah Kh 9h 7h 4h'));
  });

  it('7 cards: picks the highest of overlapping straights', () => {
    expect(value('5c 6d 7h 8s 9c Tc Jd')).toBe(value('7h 8s 9c Tc Jd'));
  });

  it('7 cards: straight flush beats a higher flush in the same suit', () => {
    expect(category('2h 3h 4h 5h 6h Ah Kh')).toBe(HandCategory.StraightFlush);
    expect(value('2h 3h 4h 5h 6h Ah Kh')).toBe(value('2h 3h 4h 5h 6h'));
  });

  it('7 cards: steel wheel beats a higher plain straight', () => {
    expect(category('As 2s 3s 4s 5s 6d 7d')).toBe(HandCategory.StraightFlush);
  });

  it('7 cards: two trips make a full house with the higher trips', () => {
    expect(value('Ks Kd Kc 9s 9d 9c 2h')).toBe(value('Ks Kd Kc 9s 9d'));
  });

  it('7 cards: three pairs use the best kicker', () => {
    expect(value('As Ad Ks Kd Qs Qd 2c')).toBe(value('As Ad Ks Kd Qs'));
    expect(value('As Ad Ks Kd Qs Qd 2c')).toBeGreaterThan(value('As Ad Ks Kd 3s 3d Jc'));
  });

  it('7 cards: quads use the best kicker, even from trips', () => {
    expect(value('As Ad Ac Ah Ks 2d 3c')).toBeGreaterThan(value('As Ad Ac Ah Qs Qd Qc'));
  });

  it('works with 6 cards', () => {
    expect(category('Ah Kh Qh Jh 9c 2h')).toBe(HandCategory.Flush);
  });

  it('rejects fewer than 5 or more than 7 cards', () => {
    expect(() => handValue(parseCards('As Kd Qc Jh'))).toThrow();
    expect(() => handValue(parseCards('As Kd Qc Jh Ts 9s 8s 7s'))).toThrow();
  });

  it('names categories in Polish', () => {
    expect(CATEGORY_NAMES_PL).toEqual([
      'wysoka karta',
      'para',
      'dwie pary',
      'trójka',
      'strit',
      'kolor',
      'full',
      'kareta',
      'poker',
    ]);
    expect(evaluateHand(parseCards('Ks Kd Kc 2h 2s')).name).toBe('full');
    expect(evaluateHand(parseCards('2h 3h 4h 5h 6h')).name).toBe('poker');
  });
});

describe('evaluator: exhaustive and cross-checked', () => {
  it('matches the known category counts over all 2,598,960 five-card hands', () => {
    const counts = new Array<number>(9).fill(0);
    const hand = [0, 0, 0, 0, 0];
    for (let a = 0; a < 52; a++) {
      hand[0] = a;
      for (let b = a + 1; b < 52; b++) {
        hand[1] = b;
        for (let c = b + 1; c < 52; c++) {
          hand[2] = c;
          for (let d = c + 1; d < 52; d++) {
            hand[3] = d;
            for (let e = d + 1; e < 52; e++) {
              hand[4] = e;
              counts[categoryOf(handValue(hand))]!++;
            }
          }
        }
      }
    }
    expect(counts).toEqual([1302540, 1098240, 123552, 54912, 10200, 5108, 3744, 624, 40]);
  });

  it('agrees with the naive reference evaluator on 100,000 random 7-card showdowns', () => {
    const rng = createRng(12345);
    const deck = [...FULL_DECK];
    for (let i = 0; i < 100_000; i++) {
      shuffleInPlace(deck, rng);
      const board = deck.slice(0, 5);
      const a = [deck[5]!, deck[6]!, ...board];
      const b = [deck[7]!, deck[8]!, ...board];
      const fast = Math.sign(handValue(a) - handValue(b));
      const ref = compareTuples(referenceBest(a), referenceBest(b));
      if (fast !== ref) throw new Error(`mismatch on ${a} vs ${b}`);
      expect(categoryOf(handValue(a))).toBe(referenceBest(a)[0]);
    }
  });

  it('agrees with the reference evaluator on 5- and 6-card hands', () => {
    const rng = createRng(777);
    const deck = [...FULL_DECK];
    for (let i = 0; i < 20_000; i++) {
      shuffleInPlace(deck, rng);
      for (const n of [5, 6]) {
        const a = deck.slice(0, n);
        const b = deck.slice(n, 2 * n);
        const fast = Math.sign(handValue(a) - handValue(b));
        if (fast !== compareTuples(referenceBest(a), referenceBest(b))) throw new Error(`mismatch ${a} vs ${b}`);
      }
    }
  });
});

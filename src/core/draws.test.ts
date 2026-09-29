import { describe, expect, it } from 'vitest';
import { assertDistinct, parseCards } from './cards';
import type { DrawCategory } from './draws';
import { DRAW_CATEGORIES, classifyDraw, drawFeatures, generateDrawSpot } from './draws';
import { handValue } from './evaluator';
import { computeOuts } from './outs';
import { createRng } from './rng';

const classify = (hero: string, board: string) => classifyDraw(parseCards(hero), parseCards(board));

describe('draw classification', () => {
  const cases: Array<[string, string, DrawCategory | null]> = [
    ['Ah 5h', 'Kh 9h 2c', 'flushDraw'],
    ['8s 7s', '6h 5d 2c', 'oesd'],
    ['5c 4d', '3h 2s 9c', 'oesd'], // wheel end counts: A or 6
    ['Jc Tc', 'Qd Kh 3s', 'oesd'], // A or 9
    ['9s 8s', 'Jh 7d 2c', 'gutshot'],
    ['Ad Kc', 'Qh Jd 4s', 'gutshot'], // only a ten; straight draw wins over overcards
    ['Jc Qd', 'Ah Kd 4s', 'gutshot'], // J-Q-K-A is closed on one side
    ['9h 8h', '7h 6d 2h', 'comboDraw'],
    ['Ks Qs', 'As Js 2d', 'comboDraw'],
    ['As Kd', '8h 5c 2d', 'overcards'],
    ['As Kd', '8h 5c 2d 9s', 'overcards'],
    ['As Kd', '8h 5c 2d 3s', 'gutshot'], // any 4 makes the wheel
    ['7h 6h', '7d 5h 2h', 'pairPlusDraw'],
    ['Td 9d', 'Th 8c 7s', 'pairPlusDraw'],
    ['9c 7d', 'Jh 8s 5c', null], // double gutshot: not one of the categories
    ['Ah 5h', 'Kh Kd 9h', null], // paired board
    ['Ah Kh', '7h 2h 9h', null], // already a flush
    ['8s 7s', '6h 5d 4c', null], // already a straight
    ['Qs Jd', '8h 5c 2d', 'overcards'],
    ['Qs 3d', '8h 5c 2d', null], // only one overcard
  ];

  for (const [hero, board, expected] of cases) {
    it(`${hero} on ${board} → ${expected}`, () => {
      expect(classify(hero, board)).toBe(expected);
    });
  }

  it('a flush draw needs a hole card of the suit', () => {
    expect(drawFeatures(parseCards('Ac 5d'), parseCards('Kh 9h 2h 3h')).flushDraw).toBe(false);
    expect(drawFeatures(parseCards('Ah 5d'), parseCards('Kh 9h 2c 3h')).flushDraw).toBe(true);
  });

  it('a straight completed only on the board is not a draw for hero', () => {
    // Board 5-6-7-8: a 4 or 9 makes a straight for everybody; A-K has no straight draw.
    expect(drawFeatures(parseCards('Ad Kc'), parseCards('5s 6h 7d 8c')).straightDraw).toBe('none');
  });
});

describe('draw spot generator', () => {
  for (const category of DRAW_CATEGORIES) {
    for (const street of ['flop', 'turn'] as const) {
      it(`${category} on the ${street}: matching, behind, with outs, no duplicate cards`, () => {
        for (let seed = 1; seed <= 25; seed++) {
          const spot = generateDrawSpot(createRng(seed * 7919), category, street);
          expect(spot.category).toBe(category);
          expect(spot.street).toBe(street);
          expect(spot.board).toHaveLength(street === 'flop' ? 3 : 4);
          assertDistinct([...spot.hero, ...spot.villain, ...spot.board]);
          expect(classifyDraw(spot.hero, spot.board)).toBe(category);
          expect(handValue([...spot.villain, ...spot.board])).toBeGreaterThan(handValue([...spot.hero, ...spot.board]));
          expect(computeOuts(spot.hero, spot.villain, spot.board).outs.length).toBeGreaterThan(0);
        }
      });
    }
  }

  it('is reproducible with the same seed', () => {
    expect(generateDrawSpot(createRng(5), 'oesd', 'flop')).toEqual(generateDrawSpot(createRng(5), 'oesd', 'flop'));
  });
});

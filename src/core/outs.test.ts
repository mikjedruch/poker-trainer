import { describe, expect, it } from 'vitest';
import { formatCard, parseCards } from './cards';
import { HandCategory } from './evaluator';
import { computeOuts } from './outs';

const names = (cards: { card: number }[]) => cards.map((o) => formatCard(o.card)).sort();
const sorted = (s: string) => s.split(' ').sort();

describe('outs', () => {
  it('turn: Ah5h vs KsKd on Kh 9h 2c 3d has exactly 10 outs', () => {
    const r = computeOuts(parseCards('Ah 5h'), parseCards('Ks Kd'), parseCards('Kh 9h 2c 3d'));
    expect(r.street).toBe('turn');
    expect(r.heroAheadNow).toBe(false);
    expect(r.outs).toHaveLength(10);
    expect(names(r.outs)).toEqual(sorted('4h 6h 7h 8h Th Jh Qh 4s 4c 4d'));

    const flushOuts = r.outs.filter((o) => o.heroCategory === HandCategory.Flush);
    const straightOuts = r.outs.filter((o) => o.heroCategory === HandCategory.Straight);
    expect(names(flushOuts)).toEqual(sorted('4h 6h 7h 8h Th Jh Qh'));
    expect(names(straightOuts)).toEqual(sorted('4s 4c 4d'));

    expect(names(r.falseOuts)).toEqual(sorted('2h 3h'));
    for (const f of r.falseOuts) {
      expect(f.heroCategory).toBe(HandCategory.Flush);
      expect(f.villainCategory).toBe(HandCategory.FullHouse);
    }
    expect(r.splits).toHaveLength(0);
    expect(r.cardsLeft).toBe(44);
  });

  it('flop: Ah5h vs KsKd on Kh 9h 2c has 8 flush outs, 2h is a false out', () => {
    const r = computeOuts(parseCards('Ah 5h'), parseCards('Ks Kd'), parseCards('Kh 9h 2c'));
    expect(r.street).toBe('flop');
    expect(r.cardsLeft).toBe(45);
    expect(names(r.outs)).toEqual(sorted('3h 4h 6h 7h 8h Th Jh Qh'));
    expect(names(r.falseOuts)).toEqual(['2h']);
  });

  it('pairing a hole card is not a false out when it cannot beat the villain anyway', () => {
    // 5s gives hero a pair of fives: better than before, but still below the villain's current set.
    const r = computeOuts(parseCards('Ah 5h'), parseCards('Ks Kd'), parseCards('Kh 9h 2c 3d'));
    expect(names(r.falseOuts)).not.toContain('5s');
    expect(names(r.falseOuts)).not.toContain('As');
  });

  it('reports split cards separately and does not count them as outs', () => {
    const r = computeOuts(parseCards('Ac Qc'), parseCards('Ad Qd'), parseCards('Kh Js 2s'));
    expect(r.outs).toHaveLength(0);
    expect(r.falseOuts).toHaveLength(0);
    expect(r.splits).toHaveLength(45);
  });

  it('OESD vs overpair: 8s7s vs AdAc on 6h 5d 2c', () => {
    const r = computeOuts(parseCards('8s 7s'), parseCards('Ad Ac'), parseCards('6h 5d 2c'));
    // Any 4 or 9 makes a straight: 8 outs.
    expect(names(r.outs)).toEqual(sorted('4s 4h 4d 4c 9s 9h 9d 9c'));
  });

  it('rejects invalid input', () => {
    expect(() => computeOuts(parseCards('Ah 5h'), parseCards('Ks Kd'), parseCards('Kh 9h'))).toThrow();
    expect(() => computeOuts(parseCards('Ah 5h'), parseCards('Ks Kd'), parseCards('Kh 9h 2c 3d 4d'))).toThrow();
    expect(() => computeOuts(parseCards('Ah 5h'), parseCards('Ah Kd'), parseCards('Kh 9h 2c'))).toThrow();
  });
});

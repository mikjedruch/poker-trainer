import { describe, expect, it } from 'vitest';
import { parseCards } from '../cards';
import type { Combo } from '../range';
import type { HandCat } from './categories';
import { describeHand, handCategory, isTopPairPlus } from './categories';

const combo = (text: string): Combo => {
  const [a, b] = parseCards(text) as [number, number];
  return a > b ? [a, b] : [b, a];
};
const cat = (hand: string, flop: string): HandCat => handCategory(combo(hand), parseCards(flop));

describe('hand categories on the flop', () => {
  it.each<[string, string, HandCat]>([
    // strong: sets, trips, two pair with both hole cards, straights, flushes, full houses
    ['7c 7s', 'Ks 7d 2c', 'strong'],
    ['Kd 7s', 'Ks 7d 2c', 'strong'],
    ['8h 4h', '7h 6h 5c', 'strong'],
    ['Ah 2h', '9h 8h 4h', 'strong'],
    ['As 8c', '8s 8d 3c', 'strong'],
    ['3s 3h', '8s 8d 3c', 'strong'],
    ['9s 9d', '8s 8h 8c', 'strong'],
    // top pair / overpair with a good kicker (T or better), overpairs always
    ['Ah Kd', 'Ks 7d 2c', 'tpGood'],
    ['Kh Td', 'Ks 7d 2c', 'tpGood'],
    ['Ah Ad', 'Ks 7d 2c', 'tpGood'],
    ['9s 9d', '8s 8d 3c', 'tpGood'],
    // top pair with a weak kicker
    ['Kh 9d', 'Ks 7d 2c', 'tpWeak'],
    ['Ah 5h', 'As Kd 9c', 'tpWeak'],
    // any other pair made with a hole card
    ['Qh Qd', 'Ks 7d 2c', 'weakPair'],
    ['As 7s', 'Ks 7d 2c', 'weakPair'],
    ['5s 5d', '8s 8d 3c', 'weakPair'],
    ['As 3h', '8s 8d 3c', 'weakPair'],
    ['Kd Qd', 'Ah Kh 5c', 'weakPair'],
    // draws: flush draw or 2+ ranks completing a straight, no pair with a hole card
    ['Ah Qd', '9h 8h 4h', 'draw'],
    ['9s 8s', '7h 6h 5c', 'strong'],
    ['Ts 9s', 'Qs Jd 4c', 'draw'],
    ['Qh Th', '7h 6h 5c', 'draw'],
    ['9c 7s', '8s 8d 6c', 'draw'],
    ['Ad Kc', 'Qs Jd 2c', 'nothing'],
    // nothing: gutshots, backdoors, overcards, board pair only
    ['Ad 4c', 'Ks 7d 2c', 'nothing'],
    ['Jd Tc', 'Ks 7d 2c', 'nothing'],
    ['Ad Kc', '8s 8d 3c', 'nothing'],
    ['Ad Kc', '8s 8h 8c', 'nothing'],
  ])('%s on %s → %s', (hand, flop, expected) => {
    expect(cat(hand, flop)).toBe(expected);
  });

  it('AK on QJ2 is a gutshot only (one rank, the ten, completes a straight)', () => {
    expect(cat('Ad Kc', 'Qs Jd 2c')).toBe('nothing');
    expect(cat('Ad Kc', 'Qs Jd Tc')).toBe('strong');
  });

  it('TP+ covers strong, top pair and overpairs', () => {
    expect(isTopPairPlus('strong')).toBe(true);
    expect(isTopPairPlus('tpGood')).toBe(true);
    expect(isTopPairPlus('tpWeak')).toBe(true);
    expect(isTopPairPlus('weakPair')).toBe(false);
    expect(isTopPairPlus('draw')).toBe(false);
  });

  it('explains the category in Polish', () => {
    expect(describeHand(combo('7c 7s'), parseCards('Ks 7d 2c')).reason).toMatch(/set/);
    expect(describeHand(combo('Kh 9d'), parseCards('Ks 7d 2c')).reason).toMatch(/kicker/);
    expect(describeHand(combo('Ah Qd'), parseCards('9h 8h 4h')).reason).toMatch(/flush draw/);
    expect(describeHand(combo('Ad 4c'), parseCards('Ks 7d 2c')).reason.length).toBeGreaterThan(0);
  });

  it('rejects hands that share a card with the flop', () => {
    expect(() => handCategory(combo('Ks Qd'), parseCards('Ks 7d 2c'))).toThrow();
  });
});

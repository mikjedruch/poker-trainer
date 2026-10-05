import { describe, expect, it } from 'vitest';
import { parseCards } from '../cards';
import type { Combo } from '../range';
import { handClassOf } from '../range';
import { createRng } from '../rng';
import type { Position } from '../table';
import { FAMILIES, RFI_SCENARIO, SCENARIO_IDS, STAKES, actionFor } from './data';
import type { Family } from './data';
import type { Situation } from './situation';
import {
  EXAMPLE_SITUATIONS,
  FAMILY_BASE,
  buildSpot,
  heroOutOfPosition,
  isolationSize,
  positionsBefore,
  randomSpot,
  scenarioOf,
  validateSituation,
  villainThreeBetSize,
} from './situation';
import { allSituations } from './testing';

const combo = (text: string): Combo => parseCards(text) as unknown as Combo;
const sit = (family: Family, hero: Position, extra: Partial<Situation> = {}): Situation => ({
  family,
  hero,
  limpers: [],
  opener: null,
  threeBettor: null,
  ...extra,
});
const ORDER: Position[] = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
const idx = (p: Position) => ORDER.indexOf(p);

describe('bet sizes', () => {
  it('isolates to $12 plus $4 per extra limper, +$3 from the blinds', () => {
    expect([1, 2, 3].map((n) => isolationSize('BTN', n))).toEqual([12, 16, 20]);
    expect([1, 2, 3].map((n) => isolationSize('SB', n))).toEqual([15, 19, 23]);
    expect([1, 2, 3].map((n) => isolationSize('BB', n))).toEqual([15, 19, 23]);
  });

  it('labels the buttons with the amounts from the specification', () => {
    const labels = (s: Situation) => buildSpot(s, combo('As9s')).options.map((o) => o.label);
    expect(labels(sit('rfi', 'CO'))).toEqual(['Fold', 'Raise do $8']);
    expect(labels(sit('rfi', 'SB'))).toEqual(['Fold', 'Raise do $10']);
    expect(labels(sit('limpers', 'CO', { limpers: ['UTG', 'HJ'] }))).toEqual(['Fold', 'Limp $2', 'Raise do $16']);
    expect(labels(sit('limpers', 'SB', { limpers: ['CO'] }))).toEqual(['Fold', 'Dopłać do $2', 'Raise do $15']);
    expect(labels(sit('limpers', 'BB', { limpers: ['HJ', 'CO', 'SB'] }))).toEqual(['Check', 'Raise do $23']);
    expect(labels(sit('vsOpen', 'BTN', { opener: 'UTG' }))).toEqual(['Fold', 'Call $7', '3bet do $25']);
    expect(labels(sit('vsOpen', 'BB', { opener: 'BTN' }))).toEqual(['Fold', 'Call $7', '3bet do $30']);
    expect(labels(sit('vs3bet', 'CO', { threeBettor: 'BTN' }))).toEqual(['Fold', 'Call $25', '4bet do $65']);
    expect(labels(sit('vs3bet', 'CO', { threeBettor: 'BB' }))).toEqual(['Fold', 'Call $30', '4bet do $65']);
  });
});

describe('scenario mapping', () => {
  it('maps every possible situation to the right scenario', () => {
    expect(scenarioOf(sit('limpers', 'HJ', { limpers: ['UTG'] }))).toBe('LIMP1_IP');
    expect(scenarioOf(sit('limpers', 'BTN', { limpers: ['UTG', 'CO'] }))).toBe('LIMP2_IP');
    expect(scenarioOf(sit('limpers', 'SB', { limpers: ['UTG'] }))).toBe('LIMP_SB');
    expect(scenarioOf(sit('limpers', 'BB', { limpers: ['SB'] }))).toBe('LIMP_BB');
    expect(scenarioOf(sit('vsOpen', 'HJ', { opener: 'UTG' }))).toBe('VS_EARLY_IP');
    expect(scenarioOf(sit('vsOpen', 'BTN', { opener: 'HJ' }))).toBe('VS_EARLY_IP');
    expect(scenarioOf(sit('vsOpen', 'BTN', { opener: 'CO' }))).toBe('VS_LATE_BTN');
    expect(scenarioOf(sit('vsOpen', 'SB', { opener: 'UTG' }))).toBe('VS_OPEN_SB');
    expect(scenarioOf(sit('vsOpen', 'BB', { opener: 'HJ' }))).toBe('BB_VS_EARLY');
    expect(scenarioOf(sit('vsOpen', 'BB', { opener: 'SB' }))).toBe('BB_VS_LATE');
    expect(scenarioOf(sit('vs3bet', 'UTG', { threeBettor: 'BB' }))).toBe('VS3B_IP');
    expect(scenarioOf(sit('vs3bet', 'UTG', { threeBettor: 'CO' }))).toBe('VS3B_OOP');
    // SB open, BB 3bet: the BB has position after the flop.
    expect(scenarioOf(sit('vs3bet', 'SB', { threeBettor: 'BB' }))).toBe('VS3B_OOP');
  });

  it('every one of the 85 possible situations is valid and every scenario is reachable', () => {
    const all = allSituations();
    expect(all).toHaveLength(85);
    const seen = new Set(all.map((s) => (validateSituation(s), scenarioOf(s))));
    expect([...seen].sort()).toEqual([...SCENARIO_IDS].sort());
  });

  it('rejects impossible situations', () => {
    expect(() => validateSituation(sit('limpers', 'HJ', { limpers: ['UTG', 'CO'] }))).toThrow();
    expect(() => validateSituation(sit('vsOpen', 'CO', { opener: 'BTN' }))).toThrow();
    expect(() => validateSituation(sit('vs3bet', 'BTN', { threeBettor: 'CO' }))).toThrow();
    expect(() => validateSituation(sit('rfi', 'BB'))).toThrow();
    expect(() => validateSituation(sit('vsOpen', 'BTN', { opener: 'UTG', limpers: ['UTG'] }))).toThrow();
  });

  it('example situations used by the range browser match their scenarios', () => {
    for (const id of SCENARIO_IDS) expect(scenarioOf(EXAMPLE_SITUATIONS[id])).toBe(id);
  });
});

describe('table and history', () => {
  it('two limpers before the hero on CO (the specification example)', () => {
    const spot = buildSpot(sit('limpers', 'CO', { limpers: ['UTG', 'HJ'] }), combo('As9s'));
    expect(spot.history.map((h) => [h.position, h.kind, h.amount])).toEqual([
      ['UTG', 'limp', 2],
      ['HJ', 'limp', 2],
    ]);
    expect(spot.seats.map((s) => s.bet)).toEqual([2, 2, 0, 0, 1, 2]);
    expect(spot.pot).toBe(7);
    expect(spot.correct).toBe(actionFor('LIMP2_IP', 'A9s'));
  });

  it('a 3bet after the hero open: everybody else folds, blinds stay in the pot', () => {
    const spot = buildSpot(sit('vs3bet', 'CO', { threeBettor: 'BTN' }), combo('QhQd'));
    expect(spot.history.map((h) => `${h.position} ${h.kind}`)).toEqual([
      'UTG fold',
      'HJ fold',
      'CO open',
      'BTN threeBet',
      'SB fold',
      'BB fold',
    ]);
    expect(spot.seats.find((s) => s.position === 'CO')!.bet).toBe(8);
    expect(spot.seats.find((s) => s.position === 'BTN')!.bet).toBe(25);
    expect(spot.pot).toBe(8 + 25 + 1 + 2);
  });

  it('hero position after the flop', () => {
    expect(heroOutOfPosition(sit('vsOpen', 'BTN', { opener: 'CO' }))).toBe(false);
    expect(heroOutOfPosition(sit('vsOpen', 'BB', { opener: 'SB' }))).toBe(false);
    expect(heroOutOfPosition(sit('vsOpen', 'SB', { opener: 'BTN' }))).toBe(true);
    expect(heroOutOfPosition(sit('vs3bet', 'HJ', { threeBettor: 'CO' }))).toBe(true);
    expect(heroOutOfPosition(sit('vs3bet', 'HJ', { threeBettor: 'SB' }))).toBe(false);
    expect(heroOutOfPosition(sit('limpers', 'BTN', { limpers: ['UTG'] }))).toBe(false);
    expect(heroOutOfPosition(sit('limpers', 'SB', { limpers: ['UTG'] }))).toBe(true);
  });
});

describe('random drill spots (10 000 draws)', () => {
  const rng = createRng(20261005);
  const spots = Array.from({ length: 10_000 }, () => randomSpot(rng));

  it('are always consistent', () => {
    for (const spot of spots) {
      const s = spot.situation;
      validateSituation(s);
      const before = positionsBefore(s.hero);

      // Positions and limpers
      if (s.family === 'limpers') {
        expect(s.limpers.length).toBeGreaterThanOrEqual(1);
        expect(s.limpers.length).toBeLessThanOrEqual(3);
        expect(s.limpers.length).toBeLessThanOrEqual(before.length); // HJ: at most one limper
        expect(new Set(s.limpers).size).toBe(s.limpers.length);
        for (const p of s.limpers) expect(idx(p)).toBeLessThan(idx(s.hero));
      }
      if (s.opener) expect(idx(s.opener)).toBeLessThan(idx(s.hero));
      if (s.threeBettor) expect(idx(s.threeBettor)).toBeGreaterThan(idx(s.hero));

      // Hand: two different real cards; after hero's own open only hands from that open range
      expect(spot.hand[0]).not.toBe(spot.hand[1]);
      expect(handClassOf(spot.hand)).toBe(spot.handClass);
      if (s.family === 'vs3bet') expect(actionFor(RFI_SCENARIO[s.hero]!, spot.handClass)).toBe('raise');

      // Amounts: blinds posted, nobody bets more than the stack, pot is the sum of the chips
      const seat = (p: Position) => spot.seats.find((x) => x.position === p)!;
      expect(seat('SB').bet).toBeGreaterThanOrEqual(STAKES.smallBlind);
      expect(seat('BB').bet).toBeGreaterThanOrEqual(STAKES.bigBlind);
      expect(spot.pot).toBe(spot.seats.reduce((a, x) => a + x.bet, 0));
      for (const x of spot.seats) expect(x.bet).toBeLessThanOrEqual(STAKES.stack);
      for (const o of spot.options) if (o.total !== null) expect(o.total).toBeLessThanOrEqual(STAKES.stack);
      for (const o of spot.options) if (o.total !== null) expect(o.total).toBeGreaterThan(seat(s.hero).bet);
      if (s.family === 'limpers') {
        for (const p of s.limpers) expect(seat(p).bet).toBe(STAKES.bigBlind);
        expect(spot.options.find((o) => o.action === 'raise')!.total).toBe(isolationSize(s.hero, s.limpers.length));
      }
      if (s.threeBettor) expect(seat(s.threeBettor).bet).toBe(villainThreeBetSize(s.threeBettor));

      // The answer the UI checks against is the one from the data, and it is one of the buttons
      expect(spot.correct).toBe(actionFor(spot.scenario, spot.handClass));
      expect(spot.options.map((o) => o.action)).toContain(spot.correct);
      expect(new Set(spot.options.map((o) => o.action)).size).toBe(spot.options.length);
    }
  });

  it('follow the family mix (30/30/25/15) and limper counts (50/35/15)', () => {
    const share = (pred: (f: Family) => boolean) => spots.filter((s) => pred(s.situation.family)).length / spots.length;
    for (const f of FAMILIES) expect(Math.abs(share((x) => x === f) - FAMILY_BASE[f])).toBeLessThan(0.02);
    const limp = spots.filter((s) => s.situation.family === 'limpers');
    const byCount = [1, 2, 3].map((n) => limp.filter((s) => s.situation.limpers.length === n).length / limp.length);
    expect(Math.abs(byCount[0]! - 0.5)).toBeLessThan(0.03);
    expect(Math.abs(byCount[1]! - 0.35)).toBeLessThan(0.03);
    expect(Math.abs(byCount[2]! - 0.15)).toBeLessThan(0.03);
  });

  it('error weighting shifts the mix towards weak families and positions', () => {
    const r = createRng(7);
    const weighted = Array.from({ length: 4000 }, () =>
      randomSpot(r, { family: { rfi: 0.1, limpers: 0.1, vsOpen: 0.1, vs3bet: 1 }, position: { UTG: 1, HJ: 0.1, CO: 0.1, BTN: 0.1, SB: 0.1 } }),
    );
    const vs3 = weighted.filter((s) => s.situation.family === 'vs3bet');
    expect(vs3.length / weighted.length).toBeGreaterThan(0.5);
    expect(vs3.filter((s) => s.situation.hero === 'UTG').length / vs3.length).toBeGreaterThan(0.5);
  });

  it('can be limited to one family', () => {
    const r = createRng(3);
    for (let i = 0; i < 200; i++) expect(randomSpot(r, {}, 'vsOpen').situation.family).toBe('vsOpen');
  });
});

import { describe, expect, it } from 'vitest';
import { classCombos } from '../range';
import { ALL_CLASSES, reachable } from './data';
import { POSITION_SENTENCE, SET_ON_FLOP, explainSpot, handCategory, stackRatio } from './explain';
import type { PreflopSpot } from './situation';
import { buildSpot, heroOutOfPosition, scenarioOf } from './situation';
import { allSituations } from './testing';

// Every situation the drill can produce × every hand the hero can hold there.
const SPOTS: PreflopSpot[] = allSituations().flatMap((s) =>
  ALL_CLASSES.filter((cls) => reachable(scenarioOf(s), s.hero, cls)).map((cls) => buildSpot(s, classCombos(cls)[0]!)),
);

describe('hand categories', () => {
  it('follows the specification groups', () => {
    expect(['AA', 'JJ', 'AKs', 'AKo'].map(handCategory)).toEqual(['premium', 'premium', 'premium', 'premium']);
    expect(['77', 'TT'].map(handCategory)).toEqual(['mediumPair', 'mediumPair']);
    expect(['22', '66'].map(handCategory)).toEqual(['smallPair', 'smallPair']);
    expect(['A2s', 'A5s'].map(handCategory)).toEqual(['suitedWheelAce', 'suitedWheelAce']);
    expect(['76s', '86s', 'T9s', 'J9s', '43s'].map(handCategory)).toEqual(Array(5).fill('suitedConnector'));
    expect(['KJo', 'QJo', 'ATo', 'AQo'].map(handCategory)).toEqual(Array(4).fill('offsuitBroadway'));
    expect(['72o', 'A9o', 'K9o', '98o'].map(handCategory)).toEqual(Array(4).fill('weakOffsuit'));
    expect(['A9s', 'KQs', 'K5s'].map(handCategory)).toEqual(['suitedAce', 'suitedBroadway', 'suitedOther']);
  });
});

describe('preflop explanations', () => {
  it(`exist for all ${SPOTS.length} situation × hand pairs and name the correct button`, () => {
    expect(SPOTS.length).toBeGreaterThan(10_000);
    for (const spot of SPOTS) {
      const e = explainSpot(spot);
      expect(e.answer).toBe(spot.options.find((o) => o.action === spot.correct)!.label);
      expect(e.paragraphs.length).toBeGreaterThanOrEqual(2);
      expect(e.paragraphs.every((p) => p.length > 20)).toBe(true);
      expect(e.paragraphs[0]).toContain(spot.handClass);
    }
  });

  it('never contradicts the correct action', () => {
    for (const spot of SPOTS) {
      const text = explainSpot(spot).paragraphs.join(' ');
      const where = `${spot.scenario} ${spot.handClass} → ${spot.correct}`;
      if (text.includes('Ręka na value — podbijasz')) expect(spot.correct, where).toBe('raise');
      if (text.includes('Za mocne, żeby tylko limpować'))
        expect(spot.correct === 'check' || (spot.situation.family === 'limpers' && spot.correct === 'call'), where).toBe(false);
      if (text.includes('żeby płacić za wejście')) expect(['fold', 'check'], where).toContain(spot.correct);
      if (/— fold\.( |$)/.test(explainSpot(spot).paragraphs[0]!)) expect(spot.correct, where).toBe('fold');
      if (text.includes(' — check.')) expect(spot.correct, where).toBe('check');
    }
  });

  it('ends with the position sentence exactly when the hero is out of position after the flop', () => {
    for (const spot of SPOTS) {
      const p = explainSpot(spot).paragraphs;
      expect(p[p.length - 1] === POSITION_SENTENCE).toBe(heroOutOfPosition(spot.situation));
    }
  });

  it('computes the set-mining numbers', () => {
    expect(SET_ON_FLOP).toBeCloseTo(0.11755, 5);
    expect(stackRatio(25)).toEqual({ behind: 175, ratio: 7 });
    const small = SPOTS.find((s) => s.scenario === 'VS3B_OOP' && s.handClass === '66' && s.situation.threeBettor === 'BTN')!;
    const text = explainSpot(small).paragraphs.join(' ');
    expect(text).toContain('11.8%');
    expect(text).toContain('1 na 8.5');
    expect(text).toContain('Przeciw 3betowi $25 przy $175 za plecami (7×) — fold.');
    const vsBlinds = SPOTS.find((s) => s.scenario === 'VS3B_IP' && s.handClass === '66')!;
    expect(explainSpot(vsBlinds).paragraphs.join(' ')).toContain('Przeciw 3betowi $30 przy $170 za plecami (5.7×) — fold.');
  });

  it('shows the price of a light call from the big blind', () => {
    const spot = SPOTS.find((s) => s.scenario === 'BB_VS_LATE' && s.handClass === '98o' && s.situation.opener === 'BTN')!;
    expect(spot.correct).toBe('call');
    // $7 open, $1 dead small blind, $2 big blind already in: call $5 into $10 → 5 / 15.
    expect(explainSpot(spot).paragraphs.join(' ')).toContain('dopłacasz $5 do puli $10, więc wystarczy 33.3% equity');
  });

  it('shows how the isolation size is built', () => {
    const spot = SPOTS.find((s) => s.scenario === 'LIMP_BB' && s.handClass === 'AA' && s.situation.limpers.length === 3)!;
    expect(explainSpot(spot).paragraphs[0]).toContain('raise do $12 + 2 × $4 + $3 z blindów = $23');
  });
});

import { describe, expect, it } from 'vitest';
import rawLibrary from '../../data/flop-library.json';
import { assertDistinct, parseCards } from '../cards';
import { createRng } from '../rng';
import { analyzeHeadsUp } from './analysis';
import { permuteSuits, randomSuitPermutation } from './canonical';
import { handCategory } from './categories';
import { indexLibrary, libraryAnalysis, libraryFlops, validateLibrary } from './library';
import { builtInProfile } from './profiles';
import {
  buildHandSpot,
  explainHand,
  explainStrategy,
  explainTexture,
  gradeHand,
  gradeStrategy,
  gradeTexture,
  handOptions,
  pickQuizHand,
  pickStrategyFlop,
  randomTextureFlop,
} from './quiz';
import { handDecision } from './rule';
import { HU_SCENARIOS, HU_SCENARIO_DEFS, headsUpSeats, multiwaySeats, openRange, randomMultiwaySeats } from './scenarios';
import { flopTexture } from './texture';
import { handClassOf } from '../range';

const index = indexLibrary(validateLibrary(rawLibrary));

describe('texture quiz', () => {
  it('grades each part separately; correct only if all three are right', () => {
    const flop = parseCards('7h 6h 5c');
    expect(gradeTexture(flop, { suits: 'twoTone', height: 'low', wet: true }).correct).toBe(true);
    const g = gradeTexture(flop, { suits: 'twoTone', height: 'middle', wet: true });
    expect(g).toMatchObject({ correct: false, suits: true, height: false, wet: true });
  });

  it('dry and wet flops both come up, cards never repeat', () => {
    const rng = createRng(1);
    let wet = 0;
    for (let i = 0; i < 2000; i++) {
      const flop = randomTextureFlop(rng);
      assertDistinct(flop);
      expect(flop).toHaveLength(3);
      if (flopTexture(flop).wet) wet++;
    }
    expect(wet).toBeGreaterThan(850);
    expect(wet).toBeLessThan(1150);
  });

  it('explains in Polish with the reasons', () => {
    expect(explainTexture(parseCards('Ks 7d 2c')).join(' ')).toMatch(/Suchy/);
    expect(explainTexture(parseCards('7h 6h 5c')).join(' ')).toMatch(/Mokry.*strit \(43, 84, 98\)/);
    expect(explainTexture(parseCards('8s 8d 3c')).join(' ')).toMatch(/sparowany/);
  });
});

describe('strategy quiz', () => {
  it('balanced pick covers every strategy present', () => {
    const rng = createRng(2);
    const candidates = [
      { strategy: 'check' as const, id: 1 },
      { strategy: 'check' as const, id: 2 },
      { strategy: 'check' as const, id: 3 },
      { strategy: 'small' as const, id: 4 },
    ];
    let small = 0;
    for (let i = 0; i < 2000; i++) if (pickStrategyFlop(rng, candidates).strategy === 'small') small++;
    expect(small).toBeGreaterThan(850);
    expect(small).toBeLessThan(1150);
  });

  it('library answer == core answer and grading agrees', () => {
    const rng = createRng(3);
    const flops = libraryFlops(index);
    for (let i = 0; i < 6; i++) {
      const scenario = HU_SCENARIOS[i % 5]!;
      const profile = builtInProfile(i % 2 ? 'loose-live' : 'baseline');
      const flop = permuteSuits(flops[Math.floor(rng() * flops.length)]!, randomSuitPermutation(rng));
      const fromLibrary = libraryAnalysis(index, scenario, profile, flop)!;
      const fresh = analyzeHeadsUp(scenario, profile, flop);
      expect(fromLibrary.strategy.strategy).toBe(fresh.strategy.strategy);
      expect(gradeStrategy(fromLibrary, fresh.strategy.strategy)).toBe(true);
      expect(explainStrategy(fromLibrary).length).toBeGreaterThan(1);
    }
  });

  it('the library offers every strategy for the quiz', () => {
    const seen = new Set<string>();
    for (const flop of libraryFlops(index))
      for (const s of HU_SCENARIOS)
        for (const id of ['baseline', 'loose-live']) seen.add(libraryAnalysis(index, s, builtInProfile(id), flop)!.strategy.strategy);
    expect(seen).toEqual(new Set(['check', 'small', 'large']));
  });
});

describe('hand quiz', () => {
  it('options with dollar amounts: HU check / 1/3 / 2/3, multiway check / 1/2', () => {
    expect(handOptions(17, false).map((o) => o.label)).toEqual(['Check', 'Bet $6 (1/3)', 'Bet $11 (2/3)']);
    expect(handOptions(25, true).map((o) => o.label)).toEqual(['Check', 'Bet $13 (1/2)']);
  });

  it('10 000 random spots: hand from the open range, no repeated cards, answer from the table', () => {
    const rng = createRng(4);
    const flops = libraryFlops(index);
    const categories = new Set<string>();
    for (let i = 0; i < 10_000; i++) {
      const multiway = i % 6 === 5;
      const scenario = HU_SCENARIOS[i % 5]!;
      const seats = multiway ? randomMultiwaySeats(rng) : headsUpSeats(scenario);
      const profile = builtInProfile(i % 2 ? 'loose-live' : 'baseline');
      const flop = permuteSuits(flops[Math.floor(rng() * flops.length)]!, randomSuitPermutation(rng));
      const analysis = multiway ? null : libraryAnalysis(index, scenario, profile, flop)!;
      const hand = pickQuizHand(rng, seats.hero, flop);
      assertDistinct([...hand, ...flop]);
      expect(openRange(seats.hero).has(handClassOf(hand))).toBe(true);

      const spot = buildHandSpot(seats, flop, hand, profile, analysis);
      categories.add(spot.description.category);
      const expected = handDecision(handCategory(hand, flop), multiway ? 'multiway' : analysis!.strategy.strategy, {
        callsTooMuch: profile.callsTooMuch,
        inPosition: seats.inPosition,
      });
      expect(spot.decision).toEqual(expected);
      expect(spot.options.map((o) => o.id)).toContain(spot.correct);
      expect(gradeHand(spot, spot.correct)).toBe(true);
      for (const o of spot.options) if (o.id !== spot.correct) expect(gradeHand(spot, o.id)).toBe(false);
      if (!multiway) expect(spot.seats.inPosition).toBe(HU_SCENARIO_DEFS[scenario].inPosition);
    }
    expect(categories).toEqual(new Set(['strong', 'tpGood', 'tpWeak', 'weakPair', 'draw', 'nothing']));
  });

  it('strong hand with a mostly-check strategy bets 2/3', () => {
    const flop = parseCards('7h 6h 5c');
    const analysis = analyzeHeadsUp('P1', builtInProfile('baseline'), flop);
    expect(analysis.strategy.strategy).toBe('check');
    const spot = buildHandSpot(headsUpSeats('P1'), flop, [parseCards('7s')[0]!, parseCards('7c')[0]!], builtInProfile('baseline'), analysis);
    expect(spot.description.category).toBe('strong');
    expect(spot.correct).toBe('twoThirds');
    expect(explainHand(spot).join(' ')).toMatch(/silne/);
  });

  it('multiway spots never need a range analysis', () => {
    const seats = multiwaySeats('CO', ['BTN', 'BB']);
    const flop = parseCards('Ks 7d 2c');
    const spot = buildHandSpot(seats, flop, [parseCards('Ah')[0]!, parseCards('Kd')[0]!], builtInProfile('loose-live'), null);
    expect(spot.column).toBe('multiway');
    expect(spot.correct).toBe('half');
    expect(() => buildHandSpot(headsUpSeats('P1'), flop, [parseCards('Ah')[0]!, parseCards('Kd')[0]!], builtInProfile('baseline'), null)).toThrow();
  });
});

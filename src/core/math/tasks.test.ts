import { describe, expect, it } from 'vitest';
import { assertDistinct, parseCards } from '../cards';
import type { DrawSpot } from '../draws';
import { classifyDraw } from '../draws';
import { equityExact } from '../equity';
import { handValue } from '../evaluator';
import { computeOuts } from '../outs';
import { createRng } from '../rng';
import type { BetSpot } from './betting';
import { STARTING_STACK, stackBehind } from './betting';
import {
  bluffBreakEven,
  callEv,
  impliedOddsNeeded,
  minimumDefenseFrequency,
  requiredEquity,
} from './formulas';
import type { Task, TaskType } from './tasks';
import { TASK_TYPES, buildTask, checkAnswer, generateTask } from './tasks';

const spot = (pot: number, bet: number): BetSpot => ({
  pot,
  bet,
  stack: stackBehind(pot),
  fraction: null,
  allIn: bet === stackBehind(pot),
});

const hand = (hero: string, villain: string, board: string): DrawSpot => {
  const b = parseCards(board);
  const h = parseCards(hero);
  return {
    hero: h,
    villain: parseCards(villain),
    board: b,
    street: b.length === 3 ? 'flop' : 'turn',
    category: classifyDraw(h, b) ?? 'flushDraw',
  };
};

const allText = (t: Task) => t.explanation.map((b) => ('text' in b ? b.text : b.label)).join('\n');
const num = (value: number) => ({ kind: 'number', value }) as const;

describe('task 1: outs', () => {
  it('counts exact outs and lists groups and false outs', () => {
    const t = buildTask('outs', { hand: hand('Ah 5h', 'Ks Kd', 'Kh 9h 2c 3d') });
    expect(t.answer).toEqual({ kind: 'count', value: 10 });
    expect(checkAnswer(t, num(10)).correct).toBe(true);
    expect(checkAnswer(t, num(9)).correct).toBe(false);
    expect(checkAnswer(t, num(12)).correct).toBe(false);
    const text = allText(t);
    expect(text).toContain('kolor');
    expect(text).toContain('strit');
    expect(text).toContain('Fałszywe outy');
    expect(text).toContain('full');
  });
});

describe('task 2: equity estimate', () => {
  it('turn: exact 22.7%, rule of 2 gives 20%', () => {
    const t = buildTask('equity', { hand: hand('Ah 5h', 'Ks Kd', 'Kh 9h 2c 3d') });
    expect(t.answer.kind).toBe('percent');
    if (t.answer.kind !== 'percent') throw new Error();
    expect(t.answer.value).toBeCloseTo((10 / 44) * 100, 9);
    expect(t.answer.tolerance).toBe(5);
    expect(checkAnswer(t, num(27.7)).correct).toBe(true);
    expect(checkAnswer(t, num(17.8)).correct).toBe(true);
    expect(checkAnswer(t, num(28)).correct).toBe(false);
    expect(allText(t)).toContain('10 × 2 = 20%');
    expect(allText(t)).toContain('22.7%');
  });

  it('flop: rule of 4 overestimates by more than 5 pp and the explanation says why', () => {
    const t = buildTask('equity', { hand: hand('Ah 5h', 'Ks Kd', 'Kh 9h 2c') });
    const exact = equityExact(parseCards('Ah 5h'), parseCards('Ks Kd'), parseCards('Kh 9h 2c')).equity * 100;
    if (t.answer.kind !== 'percent') throw new Error();
    expect(t.answer.value).toBeCloseTo(exact, 9);
    const text = allText(t);
    expect(text).toContain('8 × 4 = 32%');
    expect(text).toContain('fałszywe outy');
  });
});

describe('task 3: required equity', () => {
  it('X / (P + 2X) with substituted numbers', () => {
    const t = buildTask('potOdds', { spot: spot(65, 40) });
    if (t.answer.kind !== 'percent') throw new Error();
    expect(t.answer.value).toBeCloseTo((40 / 145) * 100, 9);
    expect(t.answer.tolerance).toBe(2);
    expect(allText(t)).toContain('40 / (65 + 80) = 27.6%');
    expect(checkAnswer(t, num(29.5)).correct).toBe(true);
    expect(checkAnswer(t, num(25.6)).correct).toBe(true);
    expect(checkAnswer(t, num(30)).correct).toBe(false);
    expect(checkAnswer(t, num(25)).correct).toBe(false);
  });

  it('accepts the answer written with a comma', () => {
    const t = buildTask('potOdds', { spot: spot(65, 40) });
    expect(checkAnswer(t, num(Number('27,6'.replace(',', '.')))).correct).toBe(true);
  });
});

describe('task 4: call or fold', () => {
  it('turn: 10 outs of 44 facing $40 into $65 is a fold (EV −$7.05)', () => {
    const t = buildTask('callFold', { hand: hand('Ah 5h', 'Ks Kd', 'Kh 9h 2c 3d'), spot: spot(65, 40) });
    if (t.answer.kind !== 'decision') throw new Error();
    expect(t.answer.value).toBe('fold');
    expect(t.answer.ev).toBeCloseTo((10 / 44) * 145 - 40, 9);
    expect(checkAnswer(t, { kind: 'fold' }).correct).toBe(true);
    expect(checkAnswer(t, { kind: 'call' }).correct).toBe(false);
    expect(allText(t)).toContain('−$7.05');
  });

  it('turn: same draw facing $10 into $65 is a call', () => {
    const t = buildTask('callFold', { hand: hand('Ah 5h', 'Ks Kd', 'Kh 9h 2c 3d'), spot: spot(65, 10) });
    if (t.answer.kind !== 'decision') throw new Error();
    expect(t.answer.value).toBe('call');
    expect(checkAnswer(t, { kind: 'call' }).correct).toBe(true);
  });

  it('flop all-in uses equity to the river', () => {
    const pot = 120;
    const bet = stackBehind(pot);
    const t = buildTask('callFold', { hand: hand('9h 8h', 'Ac Ad', '7h 6d 2h'), spot: spot(pot, bet) });
    const e = equityExact(parseCards('9h 8h'), parseCards('Ac Ad'), parseCards('7h 6d 2h')).equity;
    if (t.answer.kind !== 'decision') throw new Error();
    expect(t.answer.ev).toBeCloseTo(callEv(e, pot, bet), 9);
  });

  it('refuses a flop spot that is not all-in', () => {
    expect(() => buildTask('callFold', { hand: hand('Ah 5h', 'Ks Kd', 'Kh 9h 2c'), spot: spot(65, 40) })).toThrow();
  });
});

describe('task 5: MDF', () => {
  it('P / (P + X)', () => {
    const t = buildTask('mdf', { spot: spot(65, 40) });
    if (t.answer.kind !== 'percent') throw new Error();
    expect(t.answer.value).toBeCloseTo((65 / 105) * 100, 9);
    expect(allText(t)).toContain('65 / (65 + 40) = 61.9%');
  });
});

describe('task 6: bluff break-even', () => {
  it('X / (P + X)', () => {
    const t = buildTask('bluff', { spot: spot(65, 40) });
    if (t.answer.kind !== 'percent') throw new Error();
    expect(t.answer.value).toBeCloseTo((40 / 105) * 100, 9);
    expect(allText(t)).toContain('40 / (65 + 40) = 38.1%');
  });
});

describe('task 7: implied odds', () => {
  it('10 outs of 44, $40 into $65: need $31 more on the river', () => {
    const t = buildTask('implied', { hand: hand('Ah 5h', 'Ks Kd', 'Kh 9h 2c 3d'), spot: spot(65, 40) });
    if (t.answer.kind !== 'dollars') throw new Error();
    expect(t.answer.value).toBeCloseTo(31, 9);
    expect(t.answer.impossible).toBe(false);
    expect(t.answer.limit).toBe(stackBehind(65) - 40);
    expect(checkAnswer(t, num(31)).correct).toBe(true);
    expect(checkAnswer(t, num(26)).correct).toBe(true);
    expect(checkAnswer(t, num(37)).correct).toBe(false);
    expect(checkAnswer(t, { kind: 'impossible' }).correct).toBe(false);
  });

  it('gutshot vs big bet with little behind: impossible', () => {
    const t = buildTask('implied', { hand: hand('9s 8s', 'Jc Jd', 'Jh 7d 2c 3h'), spot: spot(100, 75) });
    if (t.answer.kind !== 'dollars') throw new Error();
    expect(t.answer.value).toBeCloseTo(575, 9);
    expect(t.answer.limit).toBe(75);
    expect(t.answer.impossible).toBe(true);
    expect(checkAnswer(t, { kind: 'impossible' }).correct).toBe(true);
    expect(checkAnswer(t, num(575)).correct).toBe(false);
    expect(allText(t)).toContain('nie da się');
  });

  it('already +EV call: the answer is $0', () => {
    const t = buildTask('implied', { hand: hand('Ah 5h', 'Ks Kd', 'Kh 9h 2c 3d'), spot: spot(65, 10) });
    if (t.answer.kind !== 'dollars') throw new Error();
    expect(t.answer.value).toBe(0);
    expect(checkAnswer(t, num(0)).correct).toBe(true);
  });

  it('refuses flop spots', () => {
    expect(() => buildTask('implied', { hand: hand('Ah 5h', 'Ks Kd', 'Kh 9h 2c'), spot: spot(65, 40) })).toThrow();
  });
});

/** Recomputes the expected answer from core primitives, independently of tasks.ts. */
function expectedValue(t: Task): number | string {
  const s = t.spot;
  const h = t.hand;
  switch (t.type) {
    case 'outs':
      return computeOuts(h!.hero, h!.villain, h!.board).outs.length;
    case 'equity':
      return equityExact(h!.hero, h!.villain, h!.board).equity * 100;
    case 'potOdds':
      return requiredEquity(s!.pot, s!.bet) * 100;
    case 'mdf':
      return minimumDefenseFrequency(s!.pot, s!.bet) * 100;
    case 'bluff':
      return bluffBreakEven(s!.pot, s!.bet) * 100;
    case 'callFold': {
      const ev = callEv(equityExact(h!.hero, h!.villain, h!.board).equity, s!.pot, s!.bet);
      return Math.abs(ev) < 1e-9 ? 'either' : ev > 0 ? 'call' : 'fold';
    }
    case 'implied':
      return impliedOddsNeeded(equityExact(h!.hero, h!.villain, h!.board).equity, s!.pot, s!.bet);
  }
}

function checkSpotInvariants(t: Task) {
  const s = t.spot;
  if (s) {
    expect(s.pot).toBeGreaterThanOrEqual(15);
    expect(s.pot).toBeLessThanOrEqual(300);
    expect(s.stack).toBeLessThanOrEqual(STARTING_STACK - s.pot / 2 + 0.5);
    expect(s.bet).toBeGreaterThan(0);
    expect(s.bet).toBeLessThanOrEqual(s.stack);
  }
  const h = t.hand;
  if (h) {
    assertDistinct([...h.hero, ...h.villain, ...h.board]);
    expect(classifyDraw(h.hero, h.board)).toBe(h.category);
    expect(handValue([...h.villain, ...h.board])).toBeGreaterThan(handValue([...h.hero, ...h.board]));
  }
}

const needsHand: Record<TaskType, boolean> = {
  outs: true,
  equity: true,
  potOdds: false,
  callFold: true,
  mdf: false,
  bluff: false,
  implied: true,
};

describe('generator consistency for all 7 task types', () => {
  for (const type of TASK_TYPES) {
    it(`${type}: valid data and UI answer == core answer`, () => {
      const seeds = needsHand[type] ? 60 : 500;
      for (let seed = 1; seed <= seeds; seed++) {
        const t = generateTask(type, createRng(seed * 104729 + type.length));
        expect(t.type).toBe(type);
        expect(t.hand !== null).toBe(needsHand[type]);
        expect(t.question.length).toBeGreaterThan(0);
        expect(t.explanation.length).toBeGreaterThan(0);
        checkSpotInvariants(t);
        if (type === 'implied') {
          expect(t.hand!.street).toBe('turn');
          expect(t.spot!.allIn).toBe(false);
        }
        if (type === 'callFold' && t.hand!.street === 'flop') expect(t.spot!.allIn).toBe(true);

        const expected = expectedValue(t);
        const a = t.answer;
        switch (a.kind) {
          case 'count':
            expect(a.value).toBe(expected);
            expect(checkAnswer(t, num(a.value)).correct).toBe(true);
            expect(checkAnswer(t, num(a.value + 1)).correct).toBe(false);
            break;
          case 'percent':
            expect(a.value).toBeCloseTo(expected as number, 9);
            expect(checkAnswer(t, num(a.value)).correct).toBe(true);
            expect(checkAnswer(t, num(a.value + a.tolerance - 0.01)).correct).toBe(true);
            expect(checkAnswer(t, num(a.value - a.tolerance - 0.01)).correct).toBe(false);
            break;
          case 'decision':
            expect(a.value).toBe(expected);
            if (a.value !== 'either') {
              expect(checkAnswer(t, { kind: a.value }).correct).toBe(true);
              expect(checkAnswer(t, { kind: a.value === 'call' ? 'fold' : 'call' }).correct).toBe(false);
            }
            break;
          case 'dollars':
            expect(a.value).toBeCloseTo(expected as number, 9);
            expect(a.limit).toBe(t.spot!.stack - t.spot!.bet);
            expect(a.impossible).toBe(a.value > a.limit);
            if (a.value > a.limit + a.tolerance) {
              expect(checkAnswer(t, { kind: 'impossible' }).correct).toBe(true);
              expect(checkAnswer(t, num(a.value)).correct).toBe(false);
            } else if (a.value < a.limit - a.tolerance) {
              expect(checkAnswer(t, num(a.value)).correct).toBe(true);
              expect(checkAnswer(t, { kind: 'impossible' }).correct).toBe(false);
            }
            break;
        }
      }
    });
  }

  it('draw categories are spread roughly evenly', () => {
    const counts = new Map<string, number>();
    for (let seed = 1; seed <= 300; seed++) {
      const t = generateTask('outs', createRng(seed));
      counts.set(t.hand!.category, (counts.get(t.hand!.category) ?? 0) + 1);
    }
    expect(counts.size).toBe(6);
    for (const c of counts.values()) expect(c).toBeGreaterThan(25);
  });
});

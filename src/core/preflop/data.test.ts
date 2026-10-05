import { describe, expect, it } from 'vitest';
import { parseRange } from '../range';
import type { ScenarioId } from './data';
import { ALL_CLASSES, SCENARIO_IDS, SIZES, STAKES, actionFor, comboCount, scenarioRanges } from './data';

// Required combo counts (out of 1326) from the specification. A mismatch means a parser bug, not a data bug.
const EXPECTED: Record<ScenarioId, [number, number]> = {
  RFI_UTG: [158, 0],
  RFI_HJ: [220, 0],
  RFI_CO: [342, 0],
  RFI_BTN: [474, 0],
  RFI_SB: [310, 0],
  LIMP1_IP: [124, 122],
  LIMP2_IP: [82, 140],
  LIMP_SB: [76, 214],
  LIMP_BB: [50, 0],
  VS_EARLY_IP: [34, 108],
  VS_LATE_BTN: [56, 166],
  VS_OPEN_SB: [38, 92],
  BB_VS_EARLY: [34, 232],
  BB_VS_LATE: [56, 426],
  VS3B_IP: [16, 42],
  VS3B_OOP: [16, 28],
};

describe('preflop data', () => {
  it.each(SCENARIO_IDS)('%s has the required number of combos', (id) => {
    const s = scenarioRanges(id);
    const [raise, call] = EXPECTED[id];
    expect(parseRange(s.raiseText).length).toBe(raise);
    expect(parseRange(s.callText).length).toBe(call);
    expect(s.raiseCombos).toBe(raise);
    expect(s.callCombos).toBe(call);
  });

  it.each(SCENARIO_IDS)('%s: actions are disjoint and cover all 1326 combos exactly once', (id) => {
    const s = scenarioRanges(id);
    for (const cls of s.call) expect(s.raise.has(cls)).toBe(false);
    const byAction = { raise: 0, call: 0, fold: 0, check: 0 };
    for (const cls of ALL_CLASSES) byAction[actionFor(id, cls)] += comboCount(cls);
    expect(byAction.raise).toBe(EXPECTED[id][0]);
    expect(byAction.call).toBe(EXPECTED[id][1]);
    expect(byAction.raise + byAction.call + byAction.fold + byAction.check).toBe(1326);
  });

  it('only the big blind facing limpers checks; everything else not listed folds', () => {
    for (const id of SCENARIO_IDS) expect(scenarioRanges(id).rest).toBe(id === 'LIMP_BB' ? 'check' : 'fold');
    expect(actionFor('LIMP_BB', '72o')).toBe('check');
    expect(actionFor('LIMP_BB', 'AKo')).toBe('raise');
  });

  it('spot checks against the specification table', () => {
    expect(actionFor('RFI_UTG', 'A5s')).toBe('raise');
    expect(actionFor('RFI_UTG', 'A3s')).toBe('fold');
    expect(actionFor('RFI_UTG', '55')).toBe('fold');
    expect(actionFor('LIMP1_IP', '66')).toBe('call');
    expect(actionFor('LIMP1_IP', '77')).toBe('raise');
    expect(actionFor('VS_EARLY_IP', 'AKo')).toBe('raise');
    expect(actionFor('VS_EARLY_IP', 'AJo')).toBe('fold');
    expect(actionFor('BB_VS_LATE', '98o')).toBe('call');
    expect(actionFor('VS3B_OOP', 'TT')).toBe('fold');
    expect(actionFor('VS3B_IP', 'TT')).toBe('call');
  });

  it('stakes and sizes match the specification', () => {
    expect(STAKES).toEqual({ smallBlind: 1, bigBlind: 2, stack: 200 });
    expect(SIZES).toMatchObject({
      villainOpen: 7,
      open: 8,
      openFromSmallBlind: 10,
      isolateOneLimper: 12,
      isolatePerExtraLimper: 4,
      isolateFromBlindsExtra: 3,
      threeBetInPosition: 25,
      threeBetOutOfPosition: 30,
      fourBet: 65,
    });
  });
});

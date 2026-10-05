import { describe, expect, it } from 'vitest';
import { parseCards } from '../cards';
import { createRng } from '../rng';
import {
  HU_SCENARIOS,
  HU_SCENARIO_DEFS,
  betAmount,
  headsUpSeats,
  heroCombos,
  multiwaySeats,
  openRange,
  potOnFlop,
  randomMultiwaySeats,
} from './scenarios';

describe('postflop scenarios', () => {
  it('positions and ranges from the specification', () => {
    expect(HU_SCENARIO_DEFS.P1).toMatchObject({ hero: 'UTG', villain: 'BB', heroRfi: 'RFI_UTG', inPosition: true });
    expect(HU_SCENARIO_DEFS.P2).toMatchObject({ hero: 'CO', villain: 'BB', heroRfi: 'RFI_CO', inPosition: true });
    expect(HU_SCENARIO_DEFS.P3).toMatchObject({ hero: 'BTN', villain: 'BB', heroRfi: 'RFI_BTN', inPosition: true });
    expect(HU_SCENARIO_DEFS.P4).toMatchObject({ hero: 'UTG', villain: 'BTN', heroRfi: 'RFI_UTG', inPosition: false });
    expect(HU_SCENARIO_DEFS.P5).toMatchObject({ hero: 'CO', villain: 'BTN', heroRfi: 'RFI_CO', inPosition: false });
  });

  it('pot on the flop: $8 open called, plus dead blinds', () => {
    expect(headsUpSeats('P1').pot).toBe(17); // 8 + 8 (BB) + 1 (SB dead)
    expect(headsUpSeats('P3').pot).toBe(17);
    expect(headsUpSeats('P4').pot).toBe(19); // 8 + 8 + 1 + 2
    expect(potOnFlop('CO', ['BTN', 'BB'])).toBe(25);
    expect(potOnFlop('UTG', ['CO', 'BTN'])).toBe(27);
  });

  it('bet amounts in whole dollars', () => {
    expect(betAmount(17, 1 / 3)).toBe(6);
    expect(betAmount(17, 2 / 3)).toBe(11);
    expect(betAmount(19, 2 / 3)).toBe(13);
    expect(betAmount(25, 1 / 2)).toBe(13);
  });

  it('multiway: two different callers who act after the hero', () => {
    const rng = createRng(3);
    for (let i = 0; i < 2000; i++) {
      const s = randomMultiwaySeats(rng);
      expect(s.opponents).toHaveLength(2);
      expect(new Set(s.opponents).size).toBe(2);
      expect(s.opponents).not.toContain(s.hero);
      expect(s.pot).toBeGreaterThanOrEqual(24); // BTN open, SB and BB call: no dead money
      expect(s.pot).toBeLessThanOrEqual(27);
    }
    expect(() => multiwaySeats('BTN', ['CO', 'BB'])).toThrow();
    expect(() => multiwaySeats('BB', ['SB', 'UTG'])).toThrow();
    expect(multiwaySeats('BTN', ['BB', 'SB']).opponents).toEqual(['SB', 'BB']);
    expect(multiwaySeats('BTN', ['SB', 'BB']).inPosition).toBe(true);
    expect(multiwaySeats('UTG', ['BTN', 'BB']).inPosition).toBe(false);
  });

  it('hero combos come from the open range without flop cards', () => {
    expect(openRange('UTG').has('AJo')).toBe(true);
    const flop = parseCards('As Kd 2c');
    const combos = heroCombos('UTG', flop);
    expect(combos.length).toBeGreaterThan(0);
    for (const c of combos) for (const card of c) expect(flop).not.toContain(card);
    for (const id of HU_SCENARIOS) expect(heroCombos(HU_SCENARIO_DEFS[id].hero, []).length).toBeGreaterThan(100);
  });
});

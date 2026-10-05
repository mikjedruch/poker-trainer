import { describe, expect, it } from 'vitest';
import { parseCards } from '../../core/cards';
import { ALL_CLASSES, SCENARIO_IDS, actionCombos, actionFor, scenarioGrid } from '../../core/preflop/data';
import type { Family } from '../../core/preflop/data';
import { explainSpot } from '../../core/preflop/explain';
import type { Situation } from '../../core/preflop/situation';
import { buildSpot } from '../../core/preflop/situation';
import type { Combo } from '../../core/range';
import { gridLabel } from '../../core/range';
import { createRng } from '../../core/rng';
import type { Position } from '../../core/table';
import { DRILL_MODES, cellDetail, gradeAnswer, legendItems, newSpot, situationLine } from './drill';
import { emptyPreflopProgress, recordPreflop } from './progress';

const combo = (text: string): Combo => parseCards(text) as unknown as Combo;
const sit = (family: Family, hero: Position, extra: Partial<Situation> = {}): Situation => ({
  family,
  hero,
  limpers: [],
  opener: null,
  threeBettor: null,
  ...extra,
});

describe('drill: the answer the screen checks is the one from core', () => {
  it('for 5 000 spots in every mode, exactly the core action grades as correct', () => {
    const rng = createRng(42);
    let progress = emptyPreflopProgress();
    for (let i = 0; i < 5000; i++) {
      const mode = DRILL_MODES[i % DRILL_MODES.length]!;
      const spot = newSpot(mode, progress, rng);
      if (mode !== 'mixed') expect(spot.situation.family).toBe(mode);
      const coreAction = actionFor(spot.scenario, spot.handClass);
      const correct = spot.options.filter((o) => gradeAnswer(spot, o.action).correct);
      expect(correct.map((o) => o.action)).toEqual([coreAction]);
      expect(gradeAnswer(spot, spot.options[0]!.action).answer.label).toBe(explainSpot(spot).answer);
      // Drive the error weighting with a mix of results, as a real session would.
      progress = recordPreflop(progress, spot.situation.family, spot.situation.hero, i % 3 === 0);
    }
  });
});

describe('situation line', () => {
  it('reads like the specification example', () => {
    const spot = buildSpot(sit('limpers', 'CO', { limpers: ['UTG', 'HJ'] }), combo('As9s'));
    expect(situationLine(spot)).toBe('UTG limp $2, HJ limp $2 — Ty na CO');
  });

  it('groups folds and shows the hero open before a 3bet', () => {
    const spot = buildSpot(sit('vs3bet', 'CO', { threeBettor: 'BTN' }), combo('QhQd'));
    expect(situationLine(spot)).toBe('UTG i HJ fold, Ty raise do $8, BTN 3bet do $25, SB i BB fold — Ty na CO');
    const sb = buildSpot(sit('rfi', 'SB'), combo('7h6h'));
    expect(situationLine(sb)).toBe('UTG, HJ, CO i BTN fold — Ty na SB');
    const utg = buildSpot(sit('rfi', 'UTG'), combo('7h6h'));
    expect(situationLine(utg)).toBe('Jesteś pierwszy do akcji — Ty na UTG');
    const bb = buildSpot(sit('limpers', 'BB', { limpers: ['SB'] }), combo('7h6h'));
    expect(situationLine(bb)).toBe('UTG, HJ, CO i BTN fold, SB dopłata do $2 — Ty na BB');
  });
});

describe('range browser', () => {
  it.each(SCENARIO_IDS)('%s: legend counts add up to 1326 and match the data', (id) => {
    const items = legendItems(id);
    const counts = actionCombos(id);
    expect(items.reduce((a, it) => a + it.combos, 0)).toBe(1326);
    for (const it of items) expect(it.combos).toBe(counts[it.action]);
  });

  it.each(SCENARIO_IDS)('%s: every cell shows the action from the grid', (id) => {
    const grid = scenarioGrid(id);
    for (let r = 0; r < 13; r++)
      for (let c = 0; c < 13; c++) {
        const detail = cellDetail(id, gridLabel(r, c));
        expect(detail.action).toBe(grid[r]![c]);
        expect(detail.explanation.paragraphs.length).toBeGreaterThanOrEqual(2);
      }
  });

  it('marks hands the hero would not have opened in 3bet spots', () => {
    expect(cellDetail('VS3B_IP', '72o').reachable).toBe(false);
    expect(cellDetail('VS3B_IP', 'AKs').reachable).toBe(true);
    for (const cls of ALL_CLASSES) expect(cellDetail('RFI_UTG', cls).reachable).toBe(true);
  });

  it('names actions in the words of each scenario', () => {
    expect(legendItems('LIMP1_IP').map((i) => i.label)).toEqual(['Raise (izolacja)', 'Limp', 'Fold']);
    expect(legendItems('LIMP_SB').map((i) => i.label)).toEqual(['Raise (izolacja)', 'Dopłata', 'Fold']);
    expect(legendItems('LIMP_BB').map((i) => i.label)).toEqual(['Raise (izolacja)', 'Check']);
    expect(legendItems('BB_VS_LATE').map((i) => i.label)).toEqual(['3bet', 'Call', 'Fold']);
    expect(legendItems('VS3B_OOP').map((i) => i.label)).toEqual(['4bet', 'Call', 'Fold']);
    expect(legendItems('RFI_BTN').map((i) => i.label)).toEqual(['Raise', 'Fold']);
  });
});

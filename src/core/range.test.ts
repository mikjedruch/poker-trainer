import { describe, expect, it } from 'vitest';
import { formatCards, parseCards } from './cards';
import {
  classCombos,
  combosToGrid,
  gridCellOf,
  gridLabel,
  gridToCombos,
  handClassOf,
  parseRange,
  rangeCombos,
  classRange,
  classesToCombos,
  formatRange,
} from './range';

const classes = (text: string) => [...new Set(parseRange(text).map(handClassOf))].sort();

describe('range: parsing', () => {
  it('counts combos for single classes', () => {
    expect(parseRange('AA')).toHaveLength(6);
    expect(parseRange('AKs')).toHaveLength(4);
    expect(parseRange('KQo')).toHaveLength(12);
    expect(parseRange('AK')).toHaveLength(16);
  });

  it('expands pair plus: 77+', () => {
    expect(parseRange('77+')).toHaveLength(48);
    expect(classes('77+')).toEqual(['77', '88', '99', 'AA', 'JJ', 'KK', 'QQ', 'TT'].sort());
  });

  it('expands pair ranges in either order: 22-55', () => {
    expect(classes('22-55')).toEqual(['22', '33', '44', '55']);
    expect(classes('55-22')).toEqual(['22', '33', '44', '55']);
    expect(parseRange('22-55')).toHaveLength(24);
  });

  it('expands kicker plus: AJs+', () => {
    expect(classes('AJs+')).toEqual(['AJs', 'AKs', 'AQs']);
    expect(classes('K9o+')).toEqual(['K9o', 'KJo', 'KQo', 'KTo']);
    expect(parseRange('AT+')).toHaveLength(64);
  });

  it('expands kicker ranges: A2s-A5s', () => {
    expect(classes('A2s-A5s')).toEqual(['A2s', 'A3s', 'A4s', 'A5s']);
    expect(parseRange('A2s-A5s')).toHaveLength(16);
  });

  it('parses lists and removes duplicates', () => {
    expect(parseRange('AA, KK AKs')).toHaveLength(16);
    expect(parseRange('AA,AA,QQ+')).toHaveLength(18);
  });

  it('accepts exact combos', () => {
    const r = parseRange('AsKs, 7h7d');
    expect(r).toHaveLength(2);
    expect(r.map((c) => formatCards(c))).toContain('As Ks');
  });

  it('is case-insensitive and whitespace-tolerant', () => {
    expect(parseRange(' aks ,  qq+ ')).toHaveLength(4 + 18);
  });

  it('rejects invalid tokens', () => {
    for (const bad of ['AX', 'AAs', 'A', 'AKx', 'A2s-K5s', 'AA-KQ', 'AsAs', '22-A5s']) {
      expect(() => parseRange(bad), bad).toThrow();
    }
  });
});

describe('range: dead cards', () => {
  it('removes combos that use dead cards', () => {
    expect(rangeCombos('AK', parseCards('As'))).toHaveLength(12);
    expect(rangeCombos('AA', parseCards('As'))).toHaveLength(3);
    expect(rangeCombos('AA', parseCards('As Ah'))).toHaveLength(1);
    expect(rangeCombos('77+', parseCards('Kh 9h 2c'))).toHaveLength(48 - 3 - 3);
  });
});

describe('range: 13x13 grid', () => {
  it('labels the grid: pairs on the diagonal, suited above, offsuit below', () => {
    expect(gridLabel(0, 0)).toBe('AA');
    expect(gridLabel(0, 1)).toBe('AKs');
    expect(gridLabel(1, 0)).toBe('AKo');
    expect(gridLabel(12, 12)).toBe('22');
    expect(gridLabel(11, 12)).toBe('32s');
    expect(gridCellOf('AKs')).toEqual([0, 1]);
    expect(gridCellOf('AKo')).toEqual([1, 0]);
    expect(gridCellOf('T9s')).toEqual([4, 5]);
  });

  it('covers all 1326 combos exactly once', () => {
    let total = 0;
    for (let r = 0; r < 13; r++) for (let c = 0; c < 13; c++) total += classCombos(gridLabel(r, c)).length;
    expect(total).toBe(1326);
  });

  it('converts combos to grid weights and back', () => {
    const combos = parseRange('QQ+, AKs, A5s');
    const grid = combosToGrid(combos);
    expect(grid[0]![0]).toBe(1);
    expect(grid[0]![1]).toBe(1);
    expect(grid[1]![0]).toBe(0);
    expect(grid[3]![3]).toBe(0);

    const selected = grid.map((row) => row.map((w) => w === 1));
    expect(gridToCombos(selected)).toHaveLength(combos.length);
  });

  it('shows partial weights when dead cards remove combos', () => {
    const grid = combosToGrid(rangeCombos('AA', parseCards('As')));
    expect(grid[0]![0]).toBeCloseTo(3 / 6, 12);
  });

  it('names the hand class of a combo', () => {
    expect(handClassOf(parseCards('Ks As') as [number, number])).toBe('AKs');
    expect(handClassOf(parseCards('Kd As') as [number, number])).toBe('AKo');
    expect(handClassOf(parseCards('7d 7c') as [number, number])).toBe('77');
  });
});

describe('range: whole classes and formatting', () => {
  it('splits whole and partial classes', () => {
    const r = classRange('AKs, QQ, AsKd, Th9h');
    expect([...r.classes].sort()).toEqual(['AKs', 'QQ']);
    expect(r.partial.sort()).toEqual(['AKo', 'T9s']);
  });

  it('formats ranges in the usual short notation', () => {
    expect(formatRange(classRange('QQ+').classes)).toBe('QQ+');
    expect(formatRange(classRange('AA').classes)).toBe('AA');
    expect(formatRange(classRange('22-JJ').classes)).toBe('22-JJ');
    expect(formatRange(classRange('77').classes)).toBe('77');
    expect(formatRange(classRange('AQs+').classes)).toBe('AQs+');
    expect(formatRange(classRange('AKs').classes)).toBe('AKs');
    expect(formatRange(classRange('A2s-A5s').classes)).toBe('A2s-A5s');
    expect(formatRange(classRange('KTo+, 54s, AK').classes)).toBe('AKs, 54s, AKo, KTo+');
    expect(formatRange([])).toBe('');
  });

  it('round-trips random sets of hand classes', () => {
    let seed = 7;
    const next = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let t = 0; t < 200; t++) {
      const chosen = new Set<string>();
      const density = next();
      for (let row = 0; row < 13; row++) for (let col = 0; col < 13; col++) if (next() < density) chosen.add(gridLabel(row, col));
      const text = formatRange(chosen);
      const back = classRange(text);
      expect(back.partial).toEqual([]);
      expect([...back.classes].sort()).toEqual([...chosen].sort());
    }
  });

  it('builds combos from classes without dead cards', () => {
    expect(classesToCombos(['AA', 'KQo'])).toHaveLength(18);
    expect(classesToCombos(['AA'], parseCards('As'))).toHaveLength(3);
  });
});

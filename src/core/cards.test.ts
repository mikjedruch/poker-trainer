import { describe, expect, it } from 'vitest';
import {
  FULL_DECK,
  formatCard,
  formatCards,
  makeCard,
  parseCard,
  parseCards,
  rankOf,
  remainingDeck,
  suitOf,
} from './cards';

describe('cards', () => {
  it('round-trips every card through parse and format', () => {
    for (const card of FULL_DECK) {
      expect(parseCard(formatCard(card))).toBe(card);
    }
  });

  it('has a 52-card deck without duplicates', () => {
    expect(FULL_DECK).toHaveLength(52);
    expect(new Set(FULL_DECK).size).toBe(52);
  });

  it('parses notation As, Td, 2c', () => {
    expect(rankOf(parseCard('As'))).toBe(12);
    expect(rankOf(parseCard('Td'))).toBe(8);
    expect(rankOf(parseCard('2c'))).toBe(0);
    expect(suitOf(parseCard('As'))).toBe(suitOf(parseCard('Ks')));
    expect(suitOf(parseCard('As'))).not.toBe(suitOf(parseCard('Ah')));
    expect(parseCard('As')).toBe(makeCard(12, suitOf(parseCard('2s'))));
  });

  it('accepts lowercase rank and uppercase suit', () => {
    expect(parseCard('td')).toBe(parseCard('Td'));
    expect(parseCard('AS')).toBe(parseCard('As'));
  });

  it('rejects invalid cards', () => {
    for (const bad of ['', 'A', 'Ax', '1s', '10s', 'Ass']) {
      expect(() => parseCard(bad)).toThrow();
    }
  });

  it('parses card lists with or without separators', () => {
    expect(formatCards(parseCards('Kh 9h 2c'))).toBe('Kh 9h 2c');
    expect(formatCards(parseCards('AsKd'))).toBe('As Kd');
    expect(formatCards(parseCards('As, Kd,Qc'))).toBe('As Kd Qc');
    expect(parseCards('')).toEqual([]);
  });

  it('rejects duplicate cards in a list', () => {
    expect(() => parseCards('As Kd As')).toThrow();
  });

  it('builds the remaining deck without used cards', () => {
    const used = parseCards('As Kd 2c');
    const rest = remainingDeck(used);
    expect(rest).toHaveLength(49);
    for (const card of used) expect(rest).not.toContain(card);
  });
});

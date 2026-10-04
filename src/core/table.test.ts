import { describe, expect, it } from 'vitest';
import { POSITIONS, seatsClockwiseFrom } from './table';

describe('table positions', () => {
  it('lists six positions in clockwise (action) order', () => {
    expect(POSITIONS).toEqual(['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB']);
  });

  it('rotates the table so the given seat comes first', () => {
    expect(seatsClockwiseFrom('UTG')).toEqual(['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB']);
    expect(seatsClockwiseFrom('CO')).toEqual(['CO', 'BTN', 'SB', 'BB', 'UTG', 'HJ']);
    expect(seatsClockwiseFrom('BB')).toEqual(['BB', 'UTG', 'HJ', 'CO', 'BTN', 'SB']);
  });

  it('puts the button directly before the small blind', () => {
    const order = seatsClockwiseFrom('BTN');
    expect(order[1]).toBe('SB');
    expect(order[2]).toBe('BB');
  });
});

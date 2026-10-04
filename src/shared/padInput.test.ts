import { describe, expect, it } from 'vitest';
import type { PadKey } from './padInput';
import { applyPadKey, padKeyFromKeyboard } from './padInput';
import { parseUserNumber } from '../tools/math/answerInput';

const type = (keys: PadKey[], decimals = true): string =>
  keys.reduce((text, k) => applyPadKey(text, k, { decimals }), '');

describe('applyPadKey', () => {
  it('types digits and a single decimal point', () => {
    expect(type(['2', '7', '.', '5'])).toBe('27.5');
    expect(type(['2', '.', '.', '5'])).toBe('2.5');
    expect(type(['.', '5'])).toBe('0.5');
  });

  it('keeps one decimal digit and at most four integer digits', () => {
    expect(type(['3', '3', '.', '3', '3'])).toBe('33.3');
    expect(type(['1', '2', '3', '4', '5'])).toBe('1234');
  });

  it('drops leading zeros', () => {
    expect(type(['0', '0', '7'])).toBe('7');
    expect(type(['0', '.', '5'])).toBe('0.5');
  });

  it('ignores the decimal point where only whole numbers make sense', () => {
    expect(type(['1', '.', '2'], false)).toBe('12');
  });

  it('deletes the last character', () => {
    expect(type(['2', '7', '.', '5', 'back'])).toBe('27.');
    expect(type(['back'])).toBe('');
  });

  it('always produces text the answer parser accepts', () => {
    for (const text of [type(['2', '7', '.']), type(['.', '5']), type(['0']), type(['9', '9', '9', '9'])]) {
      expect(parseUserNumber(text)).not.toBeNull();
    }
    expect(parseUserNumber(type(['2', '7', '.']))).toBe(27);
  });
});

describe('padKeyFromKeyboard', () => {
  it('maps digits, both decimal separators and backspace', () => {
    expect(padKeyFromKeyboard('7')).toBe('7');
    expect(padKeyFromKeyboard(',')).toBe('.');
    expect(padKeyFromKeyboard('.')).toBe('.');
    expect(padKeyFromKeyboard('Backspace')).toBe('back');
    expect(padKeyFromKeyboard('a')).toBeNull();
  });
});

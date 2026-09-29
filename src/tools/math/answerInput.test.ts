import { describe, expect, it } from 'vitest';
import { stackBehind } from '../../core/math/betting';
import { buildTask, checkAnswer } from '../../core/math/tasks';
import { parseUserNumber } from './answerInput';

describe('parseUserNumber', () => {
  it('accepts comma or dot decimals, % and $ signs, spaces', () => {
    expect(parseUserNumber('27,6')).toBe(27.6);
    expect(parseUserNumber('27.6%')).toBe(27.6);
    expect(parseUserNumber(' 27.6 % ')).toBe(27.6);
    expect(parseUserNumber('$31')).toBe(31);
    expect(parseUserNumber('10')).toBe(10);
    expect(parseUserNumber('0')).toBe(0);
    expect(parseUserNumber('.5')).toBe(0.5);
  });

  it('rejects anything else', () => {
    for (const bad of ['', ' ', 'abc', '1.2.3', '-5', '1e3', '12a']) expect(parseUserNumber(bad)).toBeNull();
  });

  it('feeds the core check exactly as the UI does', () => {
    const pot = 65;
    const task = buildTask('potOdds', {
      spot: { pot, bet: 40, stack: stackBehind(pot), fraction: null, allIn: false },
    });
    const typed = parseUserNumber('27,6');
    expect(typed).not.toBeNull();
    expect(checkAnswer(task, { kind: 'number', value: typed! }).correct).toBe(true);
  });
});

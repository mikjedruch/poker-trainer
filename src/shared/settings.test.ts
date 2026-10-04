import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, sanitizeSettings } from './settings';

describe('sanitizeSettings', () => {
  it('defaults to dark theme and four-colour deck', () => {
    expect(DEFAULT_SETTINGS).toEqual({ theme: 'dark', deck: 'four' });
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings('garbage')).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings({ theme: 'neon', deck: 3 })).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps valid stored values', () => {
    expect(sanitizeSettings({ theme: 'light', deck: 'two' })).toEqual({ theme: 'light', deck: 'two' });
    expect(sanitizeSettings({ theme: 'light' })).toEqual({ theme: 'light', deck: 'four' });
  });
});

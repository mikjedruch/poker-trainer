import { useSyncExternalStore } from 'react';
import { readJson, writeJson } from './storage';

// Display settings shared by every tool. Applied as data attributes on <html>; theme.css does the rest.
// index.html applies the stored values before the first paint, so keep SETTINGS_KEY in sync there.

export const SETTINGS_KEY = 'poker-trainer/settings/v1';

export type Theme = 'dark' | 'light';
export type Deck = 'four' | 'two';

export interface Settings {
  theme: Theme;
  deck: Deck;
}

export const DEFAULT_SETTINGS: Settings = { theme: 'dark', deck: 'four' };

/** Accepts anything read from storage and returns valid settings. */
export function sanitizeSettings(raw: unknown): Settings {
  const obj = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  return {
    theme: obj.theme === 'light' ? 'light' : DEFAULT_SETTINGS.theme,
    deck: obj.deck === 'two' ? 'two' : DEFAULT_SETTINGS.deck,
  };
}

let current: Settings = sanitizeSettings(readJson(SETTINGS_KEY));
const listeners = new Set<() => void>();

function apply(settings: Settings): void {
  const root = document.documentElement;
  root.dataset.theme = settings.theme;
  root.dataset.deck = settings.deck;
  const bg = getComputedStyle(root).getPropertyValue('--color-bg').trim();
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && bg) meta.setAttribute('content', bg);
}

export function initSettings(): void {
  apply(current);
}

export function updateSettings(patch: Partial<Settings>): void {
  current = sanitizeSettings({ ...current, ...patch });
  writeJson(SETTINGS_KEY, current);
  apply(current);
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, () => current);
}

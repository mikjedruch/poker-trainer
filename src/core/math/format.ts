// Number formatting for Polish UI text. Decimal point, as in the specification examples.

const trimZero = (s: string): string => s.replace(/\.0$/, '');

/** 0.2759 → "27.6%", 0.2 → "20%". */
export const pct = (fraction: number): string => `${trimZero((fraction * 100).toFixed(1))}%`;

/** Value already in percent: 27.59 → "27.6%". */
export const pctValue = (percent: number): string => `${trimZero(percent.toFixed(1))}%`;

const MINUS = '−';

/** 40 → "$40", 9.654 → "$9.65", −7.05 → "−$7.05". */
export function usd(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  const abs = Math.abs(rounded);
  const text = Number.isInteger(abs) ? String(abs) : abs.toFixed(2);
  return `${rounded < 0 ? MINUS : ''}$${text}`;
}

export const signedUsd = (amount: number): string => (Math.round(amount * 100) / 100 > 0 ? `+${usd(amount)}` : usd(amount));

/** Plain number with up to `digits` decimals: 136 → "136", 136.4 → "136.40". */
export function money(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

export const decimal = (x: number, digits = 4): string => x.toFixed(digits);

/** Polish plural: 1 out, 2–4 outy, 5+ outów (12–14 outów). */
export function plural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  const lastTwo = n % 100;
  const last = n % 10;
  if (last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) return few;
  return many;
}

export const outsWord = (n: number): string => `${n} ${plural(n, 'out', 'outy', 'outów')}`;

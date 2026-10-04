// Pure editing logic for the on-screen number pad. The pad replaces the system keyboard:
// it is always in the same place, large, and never covers the answer buttons.

export type PadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.' | 'back';

export interface PadOptions {
  /** Whether a decimal point is allowed (percentages yes; outs and dollars no). */
  decimals: boolean;
}

const MAX_INTEGER_DIGITS = 4;
const MAX_DECIMALS = 1;

/** Returns the new text after pressing `key`, or the same text if the key is not allowed. */
export function applyPadKey(text: string, key: PadKey, options: PadOptions): string {
  if (key === 'back') return text.slice(0, -1);

  const [intPart = '', decPart] = text.split('.');
  if (key === '.') {
    if (!options.decimals || decPart !== undefined) return text;
    return text === '' ? '0.' : `${text}.`;
  }

  if (decPart !== undefined) {
    return decPart.length >= MAX_DECIMALS ? text : text + key;
  }
  if (intPart === '0') return key; // no leading zeros: "0" then "7" is "7"
  if (intPart.length >= MAX_INTEGER_DIGITS) return text;
  return text + key;
}

/** Maps a physical keyboard key to a pad key (desktop use). */
export function padKeyFromKeyboard(key: string): PadKey | null {
  if (/^[0-9]$/.test(key)) return key as PadKey;
  if (key === '.' || key === ',') return '.';
  if (key === 'Backspace') return 'back';
  return null;
}

import rawData from '../../data/profiles.json';
import type { ScenarioId } from '../preflop/data';
import { SCENARIO_IDS, scenarioRanges } from '../preflop/data';
import type { HandClass } from '../range';
import { classRange, classCombos, formatRange } from '../range';

// Opponent profiles: the villain's preflop calling ranges plus one behavioural assumption.
// Built-in profiles come from src/data/profiles.json; custom ones are copies the user edits.

export const RANGE_KEYS = ['bbVsEarly', 'bbVsLate', 'ccVsEarly', 'ccVsLate'] as const;
export type RangeKey = (typeof RANGE_KEYS)[number];

export const RANGE_KEY_NAMES_PL: Readonly<Record<RangeKey, string>> = {
  bbVsEarly: 'Obrona BB przeciw openowi z UTG',
  bbVsLate: 'Obrona BB przeciw openowi z CO/BTN',
  ccVsEarly: 'Cold call na BTN przeciw openowi z UTG',
  ccVsLate: 'Cold call na BTN przeciw openowi z CO',
};

export const RANGE_KEY_SHORT_PL: Readonly<Record<RangeKey, string>> = {
  bbVsEarly: 'BB vs UTG',
  bbVsLate: 'BB vs CO/BTN',
  ccVsEarly: 'BTN vs UTG',
  ccVsLate: 'BTN vs CO',
};

export const BASELINE_ID = 'baseline';
export const LOOSE_ID = 'loose-live';

export interface Profile {
  id: string;
  name: string;
  builtIn: boolean;
  ranges: Readonly<Record<RangeKey, ReadonlySet<HandClass>>>;
  /** Calls too often postflop and rarely bluffs: fewer bluffs, thinner value against it. */
  callsTooMuch: boolean;
  /** Polish description of the behavioural assumption. */
  assumptions: string;
  source: string;
}

export const CALLS_TOO_MUCH_PL = 'za często sprawdza postflop, rzadko blefuje';
export const PLAYS_BASELINE_PL = 'gra jak zakresy bazowe';
export const assumptionText = (callsTooMuch: boolean): string => (callsTooMuch ? CALLS_TOO_MUCH_PL : PLAYS_BASELINE_PL);

export const MAX_NAME_LENGTH = 40;

export const comboCountOf = (classes: Iterable<HandClass>): number => {
  let n = 0;
  for (const cls of classes) n += classCombos(cls).length;
  return n;
};

/** Canonical notation of a range: two ranges with the same signature are the same range. */
export const rangeSignature = (classes: Iterable<HandClass>): string => formatRange(classes);

/** Parses one range: "@SCENARIO.call" / "@SCENARIO.raise" or notation covering whole hand classes. */
export function parseProfileRange(text: string): Set<HandClass> {
  const ref = /^@([A-Z0-9_]+)\.(call|raise)$/.exec(text.trim());
  if (ref) {
    const id = ref[1] as ScenarioId;
    if (!SCENARIO_IDS.includes(id)) throw new Error(`Unknown preflop scenario in "${text}"`);
    const s = scenarioRanges(id);
    return new Set(ref[2] === 'call' ? s.call : s.raise);
  }
  const { classes, partial } = classRange(text);
  if (partial.length > 0) throw new Error(`Range covers only part of ${partial.join(', ')}`);
  return classes;
}

function loadBuiltIns(): Profile[] {
  const raw = rawData as unknown as { profiles: Array<Record<string, unknown>> };
  const seen = new Set<string>();
  return raw.profiles.map((p) => {
    const id = String(p.id ?? '');
    if (!id || seen.has(id)) throw new Error(`profiles.json: missing or duplicate id "${id}"`);
    seen.add(id);
    const rawRanges = (p.ranges ?? {}) as Record<string, unknown>;
    const ranges = Object.fromEntries(
      RANGE_KEYS.map((k) => {
        if (typeof rawRanges[k] !== 'string') throw new Error(`profiles.json ${id}: missing range ${k}`);
        try {
          return [k, parseProfileRange(rawRanges[k])];
        } catch (e) {
          throw new Error(`profiles.json ${id}.${k}: ${(e as Error).message}`);
        }
      }),
    ) as Record<RangeKey, Set<HandClass>>;
    const assumptions = (p.assumptions ?? {}) as Record<string, unknown>;
    if (typeof assumptions.callsTooMuch !== 'boolean') throw new Error(`profiles.json ${id}: assumptions.callsTooMuch must be true/false`);
    return {
      id,
      name: String(p.name ?? id),
      builtIn: true,
      ranges,
      callsTooMuch: assumptions.callsTooMuch,
      assumptions: String(assumptions.text ?? assumptionText(assumptions.callsTooMuch)),
      source: String(p.source ?? ''),
    };
  });
}

export const BUILT_IN_PROFILES: readonly Profile[] = loadBuiltIns();
for (const id of [BASELINE_ID, LOOSE_ID]) {
  if (!BUILT_IN_PROFILES.some((p) => p.id === id)) throw new Error(`profiles.json: missing profile ${id}`);
}

export const builtInProfile = (id: string): Profile => {
  const p = BUILT_IN_PROFILES.find((x) => x.id === id);
  if (!p) throw new Error(`No built-in profile ${id}`);
  return p;
};

// ---------- custom profiles (stored in localStorage by the UI) ----------

export interface StoredProfile {
  id: string;
  name: string;
  ranges: Record<RangeKey, string>;
  callsTooMuch: boolean;
  /** Profile it was copied from. */
  basedOn: string;
}

export const CUSTOM_PREFIX = 'custom-';

export function toStored(p: Profile, basedOn: string): StoredProfile {
  return {
    id: p.id,
    name: p.name,
    ranges: Object.fromEntries(RANGE_KEYS.map((k) => [k, formatRange(p.ranges[k])])) as Record<RangeKey, string>,
    callsTooMuch: p.callsTooMuch,
    basedOn,
  };
}

export const cleanName = (name: string): string => name.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH);

/** Accepts one stored profile; returns null if anything is invalid. */
export function fromStored(raw: unknown): (Profile & { basedOn: string }) | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.id !== 'string' || !obj.id.startsWith(CUSTOM_PREFIX)) return null;
  const name = typeof obj.name === 'string' ? cleanName(obj.name) : '';
  if (!name || typeof obj.callsTooMuch !== 'boolean') return null;
  const rawRanges = typeof obj.ranges === 'object' && obj.ranges !== null ? (obj.ranges as Record<string, unknown>) : {};
  const ranges = {} as Record<RangeKey, Set<HandClass>>;
  for (const k of RANGE_KEYS) {
    const text = rawRanges[k];
    if (typeof text !== 'string' || text.trim().startsWith('@')) return null;
    try {
      ranges[k] = parseProfileRange(text);
    } catch {
      return null;
    }
  }
  return {
    id: obj.id,
    name,
    builtIn: false,
    ranges,
    callsTooMuch: obj.callsTooMuch,
    assumptions: assumptionText(obj.callsTooMuch),
    source: 'custom',
    basedOn: typeof obj.basedOn === 'string' ? obj.basedOn : BASELINE_ID,
  };
}

/** Accepts anything read from storage: drops invalid entries and duplicate ids. */
export function sanitizeStoredProfiles(raw: unknown): Array<Profile & { basedOn: string }> {
  if (!Array.isArray(raw)) return [];
  const out: Array<Profile & { basedOn: string }> = [];
  const ids = new Set<string>();
  for (const item of raw) {
    const p = fromStored(item);
    if (p && !ids.has(p.id)) {
      ids.add(p.id);
      out.push(p);
    }
  }
  return out;
}

/** Copy of a profile as a new, editable custom profile. */
export function copyProfile(source: Profile, id: string, name: string): Profile {
  if (!id.startsWith(CUSTOM_PREFIX)) throw new Error(`Custom profile ids start with ${CUSTOM_PREFIX}`);
  return {
    id,
    name: cleanName(name) || source.name,
    builtIn: false,
    ranges: Object.fromEntries(RANGE_KEYS.map((k) => [k, new Set(source.ranges[k])])) as Record<RangeKey, Set<HandClass>>,
    callsTooMuch: source.callsTooMuch,
    assumptions: assumptionText(source.callsTooMuch),
    source: 'custom',
  };
}

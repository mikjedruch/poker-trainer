import type { Card } from '../cards';
import { formatCard, parseCards } from '../cards';
import type { Rng } from '../rng';
import { randomInt } from '../rng';
import type { Position } from '../table';
import type { HeadsUpAnalysis } from './analysis';
import { headsUpAnalysis } from './analysis';
import { canonicalFlop, canonicalKey } from './canonical';
import type { RangeSummary } from './categories';
import { HAND_CATEGORIES, emptyCounts, summarizeRange } from './categories';
import type { Profile } from './profiles';
import { BASELINE_ID, LOOSE_ID, builtInProfile, rangeSignature } from './profiles';
import type { Matchup } from './rangeEquity';
import { rangeEquities } from './rangeEquity';
import type { HuScenario } from './scenarios';
import { HU_SCENARIOS, HU_SCENARIO_DEFS, heroCombos, openRange } from './scenarios';
import type { Combo } from '../range';
import { classesToCombos } from '../range';
import { HEIGHT_VALUES, SUITS_VALUES, flopTexture } from './texture';

// Precomputed flop library for the quizzes: 150 flops stratified by texture, analysed for
// P1–P5 against both built-in profiles at build time (scripts/precompute-flops.ts).
// Every range used is stored as a signature; an entry is only used while the ranges still match.

export const LIBRARY_VERSION = 1;
export const LIBRARY_PROFILES: readonly string[] = [BASELINE_ID, LOOSE_ID];
export const FLOPS_PER_STRATUM = 10;

/** [combos, …counts in HAND_CATEGORIES order] */
type PackedSummary = number[];
/** [points, triples, villain combos, …villain counts] */
type PackedMatchup = number[];

export interface LibraryFlop {
  /** Canonical flop, e.g. "Ks7d2c". */
  flop: string;
  stratum: string;
  hero: Partial<Record<Position, PackedSummary>>;
  vs: Record<HuScenario, Record<string, PackedMatchup>>;
}

export interface FlopLibrary {
  version: number;
  seed: number;
  /** Signature (canonical notation) of every range used: "hero:UTG", "baseline:bbVsEarly", … */
  ranges: Record<string, string>;
  flops: LibraryFlop[];
}

// ---------- strata ----------

export function stratumOf(flop: readonly Card[]): string {
  const t = flopTexture(flop);
  return `${t.suits}/${t.paired ? 'paired' : 'unpaired'}/${t.height}`;
}

/** Suits × paired × height; a paired flop cannot be monotone, which leaves 15 strata. */
export const STRATA: readonly string[] = SUITS_VALUES.flatMap((s) =>
  (s === 'monotone' ? ['unpaired'] : ['unpaired', 'paired']).flatMap((p) => HEIGHT_VALUES.map((h) => `${s}/${p}/${h}`)),
);

/** Distinct canonical flops, the same number from every stratum. */
export function sampleStratifiedFlops(rng: Rng, perStratum: number): Card[][] {
  const byStratum = new Map<string, Card[][]>(STRATA.map((s) => [s, []]));
  const seen = new Set<string>();
  let missing = STRATA.length * perStratum;
  for (let guard = 0; missing > 0; guard++) {
    if (guard > 5_000_000) throw new Error('Could not fill every texture stratum');
    const a = randomInt(rng, 52);
    const b = randomInt(rng, 52);
    const c = randomInt(rng, 52);
    if (a === b || a === c || b === c) continue;
    const flop = canonicalFlop([a, b, c]);
    const key = flop.map(formatCard).join('');
    const list = byStratum.get(stratumOf(flop))!;
    if (seen.has(key) || list.length >= perStratum) continue;
    seen.add(key);
    list.push(flop);
    missing--;
  }
  return STRATA.flatMap((s) => byStratum.get(s)!);
}

// ---------- building ----------

const heroKey = (p: Position) => `hero:${p}`;
const villainKey = (profileId: string, scenario: HuScenario) => `${profileId}:${HU_SCENARIO_DEFS[scenario].villainRange}`;

const pack = (s: RangeSummary): PackedSummary => [s.combos, ...HAND_CATEGORIES.map((c) => s.counts[c])];

function unpack(packed: readonly number[], offset: number): RangeSummary {
  const counts = emptyCounts();
  HAND_CATEGORIES.forEach((c, i) => (counts[c] = packed[offset + 1 + i]!));
  return { combos: packed[offset]!, counts };
}

const HERO_POSITIONS: Position[] = [...new Set(HU_SCENARIOS.map((s) => HU_SCENARIO_DEFS[s].hero))];

/** Signatures of every range the library is computed from. */
export function librarySignatures(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of HERO_POSITIONS) out[heroKey(p)] = rangeSignature(openRange(p));
  for (const id of LIBRARY_PROFILES)
    for (const s of HU_SCENARIOS) out[villainKey(id, s)] = rangeSignature(builtInProfile(id).ranges[HU_SCENARIO_DEFS[s].villainRange]);
  return out;
}

/** Analyses one flop for every scenario and built-in profile in a single pass over the runouts. */
export function buildLibraryFlop(flop: readonly Card[]): LibraryFlop {
  const canon = canonicalFlop(flop);
  // Distinct ranges (by signature): each is evaluated once per runout for all matchups.
  const combos: Combo[][] = [];
  const index = new Map<string, number>();
  const rangeIndex = (sig: string, make: () => Combo[]) => {
    if (!index.has(sig)) {
      index.set(sig, combos.length);
      combos.push(make());
    }
    return index.get(sig)!;
  };

  const matchups: Matchup[] = [];
  const labels: Array<[HuScenario, string]> = [];
  for (const s of HU_SCENARIOS) {
    const def = HU_SCENARIO_DEFS[s];
    const h = rangeIndex(`hero:${rangeSignature(openRange(def.hero))}`, () => heroCombos(def.hero, canon));
    for (const id of LIBRARY_PROFILES) {
      const classes = builtInProfile(id).ranges[def.villainRange];
      const v = rangeIndex(`villain:${rangeSignature(classes)}`, () => classesToCombos(classes, canon));
      matchups.push({ hero: h, villain: v });
      labels.push([s, id]);
    }
  }
  const equities = rangeEquities(canon, combos, matchups);

  const hero: Partial<Record<Position, PackedSummary>> = {};
  for (const p of HERO_POSITIONS) hero[p] = pack(summarizeRange(heroCombos(p, canon), canon));
  const vs = Object.fromEntries(HU_SCENARIOS.map((s) => [s, {} as Record<string, PackedMatchup>])) as LibraryFlop['vs'];
  labels.forEach(([s, id], m) => {
    const e = equities[m]!;
    vs[s][id] = [e.points, e.triples, ...pack(summarizeRange(combos[matchups[m]!.villain]!, canon))];
  });
  return { flop: canon.map(formatCard).join(''), stratum: stratumOf(canon), hero, vs };
}

// ---------- reading ----------

const isNumberArray = (x: unknown, length: number): x is number[] =>
  Array.isArray(x) && x.length === length && x.every((n) => typeof n === 'number' && Number.isFinite(n) && n >= 0);

/** Validates data read from the library file; throws on anything malformed. */
export function validateLibrary(raw: unknown): FlopLibrary {
  const lib = raw as FlopLibrary;
  if (typeof lib !== 'object' || lib === null || lib.version !== LIBRARY_VERSION || !Array.isArray(lib.flops)) {
    throw new Error('Flop library: wrong format or version');
  }
  const summaryLength = 1 + HAND_CATEGORIES.length;
  for (const f of lib.flops) {
    if (parseCards(f.flop).length !== 3 || canonicalKey(parseCards(f.flop)) !== f.flop) throw new Error(`Flop library: bad flop ${f.flop}`);
    for (const p of HERO_POSITIONS) if (!isNumberArray(f.hero[p], summaryLength)) throw new Error(`Flop library ${f.flop}: hero ${p}`);
    for (const s of HU_SCENARIOS)
      for (const id of LIBRARY_PROFILES) if (!isNumberArray(f.vs?.[s]?.[id], 2 + summaryLength)) throw new Error(`Flop library ${f.flop}: ${s} ${id}`);
  }
  return lib;
}

/** Library index for fast lookups by canonical flop. */
export interface LibraryIndex {
  lib: FlopLibrary;
  byFlop: Map<string, LibraryFlop>;
  current: Record<string, string>;
}

export function indexLibrary(lib: FlopLibrary): LibraryIndex {
  return { lib, byFlop: new Map(lib.flops.map((f) => [f.flop, f])), current: librarySignatures() };
}

/** True if the library holds up-to-date numbers for this scenario and profile. */
export function libraryCovers(index: LibraryIndex, scenario: HuScenario, profile: Profile): boolean {
  if (!LIBRARY_PROFILES.includes(profile.id) || !profile.builtIn) return false;
  const hk = heroKey(HU_SCENARIO_DEFS[scenario].hero);
  const vk = villainKey(profile.id, scenario);
  return index.lib.ranges[hk] === index.current[hk] && index.lib.ranges[vk] === index.current[vk];
}

/** Heads-up analysis from the library, for the actual flop (any suits), or null if not covered. */
export function libraryAnalysis(index: LibraryIndex, scenario: HuScenario, profile: Profile, flop: readonly Card[]): HeadsUpAnalysis | null {
  if (!libraryCovers(index, scenario, profile)) return null;
  const entry = index.byFlop.get(canonicalKey(flop));
  if (!entry) return null;
  const h = entry.hero[HU_SCENARIO_DEFS[scenario].hero]!;
  const v = entry.vs[scenario][profile.id]!;
  return headsUpAnalysis(scenario, flop, unpack(h, 0), { equity: { points: v[0]!, triples: v[1]! }, summary: unpack(v, 2) });
}

export const libraryFlops = (index: LibraryIndex): Card[][] => index.lib.flops.map((f) => parseCards(f.flop));

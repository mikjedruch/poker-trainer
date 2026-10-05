import type { Card } from '../../core/cards';
import { parseCards } from '../../core/cards';
import type { HeadsUpAnalysis, RangeAnalysis, VillainResult } from '../../core/postflop/analysis';
import { analyzeRanges, headsUpAnalysis } from '../../core/postflop/analysis';
import { canonicalKey } from '../../core/postflop/canonical';
import type { RangeSummary } from '../../core/postflop/categories';
import type { LibraryIndex } from '../../core/postflop/library';
import { indexLibrary, libraryAnalysis, validateLibrary } from '../../core/postflop/library';
import type { Profile } from '../../core/postflop/profiles';
import { builtInProfile, rangeSignature } from '../../core/postflop/profiles';
import type { HuScenario } from '../../core/postflop/scenarios';
import { HU_SCENARIO_DEFS, openRange, villainRange } from '../../core/postflop/scenarios';
import type { HandClass } from '../../core/range';
import AnalysisWorker from './analysis.worker?worker';
import type { AnalysisJob, WorkerReply } from './workerProtocol';

// Where analyses come from, fastest first: the precomputed library (built-in profiles, 150 flops),
// the in-memory cache, then a fresh exact computation in the Web Worker.
// Cache keys use the flop with suits renamed to a canonical form and the ranges' signatures,
// so editing a custom profile never returns stale numbers.

export type ProgressFn = (fraction: number) => void;

// ---------- library (loaded lazily: it is only needed by the postflop screens) ----------

let libraryPromise: Promise<LibraryIndex | null> | null = null;

export function loadLibrary(): Promise<LibraryIndex | null> {
  libraryPromise ??= import('../../data/flop-library.json')
    .then((m) => indexLibrary(validateLibrary(m.default)))
    .catch(() => null);
  return libraryPromise;
}

// ---------- worker ----------

interface PendingJob {
  resolve: (r: { result: RangeAnalysis; ms: number }) => void;
  reject: (e: Error) => void;
  onProgress?: ProgressFn;
}

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, PendingJob>();

function getWorker(): Worker | null {
  if (worker) return worker;
  if (typeof Worker === 'undefined') return null;
  try {
    worker = new AnalysisWorker();
  } catch {
    return null;
  }
  worker.onmessage = (event: MessageEvent<WorkerReply>) => {
    const msg = event.data;
    const job = pending.get(msg.id);
    if (!job) return;
    if (msg.type === 'progress') job.onProgress?.(msg.done / msg.total);
    else {
      pending.delete(msg.id);
      if (msg.type === 'done') job.resolve({ result: msg.result, ms: msg.ms });
      else job.reject(new Error(msg.message));
    }
  };
  worker.onerror = () => {
    for (const job of pending.values()) job.reject(new Error('Błąd obliczeń w tle'));
    pending.clear();
    worker?.terminate();
    worker = null;
  };
  return worker;
}

/** Runs one analysis job in the worker (or, without workers, on the main thread). */
export function runAnalysis(
  flop: readonly Card[],
  hero: Iterable<HandClass>,
  villains: ReadonlyArray<Iterable<HandClass>>,
  onProgress?: ProgressFn,
): Promise<{ result: RangeAnalysis; ms: number }> {
  const job: AnalysisJob = { id: nextId++, flop: [...flop], hero: [...hero], villains: villains.map((v) => [...v]) };
  const w = getWorker();
  if (!w) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          const started = performance.now();
          const result = analyzeRanges(job.flop, job.hero, job.villains, (d, t) => onProgress?.(d / t));
          resolve({ result, ms: performance.now() - started });
        } catch (e) {
          reject(e as Error);
        }
      }, 0);
    });
  }
  return new Promise((resolve, reject) => {
    pending.set(job.id, { resolve, reject, onProgress });
    w.postMessage(job);
  });
}

// ---------- cache ----------

const CACHE_LIMIT = 400;
const heroCache = new Map<string, RangeSummary>();
const villainCache = new Map<string, VillainResult>();

function remember<V>(map: Map<string, V>, key: string, value: V): void {
  map.delete(key);
  map.set(key, value);
  if (map.size > CACHE_LIMIT) map.delete(map.keys().next().value!);
}

const signatures = new WeakMap<ReadonlySet<HandClass>, string>();
function signatureOf(range: ReadonlySet<HandClass>): string {
  let sig = signatures.get(range);
  if (sig === undefined) {
    sig = rangeSignature(range);
    signatures.set(range, sig);
  }
  return sig;
}

/**
 * Heads-up analyses of one scenario and flop for several profiles (e.g. baseline and the active
 * profile, side by side). Profiles not covered by the library or the cache are computed together
 * in one worker job.
 */
export async function headsUpAnalyses(
  scenario: HuScenario,
  flop: readonly Card[],
  profiles: readonly Profile[],
  onProgress?: ProgressFn,
): Promise<HeadsUpAnalysis[]> {
  const library = await loadLibrary();
  const canon = canonicalKey(flop);
  const hero = openRange(HU_SCENARIO_DEFS[scenario].hero);
  const heroKey = `${canon}|${signatureOf(hero)}`;
  const villainKey = (p: Profile) => `${canon}|${signatureOf(villainRange(scenario, p))}`;

  const out: Array<HeadsUpAnalysis | null> = profiles.map((p) => {
    const fromLibrary = library ? libraryAnalysis(library, scenario, p, flop) : null;
    if (fromLibrary) return fromLibrary;
    const h = heroCache.get(heroKey);
    const v = villainCache.get(villainKey(p));
    return h && v ? headsUpAnalysis(scenario, flop, h, v) : null;
  });

  const missing = profiles.filter((_, i) => out[i] === null);
  if (missing.length > 0) {
    const { result } = await runAnalysis(
      flop,
      hero,
      missing.map((p) => villainRange(scenario, p)),
      onProgress,
    );
    remember(heroCache, heroKey, result.hero);
    missing.forEach((p, i) => remember(villainCache, villainKey(p), result.villains[i]!));
    profiles.forEach((p, i) => {
      if (out[i] === null) out[i] = headsUpAnalysis(scenario, flop, result.hero, villainCache.get(villainKey(p))!);
    });
  }
  onProgress?.(1);
  return out as HeadsUpAnalysis[];
}

export const headsUpAnalysisFor = async (
  scenario: HuScenario,
  flop: readonly Card[],
  profile: Profile,
  onProgress?: ProgressFn,
): Promise<HeadsUpAnalysis> => (await headsUpAnalyses(scenario, flop, [profile], onProgress))[0]!;

/** Speed test: the heaviest analysis (BTN open vs loose-live BB defence), never from cache. */
export const BENCHMARK_FLOP: readonly Card[] = parseCards('7h 6s 5d');
export async function measureWorstCase(onProgress?: ProgressFn): Promise<number> {
  const { ms } = await runAnalysis(BENCHMARK_FLOP, openRange('BTN'), [builtInProfile('loose-live').ranges.bbVsLate], onProgress);
  return ms;
}

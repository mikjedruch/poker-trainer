import type { Card } from '../../core/cards';
import type { HeadsUpAnalysis } from '../../core/postflop/analysis';
import { permuteSuits, randomSuitPermutation } from '../../core/postflop/canonical';
import type { LibraryIndex } from '../../core/postflop/library';
import { libraryAnalysis, libraryCovers, libraryFlops } from '../../core/postflop/library';
import type { Profile } from '../../core/postflop/profiles';
import type { HandSpot, QuizType } from '../../core/postflop/quiz';
import { QUIZ_TYPES, buildHandSpot, pickQuizHand, pickStrategyFlop, randomTextureFlop } from '../../core/postflop/quiz';
import type { BoardStrategy } from '../../core/postflop/rule';
import type { FlopSeats, HuScenario } from '../../core/postflop/scenarios';
import { HU_SCENARIOS, POSTFLOP_SCENARIOS, headsUpSeats, isHeadsUp, randomMultiwaySeats } from '../../core/postflop/scenarios';
import type { SizingTask } from '../../core/postflop/sizing';
import { generateSizingTask } from '../../core/postflop/sizing';
import type { Rng } from '../../core/rng';
import { createRng, pick, randomSeed } from '../../core/rng';
import type { ProgressFn } from './analysisService';
import { headsUpAnalysisFor, loadLibrary } from './analysisService';
import type { PostflopProgress } from './progress';
import { pickQuizType, pickScenario } from './progress';

// Picks the next quiz item. Answers always come from src/core; this only chooses what to ask
// and fetches the range analysis (library, cache or worker).

export type QuizMode = 'mixed' | QuizType;
export const QUIZ_MODES: readonly QuizMode[] = ['mixed', ...QUIZ_TYPES];
export const isQuizMode = (x: unknown): x is QuizMode => typeof x === 'string' && (QUIZ_MODES as readonly string[]).includes(x);

export type QuizItem =
  | { type: 'texture'; flop: Card[] }
  | { type: 'strategy'; seats: FlopSeats; profile: Profile; analysis: HeadsUpAnalysis }
  | { type: 'hand'; spot: HandSpot; profile: Profile }
  | { type: 'sizing'; task: SizingTask };

let flopsCache: Card[][] | null = null;
const strategyCache = new Map<string, Array<{ flop: Card[]; strategy: BoardStrategy }>>();

/** A library flop (stratified by texture) with random suits; a random flop without the library. */
function randomFlop(rng: Rng, library: LibraryIndex | null): Card[] {
  if (!library) return randomTextureFlop(rng);
  flopsCache ??= libraryFlops(library);
  return permuteSuits(pick(rng, flopsCache), randomSuitPermutation(rng));
}

/** For the strategy quiz: each of the three strategies comes up about equally often when possible. */
function strategyFlop(rng: Rng, library: LibraryIndex | null, scenario: HuScenario, profile: Profile): Card[] {
  if (!library || !libraryCovers(library, scenario, profile)) return randomFlop(rng, library);
  const key = `${scenario}|${profile.id}`;
  let candidates = strategyCache.get(key);
  if (!candidates) {
    flopsCache ??= libraryFlops(library);
    candidates = flopsCache.map((flop) => ({ flop, strategy: libraryAnalysis(library, scenario, profile, flop)!.strategy.strategy }));
    strategyCache.set(key, candidates);
  }
  return permuteSuits(pickStrategyFlop(rng, candidates).flop, randomSuitPermutation(rng));
}

export async function nextQuizItem(mode: QuizMode, progress: PostflopProgress, profile: Profile, onProgress?: ProgressFn): Promise<QuizItem> {
  const rng = createRng(randomSeed());
  const type = mode === 'mixed' ? pickQuizType(progress, rng) : mode;
  switch (type) {
    case 'texture':
      return { type, flop: randomTextureFlop(rng) };
    case 'sizing':
      return { type, task: generateSizingTask(rng) };
    case 'strategy': {
      const scenario = pickScenario(progress, rng, HU_SCENARIOS);
      const library = await loadLibrary();
      const flop = strategyFlop(rng, library, scenario, profile);
      const analysis = await headsUpAnalysisFor(scenario, flop, profile, onProgress);
      return { type, seats: headsUpSeats(scenario), profile, analysis };
    }
    case 'hand': {
      const scenario = pickScenario(progress, rng, POSTFLOP_SCENARIOS);
      const library = await loadLibrary();
      const flop = randomFlop(rng, library);
      if (!isHeadsUp(scenario)) {
        const seats = randomMultiwaySeats(rng);
        return { type, spot: buildHandSpot(seats, flop, pickQuizHand(rng, seats.hero, flop), profile, null), profile };
      }
      const seats = headsUpSeats(scenario);
      const analysis = await headsUpAnalysisFor(scenario, flop, profile, onProgress);
      return { type, spot: buildHandSpot(seats, flop, pickQuizHand(rng, seats.hero, flop), profile, analysis), profile };
    }
  }
}

export function scenarioOfItem(item: QuizItem) {
  if (item.type === 'strategy') return item.seats.scenario;
  if (item.type === 'hand') return item.spot.seats.scenario;
  return null;
}

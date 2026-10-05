import type { QuizType } from '../../core/postflop/quiz';
import { QUIZ_TYPES } from '../../core/postflop/quiz';
import type { PostflopScenario } from '../../core/postflop/scenarios';
import { POSTFLOP_SCENARIOS } from '../../core/postflop/scenarios';
import { pickWeighted } from '../../core/preflop/situation';
import type { Rng } from '../../core/rng';
import type { TypeStats } from '../../shared/accuracy';
import { addResult, emptyStats, sanitizeStats, typeWeight } from '../../shared/accuracy';

export const POSTFLOP_PROGRESS_KEY = 'poker-trainer/postflop-progress/v1';

/** Accuracy per quiz type and per scenario (strategy and hand quizzes). */
export interface PostflopProgress {
  type: Record<QuizType, TypeStats>;
  scenario: Record<PostflopScenario, TypeStats>;
}

const fill = <K extends string>(keys: readonly K[], value: (k: K) => TypeStats): Record<K, TypeStats> =>
  Object.fromEntries(keys.map((k) => [k, value(k)])) as Record<K, TypeStats>;

export function emptyPostflopProgress(): PostflopProgress {
  return { type: fill(QUIZ_TYPES, emptyStats), scenario: fill(POSTFLOP_SCENARIOS, emptyStats) };
}

export function recordPostflop(p: PostflopProgress, type: QuizType, scenario: PostflopScenario | null, correct: boolean): PostflopProgress {
  return {
    type: { ...p.type, [type]: addResult(p.type[type], correct) },
    scenario: scenario ? { ...p.scenario, [scenario]: addResult(p.scenario[scenario], correct) } : p.scenario,
  };
}

/** Error weighting: types with lower recent accuracy come up more often. */
export const pickQuizType = (p: PostflopProgress, rng: Rng): QuizType => pickWeighted(rng, QUIZ_TYPES, (t) => typeWeight(p.type[t]));

/** Error weighting among the allowed scenarios. */
export const pickScenario = <S extends PostflopScenario>(p: PostflopProgress, rng: Rng, allowed: readonly S[]): S =>
  pickWeighted(rng, allowed, (s) => typeWeight(p.scenario[s]));

export function sanitizePostflopProgress(raw: unknown): PostflopProgress {
  const obj = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const part = (key: string) => (typeof obj[key] === 'object' && obj[key] !== null ? (obj[key] as Record<string, unknown>) : {});
  const type = part('type');
  const scenario = part('scenario');
  return {
    type: fill(QUIZ_TYPES, (t) => sanitizeStats(type[t])),
    scenario: fill(POSTFLOP_SCENARIOS, (s) => sanitizeStats(scenario[s])),
  };
}

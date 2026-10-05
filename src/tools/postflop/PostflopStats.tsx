import { useState } from 'react';
import { QUIZ_TYPES, QUIZ_TYPE_NAMES_PL } from '../../core/postflop/quiz';
import { POSTFLOP_SCENARIOS, SCENARIO_NAMES_PL } from '../../core/postflop/scenarios';
import { typeWeight } from '../../shared/accuracy';
import { ResetStats, StatsRow, percent } from '../../shared/StatsList';
import { readJson, writeJson } from '../../shared/storage';
import { PostflopHeader } from './PostflopHeader';
import type { PostflopProgress } from './progress';
import { POSTFLOP_PROGRESS_KEY, emptyPostflopProgress, sanitizePostflopProgress } from './progress';

export function PostflopStats() {
  const [progress, setProgress] = useState<PostflopProgress>(() => sanitizePostflopProgress(readJson(POSTFLOP_PROGRESS_KEY)));
  const totalWeight = QUIZ_TYPES.reduce((sum, t) => sum + typeWeight(progress.type[t]), 0);

  function reset() {
    const empty = emptyPostflopProgress();
    writeJson(POSTFLOP_PROGRESS_KEY, empty);
    setProgress(empty);
  }

  return (
    <div className="page postflop">
      <PostflopHeader current="/postflop/stats" />

      <p className="muted">
        Trafność z ostatnich 20 prób. W trybie „Mieszane” słabsze rodzaje zadań losują się częściej (kolumna „szansa”), a w quizach
        strategii i ręki częściej dostajesz sytuacje, w których się mylisz.
      </p>

      <h2 className="section-title">Rodzaj zadania</h2>
      <ul className="stats-list">
        {QUIZ_TYPES.map((t) => (
          <StatsRow key={t} title={QUIZ_TYPE_NAMES_PL[t]} stats={progress.type[t]} note={`szansa ${percent(typeWeight(progress.type[t]) / totalWeight)}`} />
        ))}
      </ul>

      <h2 className="section-title">Sytuacja (strategia i ręka)</h2>
      <ul className="stats-list">
        {POSTFLOP_SCENARIOS.map((s) => (
          <StatsRow key={s} title={SCENARIO_NAMES_PL[s]} stats={progress.scenario[s]} />
        ))}
      </ul>

      <ResetStats onReset={reset} />
    </div>
  );
}

import { useState } from 'react';
import { TASK_INFO, TASK_TYPES } from '../../core/math/tasks';
import { href } from '../../shared/router';
import { ResetStats, StatsRow, percent } from '../../shared/StatsList';
import { readJson, writeJson } from '../../shared/storage';
import type { Progress } from './progress';
import { PROGRESS_KEY, emptyProgress, sanitizeProgress, typeWeight } from './progress';

export function MathStats() {
  const [progress, setProgress] = useState<Progress>(() => sanitizeProgress(readJson(PROGRESS_KEY)));
  const totalWeight = TASK_TYPES.reduce((sum, t) => sum + typeWeight(progress[t]), 0);

  function reset() {
    const empty = emptyProgress();
    writeJson(PROGRESS_KEY, empty);
    setProgress(empty);
  }

  return (
    <div className="page">
      <header className="topbar">
        <a className="topbar-link back" href={href('/math')} aria-label="Wróć do zadań">
          ←
        </a>
        <h1>Statystyki</h1>
        <span className="topbar-link" />
      </header>

      <p className="muted">
        Trafność z ostatnich 20 prób. W trybie „Mieszane” słabsze typy losują się częściej (kolumna „szansa”).
      </p>

      <ul className="stats-list">
        {TASK_TYPES.map((t) => (
          <StatsRow
            key={t}
            title={`${TASK_INFO[t].number}. ${TASK_INFO[t].title}`}
            stats={progress[t]}
            note={`szansa ${percent(typeWeight(progress[t]) / totalWeight)}`}
          />
        ))}
      </ul>

      <ResetStats onReset={reset} />
    </div>
  );
}

import { useState } from 'react';
import { TASK_INFO, TASK_TYPES } from '../../core/math/tasks';
import { href } from '../../shared/router';
import { readJson, writeJson } from '../../shared/storage';
import type { Progress } from './progress';
import { PROGRESS_KEY, emptyProgress, recentAccuracy, sanitizeProgress, typeWeight } from './progress';

const percent = (x: number) => `${Math.round(x * 100)}%`;

export function MathStats() {
  const [progress, setProgress] = useState<Progress>(() => sanitizeProgress(readJson(PROGRESS_KEY)));
  const [confirmReset, setConfirmReset] = useState(false);
  const totalWeight = TASK_TYPES.reduce((sum, t) => sum + typeWeight(progress[t]), 0);

  function reset() {
    const empty = emptyProgress();
    writeJson(PROGRESS_KEY, empty);
    setProgress(empty);
    setConfirmReset(false);
  }

  return (
    <div className="page">
      <header className="topbar">
        <a className="topbar-link" href={href('/math')} aria-label="Wróć do zadań">
          ←
        </a>
        <h1>Statystyki</h1>
        <span className="topbar-link" />
      </header>

      <p className="muted">
        Trafność z ostatnich 20 prób. W trybie „Mieszane” słabsze typy losują się częściej (kolumna „szansa”).
      </p>

      <ul className="stats-list">
        {TASK_TYPES.map((t) => {
          const s = progress[t];
          const acc = recentAccuracy(s);
          return (
            <li key={t} className="stats-item">
              <div className="stats-head">
                <strong>
                  {TASK_INFO[t].number}. {TASK_INFO[t].title}
                </strong>
                <span className="stats-acc">{acc === null ? '—' : percent(acc)}</span>
              </div>
              <div className="bar" aria-hidden="true">
                <div className="bar-fill" style={{ width: acc === null ? '0%' : percent(acc) }} />
              </div>
              <div className="stats-meta muted">
                {acc === null
                  ? 'Jeszcze nie ćwiczone'
                  : `Ostatnie ${s.recent.length}: ${s.recent.filter(Boolean).length} dobrze · łącznie ${s.correct}/${s.attempts}`}
                {' · '}szansa {percent(typeWeight(s) / totalWeight)}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="reset-area">
        {confirmReset ? (
          <div className="btn-pair">
            <button className="btn secondary" onClick={() => setConfirmReset(false)}>
              Anuluj
            </button>
            <button className="btn danger" onClick={reset}>
              Tak, wyzeruj
            </button>
          </div>
        ) : (
          <button className="btn secondary wide" onClick={() => setConfirmReset(true)}>
            Wyzeruj statystyki
          </button>
        )}
      </div>
    </div>
  );
}

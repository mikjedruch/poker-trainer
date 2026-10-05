import { useState } from 'react';
import type { TypeStats } from './accuracy';
import { recentAccuracy } from './accuracy';

export const percent = (x: number): string => `${Math.round(x * 100)}%`;

/** One accuracy bar: last-20 accuracy, counts and an optional note (e.g. how often it is drawn). */
export function StatsRow({ title, stats, note }: { title: string; stats: TypeStats; note?: string }) {
  const acc = recentAccuracy(stats);
  return (
    <li className="stats-item">
      <div className="stats-head">
        <strong>{title}</strong>
        <span className="stats-acc">{acc === null ? '—' : percent(acc)}</span>
      </div>
      <div className="bar" aria-hidden="true">
        <div className="bar-fill" style={{ width: acc === null ? '0%' : percent(acc) }} />
      </div>
      <div className="stats-meta muted">
        {acc === null
          ? 'Jeszcze nie ćwiczone'
          : `Ostatnie ${stats.recent.length}: ${stats.recent.filter(Boolean).length} dobrze · łącznie ${stats.correct}/${stats.attempts}`}
        {note && ` · ${note}`}
      </div>
    </li>
  );
}

/** "Wyzeruj statystyki" with a confirmation step. */
export function ResetStats({ onReset }: { onReset: () => void }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="reset-area">
      {confirm ? (
        <div className="btn-pair">
          <button className="btn secondary" onClick={() => setConfirm(false)}>
            Anuluj
          </button>
          <button
            className="btn danger"
            onClick={() => {
              onReset();
              setConfirm(false);
            }}
          >
            Tak, wyzeruj
          </button>
        </div>
      ) : (
        <button className="btn secondary wide" onClick={() => setConfirm(true)}>
          Wyzeruj statystyki
        </button>
      )}
    </div>
  );
}

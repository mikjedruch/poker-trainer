import { useState } from 'react';
import { FAMILIES, FAMILY_NAMES_PL } from '../../core/preflop/data';
import { FAMILY_BASE } from '../../core/preflop/situation';
import { POSITIONS } from '../../core/table';
import { typeWeight } from '../../shared/accuracy';
import { ResetStats, StatsRow, percent } from '../../shared/StatsList';
import { readJson, writeJson } from '../../shared/storage';
import { PreflopHeader } from './PreflopHeader';
import type { PreflopProgress } from './progress';
import { PREFLOP_PROGRESS_KEY, emptyPreflopProgress, sanitizePreflopProgress } from './progress';

export function PreflopStats() {
  const [progress, setProgress] = useState<PreflopProgress>(() => sanitizePreflopProgress(readJson(PREFLOP_PROGRESS_KEY)));
  const familyWeight = (f: (typeof FAMILIES)[number]) => FAMILY_BASE[f] * typeWeight(progress.family[f]);
  const totalWeight = FAMILIES.reduce((sum, f) => sum + familyWeight(f), 0);

  function reset() {
    const empty = emptyPreflopProgress();
    writeJson(PREFLOP_PROGRESS_KEY, empty);
    setProgress(empty);
  }

  return (
    <div className="page">
      <PreflopHeader current="/preflop/stats" />

      <p className="muted">
        Trafność z ostatnich 20 prób. W trybie „Mieszane” słabsze rodzaje sytuacji losują się częściej (kolumna „szansa”),
        a w każdym trybie częściej dostajesz pozycje, na których się mylisz.
      </p>

      <h2 className="section-title">Rodzaj sytuacji</h2>
      <ul className="stats-list">
        {FAMILIES.map((f) => (
          <StatsRow
            key={f}
            title={FAMILY_NAMES_PL[f]}
            stats={progress.family[f]}
            note={`szansa ${percent(familyWeight(f) / totalWeight)}`}
          />
        ))}
      </ul>

      <h2 className="section-title">Twoja pozycja</h2>
      <ul className="stats-list">
        {POSITIONS.map((p) => (
          <StatsRow key={p} title={p} stats={progress.position[p]} />
        ))}
      </ul>

      <ResetStats onReset={reset} />
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import type { ScenarioId } from '../../core/preflop/data';
import { FAMILY_NAMES_PL, SCENARIO_IDS, SCENARIO_INFO, scenarioGrid } from '../../core/preflop/data';
import { EXAMPLE_SITUATIONS } from '../../core/preflop/situation';
import type { HandClass } from '../../core/range';
import { revealAboveBar } from '../../shared/actionBar';
import { RangeGrid, RangeLegend } from '../../shared/RangeGrid';
import { readJson, writeJson } from '../../shared/storage';
import { SCENARIOS_BY_FAMILY, actionName, cellDetail, legendItems } from './drill';
import { PreflopHeader } from './PreflopHeader';

const SCENARIO_KEY = 'poker-trainer/preflop-browser/v1';

function loadScenario(): ScenarioId {
  const raw = readJson(SCENARIO_KEY);
  return (SCENARIO_IDS as readonly unknown[]).includes(raw) ? (raw as ScenarioId) : 'RFI_UTG';
}

export function RangeBrowser() {
  const [id, setId] = useState<ScenarioId>(loadScenario);
  // The tapped hand stays selected when switching scenarios, so one hand can be compared across spots.
  const [selected, setSelected] = useState<HandClass | null>(null);
  const detailRef = useRef<HTMLElement>(null);
  const detail = selected ? cellDetail(id, selected) : null;

  function choose(next: ScenarioId) {
    setId(next);
    writeJson(SCENARIO_KEY, next);
  }

  // After a tap: bring the start of the explanation into view.
  useEffect(() => {
    if (selected && detailRef.current) revealAboveBar(detailRef.current, null, 160);
  }, [selected]);

  return (
    <div className="page">
      <PreflopHeader current="/preflop/zakresy" />

      <label className="field-label" htmlFor="scenario">
        Sytuacja
      </label>
      <select id="scenario" className="select-field" value={id} onChange={(e) => choose(e.target.value as ScenarioId)}>
        {SCENARIOS_BY_FAMILY.map(([family, ids]) => (
          <optgroup key={family} label={FAMILY_NAMES_PL[family]}>
            {ids.map((s) => (
              <option key={s} value={s}>
                {SCENARIO_INFO[s].label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      <p className="cell-summary" aria-live="polite">
        {detail ? (
          <>
            <strong>{detail.handClass}</strong>: {detail.actionLabel}
          </>
        ) : (
          'Dotknij ręki, żeby zobaczyć wyjaśnienie'
        )}
      </p>

      <RangeGrid
        cells={scenarioGrid(id)}
        marked={selected}
        onSelect={setSelected}
        describe={(cls, action) => `${cls}: ${actionName(id, action)}`}
      />
      <RangeLegend items={legendItems(id)} showRanges />

      {detail && (
        <section className="explanation cell-detail" ref={detailRef}>
          <h2>
            {detail.handClass} — {detail.explanation.answer}
          </h2>
          <p className="muted">Przykład: {detail.exampleLine}</p>
          {!detail.reachable && (
            <p className="muted">
              Tej ręki nie otwierasz z {EXAMPLE_SITUATIONS[id].hero}, więc w drillu nie trafisz na nią w tej sytuacji.
            </p>
          )}
          {detail.explanation.paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </section>
      )}
    </div>
  );
}

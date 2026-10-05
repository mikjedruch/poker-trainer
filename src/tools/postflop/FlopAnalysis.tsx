import { useEffect, useMemo, useRef, useState } from 'react';
import type { Card } from '../../core/cards';
import { assertDistinct, parseCards } from '../../core/cards';
import { usd } from '../../core/math/format';
import type { ActionCell, HeadsUpAnalysis } from '../../core/postflop/analysis';
import { betShare, heroActionGrid } from '../../core/postflop/analysis';
import { HAND_CATEGORY_NAMES_PL, summarizeRange } from '../../core/postflop/categories';
import { BASELINE_ID, builtInProfile } from '../../core/postflop/profiles';
import { explainTexture, randomTextureFlop } from '../../core/postflop/quiz';
import type { DecisionColumn } from '../../core/postflop/rule';
import { RULE_LABEL_PL, STRATEGY_NAMES_PL, decisionLabel, formatEquity, formatPp } from '../../core/postflop/rule';
import type { FlopSeats, PostflopScenario } from '../../core/postflop/scenarios';
import { POSTFLOP_SCENARIOS, SCENARIO_NAMES_PL, betAmount, headsUpSeats, heroCombos, isHeadsUp, multiwaySeats } from '../../core/postflop/scenarios';
import { SLIDER_MAX_PCT, SLIDER_MIN_PCT, sizingNumbers } from '../../core/postflop/sizing';
import { HEIGHT_NAMES_PL, SUITS_NAMES_PL, flopTexture } from '../../core/postflop/texture';
import type { HandClass } from '../../core/range';
import { createRng, randomSeed } from '../../core/rng';
import { revealAboveBar } from '../../shared/actionBar';
import { CardRow } from '../../shared/PlayingCard';
import { readJson, removeKey, writeJson } from '../../shared/storage';
import { ActionGrid, cellSummary } from './ActionGrid';
import { headsUpAnalyses, measureWorstCase } from './analysisService';
import { CategoryBars } from './CategoryBars';
import type { FlopSlots } from './FlopPicker';
import { FlopPicker } from './FlopPicker';
import { PostflopHeader, ProfileSelect } from './PostflopHeader';
import { useProfiles } from './profileStore';
import { flopSituationLine } from './text';

/** Set by the quiz ("open this flop in the analysis"); read once on entry. */
export const ANALYSIS_REQUEST_KEY = 'poker-trainer/postflop-analysis-request/v1';
const STATE_KEY = 'poker-trainer/postflop-analysis/v1';
const DEFAULT_FLOP = parseCards('Ks 7d 2c');
/** Multiway example in the analysis: CO opens, BTN and BB call. */
const MULTIWAY_EXAMPLE = multiwaySeats('CO', ['BTN', 'BB']);

interface SavedState {
  scenario: PostflopScenario;
  flop: Card[];
}

function validFlop(x: unknown): x is Card[] {
  if (!Array.isArray(x) || x.length !== 3 || !x.every((c) => Number.isInteger(c) && c >= 0 && c < 52)) return false;
  try {
    assertDistinct(x as Card[]);
    return true;
  } catch {
    return false;
  }
}

function loadState(): SavedState {
  for (const key of [ANALYSIS_REQUEST_KEY, STATE_KEY]) {
    const raw = readJson(key) as Partial<SavedState> | null;
    if (key === ANALYSIS_REQUEST_KEY) removeKey(key);
    if (raw && (POSTFLOP_SCENARIOS as readonly unknown[]).includes(raw.scenario) && validFlop(raw.flop)) {
      return { scenario: raw.scenario!, flop: raw.flop };
    }
  }
  return { scenario: 'P1', flop: DEFAULT_FLOP };
}

const pctText = (x: number) => `${(x * 100).toFixed(1)}%`;

export function FlopAnalysis() {
  const { active } = useProfiles();
  const initial = useMemo(loadState, []);
  const [scenario, setScenario] = useState<PostflopScenario>(initial.scenario);
  const [slots, setSlots] = useState<FlopSlots>([initial.flop[0]!, initial.flop[1]!, initial.flop[2]!]);
  const [analyses, setAnalyses] = useState<HeadsUpAnalysis[] | null>(null);
  const [computing, setComputing] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<HandClass | null>(null);
  const [sizePct, setSizePct] = useState(66);
  const [bench, setBench] = useState<string | null>(null);
  const request = useRef(0);
  const detailRef = useRef<HTMLElement>(null);

  const flop = slots.every((c) => c !== null) ? (slots as Card[]) : null;
  const flopKey = flop ? flop.join(',') : '';
  const baseline = builtInProfile(BASELINE_ID);
  const compare = active.id !== BASELINE_ID;
  const seats: FlopSeats = isHeadsUp(scenario) ? headsUpSeats(scenario) : MULTIWAY_EXAMPLE;

  useEffect(() => {
    if (flop) writeJson(STATE_KEY, { scenario, flop });
    const id = ++request.current;
    setAnalyses(null);
    setError(null);
    if (!flop || !isHeadsUp(scenario)) {
      setComputing(null);
      return;
    }
    setComputing(0);
    const profiles = compare ? [baseline, active] : [active];
    headsUpAnalyses(scenario, flop, profiles, (f) => {
      if (request.current === id) setComputing(f);
    })
      .then((list) => {
        if (request.current !== id) return;
        setAnalyses(list);
        setComputing(null);
      })
      .catch(() => {
        if (request.current !== id) return;
        setError('Nie udało się policzyć analizy.');
        setComputing(null);
      });
  }, [scenario, flopKey, active]);

  const texture = flop ? flopTexture(flop) : null;
  const main = analyses ? analyses[analyses.length - 1]! : null;
  const base = analyses && compare ? analyses[0]! : null;

  const column: DecisionColumn | null = !isHeadsUp(scenario) ? 'multiway' : main ? main.strategy.strategy : null;
  const grid = useMemo(
    () => (flop && column ? heroActionGrid(seats.hero, flop, column, { callsTooMuch: active.callsTooMuch, inPosition: seats.inPosition }) : null),
    [flopKey, column, active, scenario],
  );
  const baseGrid = useMemo(
    () => (flop && base ? heroActionGrid(seats.hero, flop, base.strategy.strategy, { callsTooMuch: baseline.callsTooMuch, inPosition: seats.inPosition }) : null),
    [flopKey, base, scenario],
  );
  const changed = baseGrid ? (cell: ActionCell, r: number, c: number) => cell.bets !== baseGrid[r]![c]!.bets : undefined;
  const share = grid ? betShare(grid) : null;
  const detail = grid && selected ? grid.flat().find((c) => c.handClass === selected) ?? null : null;
  const heroSummary = !isHeadsUp(scenario) && flop ? summarizeRange(heroCombos(seats.hero, flop), flop) : main?.hero ?? null;

  useEffect(() => {
    if (selected && detailRef.current) revealAboveBar(detailRef.current, null, 160);
  }, [selected]);

  const s = sizePct / 100;
  const sizing = sizingNumbers(s);
  const sliderBet = betAmount(seats.pot, s);

  async function runBenchmark() {
    setBench('Mierzę…');
    try {
      const ms = await measureWorstCase();
      setBench(`Najcięższa analiza (BTN open 474 kombinacje vs obrona BB loose-live 648) trwała ${(ms / 1000).toFixed(2)} s na tym urządzeniu.`);
    } catch {
      setBench('Pomiar się nie udał.');
    }
  }

  return (
    <div className="page postflop">
      <PostflopHeader current="/postflop/analiza" />

      <label className="field-label" htmlFor="postflop-scenario">
        Sytuacja
      </label>
      <select
        id="postflop-scenario"
        className="select-field"
        value={scenario}
        onChange={(e) => setScenario(e.target.value as PostflopScenario)}
      >
        {POSTFLOP_SCENARIOS.map((id) => (
          <option key={id} value={id}>
            {SCENARIO_NAMES_PL[id]}
          </option>
        ))}
      </select>

      <ProfileSelect />

      <FlopPicker slots={slots} onChange={setSlots} onRandom={() => setSlots(randomTextureFlop(createRng(randomSeed())) as FlopSlots)} />

      {!flop && <p className="muted">Wybierz trzy karty albo wylosuj flop.</p>}

      {flop && texture && (
        <section className="explanation">
          <h2>Tekstura</h2>
          <div className="spot-view">
            <span className="pill">{SUITS_NAMES_PL[texture.suits]}</span>
            <span className="pill">{HEIGHT_NAMES_PL[texture.height]}</span>
            {texture.paired && <span className="pill">sparowany</span>}
            <span className="pill">{texture.wet ? 'mokry' : 'suchy'}</span>
          </div>
          {explainTexture(flop, texture).map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </section>
      )}

      {flop && computing !== null && (
        <section className="explanation" role="status">
          <h2>Liczę equity zakresów…</h2>
          <div className="bar" aria-hidden="true">
            <div className="bar-fill" style={{ width: `${Math.round(computing * 100)}%` }} />
          </div>
          <p className="muted">Wszystkie turny i rivery, każda para rąk bez wspólnych kart.</p>
        </section>
      )}
      {error && <p className="field-error">{error}</p>}

      {flop && isHeadsUp(scenario) && main && (
        <section className="explanation">
          <h2>Strategia ({RULE_LABEL_PL})</h2>
          <p className="muted">{flopSituationLine(seats)}</p>
          <table className="compare-table">
            <thead>
              <tr>
                <th />
                {base && <th>{baseline.name}</th>}
                <th>{active.name}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th>E (equity zakresu)</th>
                {base && <td>{formatEquity(base.strategy.equityPct)}</td>}
                <td>{formatEquity(main.strategy.equityPct)}</td>
              </tr>
              <tr>
                <th>N (silne ręce)</th>
                {base && <td>{formatPp(base.strategy.nutPp)}</td>}
                <td>{formatPp(main.strategy.nutPp)}</td>
              </tr>
              <tr>
                <th>Strategia</th>
                {base && <td>{STRATEGY_NAMES_PL[base.strategy.strategy]}</td>}
                <td>
                  <strong>{STRATEGY_NAMES_PL[main.strategy.strategy]}</strong>
                </td>
              </tr>
            </tbody>
          </table>
          {main.strategy.reasons.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
          <p className="muted">
            E: dokładne equity Twojego zakresu przeciw zakresowi przeciwnika. N: % silnych rąk u Ciebie minus % u przeciwnika. Reguła jest
            heurystyką; liczby są dokładne.
          </p>
        </section>
      )}

      {flop && heroSummary && (isHeadsUp(scenario) ? main : true) && (
        <section className="explanation">
          <h2>Rozkład rąk</h2>
          <CategoryBars
            series={[
              { label: `Ty (${seats.hero})`, summary: heroSummary, tone: 'hero' },
              ...(main ? [{ label: `Przeciwnik · ${active.name}`, summary: main.villain, tone: 'villain' as const }] : []),
              ...(base ? [{ label: `Przeciwnik · ${baseline.name}`, summary: base.villain, tone: 'villain-alt' as const }] : []),
            ]}
          />
          {!isHeadsUp(scenario) && (
            <p className="muted">Multiway ({flopSituationLine(seats)}): tylko reguła z tabeli, bez obliczeń zakresów przeciwników.</p>
          )}
        </section>
      )}

      {flop && grid && share && column && (
        <section className="explanation">
          <h2>Twoje decyzje: {column === 'multiway' ? 'multiway, bet 1/2 puli' : STRATEGY_NAMES_PL[column].toLowerCase()}</h2>
          <p className="cell-summary" aria-live="polite">
            {detail ? cellSummary(detail) : 'Dotknij ręki, żeby zobaczyć kombinacje'}
          </p>
          <ActionGrid grid={grid} marked={selected} onSelect={setSelected} changed={changed} />
          <ul className="range-legend">
            <li>
              <span className="legend-swatch bet" aria-hidden="true" />
              <span className="legend-label">Bet</span>
              <span className="legend-value">
                {share.bets} komb. · {pctText(share.combos ? share.bets / share.combos : 0)} zakresu
              </span>
            </li>
            <li>
              <span className="legend-swatch check" aria-hidden="true" />
              <span className="legend-label">Check</span>
              <span className="legend-value">{share.combos - share.bets} komb.</span>
            </li>
            <li>
              <span className="legend-swatch out" aria-hidden="true" />
              <span className="legend-label">Poza zakresem openu</span>
            </li>
            {changed && (
              <li>
                <span className="legend-swatch changed" aria-hidden="true" />
                <span className="legend-label">Inna decyzja niż przeciw baseline</span>
              </li>
            )}
          </ul>
        </section>
      )}

      {detail && detail.combos.length > 0 && (
        <section className="explanation cell-detail" ref={detailRef}>
          <h2>{detail.handClass}</h2>
          <ul className="combo-list">
            {detail.combos.map((x) => (
              <li key={`${x.combo[0]}-${x.combo[1]}`}>
                <CardRow cards={x.combo} size="sm" />
                <div>
                  <strong>
                    {HAND_CATEGORY_NAMES_PL[x.hand.category]} → {decisionLabel(x.decision)}
                  </strong>
                  <div className="muted">{x.hand.reason}</div>
                </div>
              </li>
            ))}
          </ul>
          <p>{detail.combos[0]!.decision.reasons[0]}</p>
        </section>
      )}

      <section className="explanation">
        <h2>Rozmiar betu</h2>
        <label className="field-label" htmlFor="bet-size">
          Bet {sizePct}% puli = {usd(sliderBet)} do puli {usd(seats.pot)}
        </label>
        <input
          id="bet-size"
          className="slider"
          type="range"
          min={SLIDER_MIN_PCT}
          max={SLIDER_MAX_PCT}
          step={1}
          value={sizePct}
          onChange={(e) => setSizePct(Number(e.target.value))}
        />
        <dl className="sizing-numbers">
          <div>
            <dt>Blefy w betach (max)</dt>
            <dd>{pctText(sizing.bluffShare)}</dd>
          </div>
          <div>
            <dt>MDF przeciwnika</dt>
            <dd>{pctText(sizing.mdf)}</dd>
          </div>
          <div>
            <dt>Equity do calla</dt>
            <dd>{pctText(sizing.callEquity)}</dd>
          </div>
        </dl>
        <p className="muted">
          s / (1 + 2s), 1 / (1 + s) i s / (1 + 2s) dla s = {s.toFixed(2)}. Equity potrzebne do calla to ta sama liczba co odsetek blefów:
          przy takim miksie call przeciwnika jest na zero.
        </p>
      </section>

      <section className="explanation">
        <h2>Szybkość</h2>
        <button className="btn secondary wide" onClick={runBenchmark}>
          Zmierz szybkość analizy
        </button>
        {bench && <p>{bench}</p>}
      </section>
    </div>
  );
}

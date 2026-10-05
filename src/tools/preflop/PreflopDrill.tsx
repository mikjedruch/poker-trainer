import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Action } from '../../core/preflop/data';
import { SCENARIO_INFO, scenarioGrid } from '../../core/preflop/data';
import { explainSpot } from '../../core/preflop/explain';
import type { PreflopSpot } from '../../core/preflop/situation';
import { createRng, randomSeed } from '../../core/rng';
import { revealAboveBar, useElementHeight, useTapGuard } from '../../shared/actionBar';
import { CardRow } from '../../shared/PlayingCard';
import { PokerTable } from '../../shared/PokerTable';
import { RangeGrid, RangeLegend } from '../../shared/RangeGrid';
import { readJson, writeJson } from '../../shared/storage';
import type { DrillMode, Grade } from './drill';
import { DRILL_MODES, MODE_NAMES, gradeAnswer, isDrillMode, legendItems, newSpot, situationLine } from './drill';
import { PreflopHeader } from './PreflopHeader';
import type { PreflopProgress } from './progress';
import { PREFLOP_PROGRESS_KEY, recordPreflop, sanitizePreflopProgress } from './progress';

const MODE_KEY = 'poker-trainer/preflop-mode/v1';

function loadMode(): DrillMode {
  const raw = readJson(MODE_KEY);
  return isDrillMode(raw) ? raw : 'mixed';
}

const drawSpot = (mode: DrillMode, progress: PreflopProgress): PreflopSpot => newSpot(mode, progress, createRng(randomSeed()));

export function PreflopDrill() {
  const [progress, setProgress] = useState<PreflopProgress>(() => sanitizePreflopProgress(readJson(PREFLOP_PROGRESS_KEY)));
  const [mode, setMode] = useState<DrillMode>(loadMode);
  const [spot, setSpot] = useState<PreflopSpot>(() => drawSpot(mode, progress));
  const [grade, setGrade] = useState<Grade | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const revealRef = useRef<HTMLDivElement>(null);
  const barHeight = useElementHeight(barRef);
  const guard = useTapGuard();

  function submit(action: Action) {
    if (grade || !guard.ready()) return;
    guard.arm();
    const result = gradeAnswer(spot, action);
    const updated = recordPreflop(progress, spot.situation.family, spot.situation.hero, result.correct);
    setProgress(updated);
    writeJson(PREFLOP_PROGRESS_KEY, updated);
    setGrade(result);
  }

  function showSpot(nextMode: DrillMode) {
    guard.arm();
    setSpot(drawSpot(nextMode, progress));
    setGrade(null);
    window.scrollTo(0, 0);
  }

  function next() {
    if (guard.ready()) showSpot(mode);
  }

  function changeMode(m: DrillMode) {
    setMode(m);
    writeJson(MODE_KEY, m);
    showSpot(m);
  }

  // Physical keyboard (desktop): 1–3 pick an answer button, Enter goes to the next hand.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (grade) {
        if (e.key === 'Enter') {
          e.preventDefault();
          next();
        }
        return;
      }
      const option = spot.options[Number(e.key) - 1];
      if (option) {
        e.preventDefault();
        submit(option.action);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  // After answering: make sure the verdict and the start of the explanation are on screen.
  useEffect(() => {
    if (grade && revealRef.current) revealAboveBar(revealRef.current, barRef.current);
  }, [grade]);

  const pageStyle = { '--bar-space': `${barHeight}px` } as CSSProperties;
  const explanation = grade ? explainSpot(spot) : null;

  return (
    <div className="page trainer" style={pageStyle}>
      <PreflopHeader current="/preflop" />

      <nav className="mode-picker" aria-label="Rodzaj sytuacji">
        {DRILL_MODES.map((m) => (
          <button key={m} className={mode === m ? 'chip active' : 'chip'} onClick={() => changeMode(m)}>
            {MODE_NAMES[m]}
          </button>
        ))}
      </nav>

      <section className="spot-card">
        <PokerTable heroPosition={spot.situation.hero} seats={spot.seats} pot={spot.pot} />
        <div className="spot-hand">
          <CardRow cards={spot.hand} />
          <p className="spot-history">{situationLine(spot)}</p>
        </div>
      </section>

      {grade && explanation && (
        <div className="reveal" ref={revealRef}>
          <section className={grade.correct ? 'feedback good' : 'feedback bad'}>
            <div className="feedback-title">{grade.correct ? '✓ Dobrze' : '✗ Źle'}</div>
            <div>Twoja odpowiedź: {grade.given.label}</div>
            <div className="feedback-answer">Poprawnie: {grade.answer.label}</div>
          </section>
          <section className="explanation">
            <h2>Wyjaśnienie</h2>
            {explanation.paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </section>
          <section className="explanation">
            <h2>Zakres: {SCENARIO_INFO[spot.scenario].label}</h2>
            <p className="muted grid-note">Twoja ręka ({spot.handClass}) jest obwiedziona.</p>
            <RangeGrid cells={scenarioGrid(spot.scenario)} marked={spot.handClass} />
            <RangeLegend items={legendItems(spot.scenario)} />
          </section>
        </div>
      )}

      <div className="action-bar" ref={barRef}>
        <div className="bar-stack">
          {grade ? (
            <div className="bar-row">
              <div
                className={`answer-display choice ${grade.correct ? 'good' : 'bad'}`}
                role="status"
                aria-label={`${grade.correct ? 'Dobrze' : 'Źle'}: ${grade.given.label}`}
              >
                {grade.correct ? '✓' : '✗'} {grade.given.label}
              </div>
              <button className="btn primary" onClick={next}>
                Dalej →
              </button>
            </div>
          ) : (
            <div className="bar-row">
              {spot.options.map((o) => (
                <button key={o.action} className="btn secondary option" onClick={() => submit(o.action)}>
                  {o.label}
                </button>
              ))}
            </div>
          )}
          <p className="pad-hint">{grade ? 'Enter = Dalej' : `Klawisze 1–${spot.options.length} wybierają odpowiedź`}</p>
        </div>
      </div>
    </div>
  );
}

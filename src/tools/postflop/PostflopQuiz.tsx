import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Card } from '../../core/cards';
import { heroActionGrid } from '../../core/postflop/analysis';
import type { Profile } from '../../core/postflop/profiles';
import type { HandOptionId, TextureAnswer, TextureGrade } from '../../core/postflop/quiz';
import {
  QUIZ_TYPE_NAMES_PL,
  explainHand,
  explainStrategy,
  explainTexture,
  gradeHand,
  gradeStrategy,
  gradeTexture,
} from '../../core/postflop/quiz';
import type { BoardStrategy } from '../../core/postflop/rule';
import { BOARD_STRATEGIES, RULE_LABEL_PL, STRATEGY_NAMES_PL, STRATEGY_SHORT_PL, formatEquity, formatPp } from '../../core/postflop/rule';
import { SIZING_TOLERANCE_PP, isSizingCorrect } from '../../core/postflop/sizing';
import type { Height, Suits } from '../../core/postflop/texture';
import { HEIGHT_NAMES_PL, HEIGHT_VALUES, SUITS_NAMES_PL, SUITS_VALUES } from '../../core/postflop/texture';
import { usd } from '../../core/math/format';
import { handClassOf } from '../../core/range';
import { revealAboveBar, useElementHeight, useTapGuard } from '../../shared/actionBar';
import { NumberPad } from '../../shared/NumberPad';
import type { PadKey } from '../../shared/padInput';
import { applyPadKey, padKeyFromKeyboard } from '../../shared/padInput';
import { CardRow } from '../../shared/PlayingCard';
import { PokerTable } from '../../shared/PokerTable';
import { href } from '../../shared/router';
import { readJson, writeJson } from '../../shared/storage';
import { parseUserNumber } from '../math/answerInput';
import { ActionGrid } from './ActionGrid';
import { CategoryBars } from './CategoryBars';
import { ANALYSIS_REQUEST_KEY } from './FlopAnalysis';
import { PostflopHeader, ProfileSelect } from './PostflopHeader';
import { useProfiles } from './profileStore';
import type { PostflopProgress } from './progress';
import { POSTFLOP_PROGRESS_KEY, recordPostflop, sanitizePostflopProgress } from './progress';
import type { QuizItem, QuizMode } from './quizFlow';
import { QUIZ_MODES, isQuizMode, nextQuizItem, scenarioOfItem } from './quizFlow';
import { flopSituationLine, flopTableSeats, positionNote } from './text';

const MODE_KEY = 'poker-trainer/postflop-mode/v1';

const MODE_NAMES: Readonly<Record<QuizMode, string>> = {
  mixed: 'Mieszane',
  texture: 'Tekstura',
  strategy: 'Strategia',
  hand: 'Ręka',
  sizing: 'Sizing',
};

function loadMode(): QuizMode {
  const raw = readJson(MODE_KEY);
  return isQuizMode(raw) ? raw : 'mixed';
}

type Result =
  | { kind: 'texture'; correct: boolean; grade: TextureGrade; given: TextureAnswer }
  | { kind: 'choice'; correct: boolean; given: string; answer: string }
  | { kind: 'sizing'; correct: boolean; given: string; answer: string };

function BoardRow({ label, cards }: { label: string; cards: readonly Card[] }) {
  return (
    <div className="hand-block">
      <span className="hand-label">{label}</span>
      <CardRow cards={cards} />
    </div>
  );
}

/** One row of the texture answer: label + options; after checking, right/wrong are marked. */
function ChoiceRow<T extends string>({
  label,
  options,
  value,
  correct,
  onPick,
}: {
  label: string;
  options: ReadonlyArray<readonly [T, string]>;
  value: T | undefined;
  correct: T | null;
  onPick: (v: T) => void;
}) {
  return (
    <div className="choice-row">
      <span className="choice-label">{label}</span>
      <div className="segmented">
        {options.map(([v, text]) => {
          let state = '';
          if (correct !== null) {
            if (v === correct) state = v === value ? 'good' : 'answer';
            else if (v === value) state = 'bad';
          }
          return (
            <button
              key={v}
              type="button"
              className={state}
              aria-pressed={v === value}
              disabled={correct !== null}
              onClick={() => onPick(v)}
            >
              {text}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const SUITS_OPTIONS = SUITS_VALUES.map((s) => [s, SUITS_NAMES_PL[s]] as const);
const HEIGHT_OPTIONS = HEIGHT_VALUES.map((h) => [h, HEIGHT_NAMES_PL[h]] as const);
const WET_OPTIONS = [
  ['dry', 'suchy'],
  ['wet', 'mokry'],
] as const;

export function PostflopQuiz() {
  const { active: profile } = useProfiles();
  const [progress, setProgress] = useState<PostflopProgress>(() => sanitizePostflopProgress(readJson(POSTFLOP_PROGRESS_KEY)));
  const [mode, setMode] = useState<QuizMode>(loadMode);
  const [item, setItem] = useState<QuizItem | null>(null);
  const [loading, setLoading] = useState<number | null>(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [tex, setTex] = useState<Partial<TextureAnswer>>({});
  const [input, setInput] = useState('');
  const request = useRef(0);
  const prefetched = useRef<{ mode: QuizMode; profile: Profile; promise: Promise<QuizItem> } | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const revealRef = useRef<HTMLDivElement>(null);
  const barHeight = useElementHeight(barRef);
  const guard = useTapGuard();

  function load(nextMode: QuizMode, prog: PostflopProgress) {
    const id = ++request.current;
    guard.arm();
    setItem(null);
    setResult(null);
    setTex({});
    setInput('');
    setError(null);
    setLoading(0);
    const pre = prefetched.current;
    prefetched.current = null;
    const promise =
      pre && pre.mode === nextMode && pre.profile === profile
        ? pre.promise
        : nextQuizItem(nextMode, prog, profile, (f) => {
            if (request.current === id) setLoading(f);
          });
    promise
      .then((it) => {
        if (request.current !== id) return;
        setItem(it);
        setLoading(null);
        window.scrollTo(0, 0);
      })
      .catch(() => {
        if (request.current !== id) return;
        setError('Nie udało się przygotować zadania.');
        setLoading(null);
      });
  }

  // New task on entry and whenever the active profile changes.
  useEffect(() => {
    load(mode, progress);
  }, [profile]);

  function finish(correct: boolean, r: Result) {
    if (!item) return;
    const updated = recordPostflop(progress, item.type, scenarioOfItem(item), correct);
    setProgress(updated);
    writeJson(POSTFLOP_PROGRESS_KEY, updated);
    setResult(r);
    // Prepare the next task while the explanation is being read (worker results take a moment).
    const promise = nextQuizItem(mode, updated, profile);
    promise.catch(() => undefined);
    prefetched.current = { mode, profile, promise };
  }

  function canAnswer(): boolean {
    if (!item || result || !guard.ready()) return false;
    guard.arm();
    return true;
  }

  function answerStrategy(s: BoardStrategy) {
    if (item?.type !== 'strategy' || !canAnswer()) return;
    const correct = gradeStrategy(item.analysis, s);
    finish(correct, { kind: 'choice', correct, given: STRATEGY_SHORT_PL[s], answer: STRATEGY_NAMES_PL[item.analysis.strategy.strategy] });
  }

  function answerHand(id: HandOptionId) {
    if (item?.type !== 'hand' || !canAnswer()) return;
    const spot = item.spot;
    const correct = gradeHand(spot, id);
    const label = (x: HandOptionId) => spot.options.find((o) => o.id === x)!.label;
    finish(correct, { kind: 'choice', correct, given: label(id), answer: label(spot.correct) });
  }

  function answerTexture() {
    if (item?.type !== 'texture' || tex.suits === undefined || tex.height === undefined || tex.wet === undefined) return;
    if (!canAnswer()) return;
    const given: TextureAnswer = { suits: tex.suits, height: tex.height, wet: tex.wet };
    const grade = gradeTexture(item.flop, given);
    finish(grade.correct, { kind: 'texture', correct: grade.correct, grade, given });
  }

  const typed = parseUserNumber(input);
  function answerSizing() {
    if (item?.type !== 'sizing' || typed === null || !canAnswer()) return;
    const correct = isSizingCorrect(item.task, typed);
    finish(correct, { kind: 'sizing', correct, given: `${typed}%`, answer: `${item.task.answerPct.toFixed(1)}%` });
  }

  function next() {
    if (guard.ready()) load(mode, progress);
  }

  function changeMode(m: QuizMode) {
    setMode(m);
    writeJson(MODE_KEY, m);
    prefetched.current = null;
    load(m, progress);
  }

  function pressKey(key: PadKey) {
    setInput((t) => applyPadKey(t, key, { decimals: true }));
  }

  // Physical keyboard: 1–3 pick an option, digits type the sizing answer, Enter checks / goes on.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey || !item) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (result) {
        if (e.key === 'Enter') {
          e.preventDefault();
          next();
        }
        return;
      }
      if (item.type === 'sizing') {
        const key = padKeyFromKeyboard(e.key);
        if (key) {
          e.preventDefault();
          pressKey(key);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          answerSizing();
        }
        return;
      }
      if (item.type === 'texture') {
        if (e.key === 'Enter') answerTexture();
        return;
      }
      const n = Number(e.key);
      if (!Number.isInteger(n) || n < 1) return;
      if (item.type === 'strategy' && BOARD_STRATEGIES[n - 1]) answerStrategy(BOARD_STRATEGIES[n - 1]!);
      if (item.type === 'hand' && item.spot.options[n - 1]) answerHand(item.spot.options[n - 1]!.id);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  useEffect(() => {
    if (result && revealRef.current) revealAboveBar(revealRef.current, barRef.current);
  }, [result]);

  function openInAnalysis(scenario: string, flop: readonly Card[]) {
    writeJson(ANALYSIS_REQUEST_KEY, { scenario, flop });
    window.location.hash = href('/postflop/analiza');
  }

  const pageStyle = { '--bar-space': `${barHeight}px` } as CSSProperties;

  return (
    <div className="page trainer postflop" style={pageStyle}>
      <PostflopHeader current="/postflop" />

      <nav className="mode-picker" aria-label="Rodzaj zadań">
        {QUIZ_MODES.map((m) => (
          <button key={m} className={mode === m ? 'chip active' : 'chip'} onClick={() => changeMode(m)}>
            {MODE_NAMES[m]}
          </button>
        ))}
      </nav>

      {(mode === 'mixed' || mode === 'strategy' || mode === 'hand') && <ProfileSelect compact />}

      {!item && (
        <section className="task-card">
          {error ? (
            <>
              <p>{error}</p>
              <button className="btn secondary" onClick={() => load(mode, progress)}>
                Spróbuj ponownie
              </button>
            </>
          ) : (
            <div className="loading" role="status">
              <span>Liczę zakresy…</span>
              <div className="bar" aria-hidden="true">
                <div className="bar-fill" style={{ width: `${Math.round((loading ?? 0) * 100)}%` }} />
              </div>
            </div>
          )}
        </section>
      )}

      {item && (
        <section className="task-card spot-card">
          <div className="task-type">{QUIZ_TYPE_NAMES_PL[item.type]}</div>

          {item.type === 'texture' && (
            <>
              <BoardRow label="Flop" cards={item.flop} />
              <p className="question">Opisz flop: kolory, wysokość i czy jest suchy, czy mokry.</p>
            </>
          )}

          {item.type === 'strategy' && (
            <>
              <BoardRow label="Flop" cards={item.analysis.flop} />
              <p className="spot-history">
                {flopSituationLine(item.seats)} · {positionNote(item.seats)}
              </p>
              <p className="muted">
                Przeciwnik: {item.profile.name} — {item.profile.assumptions}
              </p>
              <p className="question">Jaką strategię c-betu wybierasz dla całego zakresu?</p>
              <PokerTable heroPosition={item.seats.hero} seats={flopTableSeats(item.seats)} pot={item.seats.pot} />
            </>
          )}

          {item.type === 'hand' && (
            <>
              <div className="board-pair">
                <BoardRow label="Flop" cards={item.spot.flop} />
                <BoardRow label="Twoja ręka" cards={item.spot.hand} />
              </div>
              <p className="spot-history">
                {flopSituationLine(item.spot.seats)} · {positionNote(item.spot.seats)}
              </p>
              <p className="muted">
                {item.spot.analysis
                  ? `Strategia zakresu (${RULE_LABEL_PL}): ${STRATEGY_SHORT_PL[item.spot.analysis.strategy.strategy].toLowerCase()} · ${item.profile.name}`
                  : 'Multiway: reguła bez obliczeń zakresów'}
              </p>
              <p className="question">Bet czy check — i za ile?</p>
              <PokerTable heroPosition={item.spot.seats.hero} seats={flopTableSeats(item.spot.seats)} pot={item.spot.seats.pot} />
            </>
          )}

          {item.type === 'sizing' && (
            <>
              <div className="spot-view">
                <span className="pill">Pula {usd(item.task.pot)}</span>
                <span className="pill">Bet {usd(item.task.bet)}</span>
              </div>
              <p className="question">{item.task.prompt}</p>
              <p className="muted">Odpowiedź w procentach, tolerancja ±{SIZING_TOLERANCE_PP} pp.</p>
            </>
          )}
        </section>
      )}

      {item && result && (
        <div className="reveal" ref={revealRef}>
          <section className={result.correct ? 'feedback good' : 'feedback bad'}>
            <div className="feedback-title">{result.correct ? '✓ Dobrze' : '✗ Źle'}</div>
            {result.kind !== 'texture' && (
              <>
                <div>Twoja odpowiedź: {result.given}</div>
                <div className="feedback-answer">Poprawnie: {result.answer}</div>
              </>
            )}
            {result.kind === 'texture' && (
              <div className="feedback-answer">
                Poprawnie: {SUITS_NAMES_PL[result.grade.texture.suits]}, {HEIGHT_NAMES_PL[result.grade.texture.height]},{' '}
                {result.grade.texture.wet ? 'mokry' : 'suchy'}
              </div>
            )}
          </section>

          {item.type === 'texture' && (
            <section className="explanation">
              <h2>Wyjaśnienie</h2>
              {explainTexture(item.flop, result.kind === 'texture' ? result.grade.texture : undefined).map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </section>
          )}

          {item.type === 'strategy' && (
            <>
              <section className="explanation">
                <h2>Wyjaśnienie</h2>
                {explainStrategy(item.analysis).map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
                <p className="formula">
                  E = {formatEquity(item.analysis.strategy.equityPct)} · N = {formatPp(item.analysis.strategy.nutPp)}
                </p>
              </section>
              <section className="explanation">
                <h2>Rozkład rąk na flopie</h2>
                <CategoryBars
                  series={[
                    { label: `Ty (${item.seats.hero})`, summary: item.analysis.hero, tone: 'hero' },
                    { label: `${item.seats.opponents[0]} · ${item.profile.name}`, summary: item.analysis.villain, tone: 'villain' },
                  ]}
                />
                <button className="btn secondary wide" onClick={() => openInAnalysis(item.seats.scenario, item.analysis.flop)}>
                  Otwórz ten flop w analizie
                </button>
              </section>
            </>
          )}

          {item.type === 'hand' && (
            <section className="explanation">
              <h2>Wyjaśnienie</h2>
              {explainHand(item.spot).map((line, i) => (
                <p key={i}>{line}</p>
              ))}
              <p className="muted grid-note">
                Twoje decyzje z całym zakresem na tym flopie (czerwone = bet, jasne = check). Twoja ręka ({handClassOf(item.spot.hand)}) jest
                obwiedziona.
              </p>
              <ActionGrid
                grid={heroActionGrid(item.spot.seats.hero, item.spot.flop, item.spot.column, item.spot.ctx)}
                marked={handClassOf(item.spot.hand)}
              />
            </section>
          )}

          {item.type === 'sizing' && (
            <section className="explanation">
              <h2>Wyjaśnienie</h2>
              {item.task.formulas.map((f, i) => (
                <p key={i} className="formula">
                  {f}
                </p>
              ))}
              {item.task.explanation.map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </section>
          )}
        </div>
      )}

      <div className="action-bar" ref={barRef}>
        <div className="bar-stack">
          {item?.type === 'texture' && (
            <div className="texture-answer">
              <ChoiceRow<Suits>
                label="Kolory"
                options={SUITS_OPTIONS}
                value={tex.suits}
                correct={result?.kind === 'texture' ? result.grade.texture.suits : null}
                onPick={(suits) => setTex((t) => ({ ...t, suits }))}
              />
              <ChoiceRow<Height>
                label="Wysokość"
                options={HEIGHT_OPTIONS}
                value={tex.height}
                correct={result?.kind === 'texture' ? result.grade.texture.height : null}
                onPick={(height) => setTex((t) => ({ ...t, height }))}
              />
              <ChoiceRow<'dry' | 'wet'>
                label="Tekstura"
                options={WET_OPTIONS}
                value={tex.wet === undefined ? undefined : tex.wet ? 'wet' : 'dry'}
                correct={result?.kind === 'texture' ? (result.grade.texture.wet ? 'wet' : 'dry') : null}
                onPick={(w) => setTex((t) => ({ ...t, wet: w === 'wet' }))}
              />
            </div>
          )}

          {result ? (
            <div className="bar-row">
              {result.kind !== 'texture' && (
                <div className={`answer-display choice ${result.correct ? 'good' : 'bad'}`} role="status">
                  {result.correct ? '✓' : '✗'} {result.given}
                </div>
              )}
              <button className="btn primary" onClick={next}>
                Dalej →
              </button>
            </div>
          ) : item?.type === 'texture' ? (
            <div className="bar-row">
              <button
                className="btn primary"
                disabled={tex.suits === undefined || tex.height === undefined || tex.wet === undefined}
                onClick={answerTexture}
              >
                Sprawdź
              </button>
            </div>
          ) : item?.type === 'strategy' ? (
            <div className="bar-row">
              {BOARD_STRATEGIES.map((s) => (
                <button key={s} className="btn secondary option" onClick={() => answerStrategy(s)}>
                  {STRATEGY_SHORT_PL[s]}
                </button>
              ))}
            </div>
          ) : item?.type === 'hand' ? (
            <div className="bar-row">
              {item.spot.options.map((o) => (
                <button key={o.id} className="btn secondary option" onClick={() => answerHand(o.id)}>
                  {o.label}
                </button>
              ))}
            </div>
          ) : item?.type === 'sizing' ? (
            <div className="number-pad">
              <NumberPad onKey={pressKey} decimals />
              <div className="bar-row">
                <div className="answer-display" aria-label="Twoja odpowiedź" aria-live="polite">
                  <span className="answer-value">
                    {input}
                    <span className="caret" aria-hidden="true" />
                    {input === '' && <span className="placeholder">np. 28.6</span>}
                  </span>
                  <span className="affix">%</span>
                </div>
                <button className="btn primary" disabled={typed === null} onClick={answerSizing}>
                  Sprawdź
                </button>
              </div>
            </div>
          ) : null}
          {item && (
            <p className="pad-hint">
              {result
                ? 'Enter = Dalej'
                : item.type === 'sizing'
                  ? 'Wpisz z klawiatury, Enter = Sprawdź'
                  : item.type === 'texture'
                    ? 'Wybierz w każdym rzędzie, Enter = Sprawdź'
                    : 'Klawisze 1–3 wybierają odpowiedź'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

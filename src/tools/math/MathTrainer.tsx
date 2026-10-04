import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { AnswerCheck, Task, TaskType, UserAnswer } from '../../core/math/tasks';
import { TASK_INFO, TASK_TYPES, checkAnswer, generateTask } from '../../core/math/tasks';
import { createRng, randomSeed } from '../../core/rng';
import { readJson, writeJson } from '../../shared/storage';
import { href } from '../../shared/router';
import { NumberPad } from '../../shared/NumberPad';
import type { PadKey } from '../../shared/padInput';
import { applyPadKey, padKeyFromKeyboard } from '../../shared/padInput';
import { revealAboveBar, useElementHeight, useTapGuard } from '../../shared/actionBar';
import { parseUserNumber } from './answerInput';
import { Explanation, HandView, SpotView } from './TaskViews';
import type { Progress } from './progress';
import { PROGRESS_KEY, pickWeightedType, recordResult, sanitizeProgress } from './progress';

type Mode = 'mixed' | TaskType;
const MODE_KEY = 'poker-trainer/math-mode/v1';

const SHORT_NAMES: Record<TaskType, string> = {
  outs: 'Outy',
  equity: 'Equity',
  potOdds: 'Pot odds',
  callFold: 'Call/fold',
  mdf: 'MDF',
  bluff: 'Bluff',
  implied: 'Implied',
};

function loadMode(): Mode {
  const raw = readJson(MODE_KEY);
  return raw === 'mixed' || TASK_TYPES.includes(raw as TaskType) ? (raw as Mode) : 'mixed';
}

function newTask(mode: Mode, progress: Progress): Task {
  const rng = createRng(randomSeed());
  const type = mode === 'mixed' ? pickWeightedType(progress, rng) : mode;
  return generateTask(type, rng);
}

interface Result {
  check: AnswerCheck;
  given: string;
}

function describeAnswer(task: Task, answer: UserAnswer): string {
  switch (answer.kind) {
    case 'call':
      return 'CALL';
    case 'fold':
      return 'FOLD';
    case 'impossible':
      return 'nie da się';
    case 'number':
      if (task.answer.kind === 'percent') return `${answer.value}%`;
      if (task.answer.kind === 'dollars') return `$${answer.value}`;
      return String(answer.value);
  }
}

const PLACEHOLDERS: Record<Task['answer']['kind'], string> = {
  count: 'liczba outów',
  percent: 'np. 27.5',
  dollars: 'kwota',
  decision: '',
};

export function MathTrainer() {
  const [progress, setProgress] = useState<Progress>(() => sanitizeProgress(readJson(PROGRESS_KEY)));
  const [mode, setMode] = useState<Mode>(loadMode);
  const [task, setTask] = useState<Task>(() => newTask(mode, progress));
  const [input, setInput] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const revealRef = useRef<HTMLDivElement>(null);
  const barHeight = useElementHeight(barRef);
  const guard = useTapGuard();

  const kind = task.answer.kind;
  const decimals = kind === 'percent';
  const typed = parseUserNumber(input);

  function submit(answer: UserAnswer) {
    if (result || !guard.ready()) return;
    guard.arm();
    const check = checkAnswer(task, answer);
    const updated = recordResult(progress, task.type, check.correct);
    setProgress(updated);
    writeJson(PROGRESS_KEY, updated);
    setResult({ check, given: describeAnswer(task, answer) });
  }

  function showTask(nextMode: Mode) {
    guard.arm();
    setTask(newTask(nextMode, progress));
    setInput('');
    setResult(null);
    window.scrollTo(0, 0);
  }

  function next() {
    if (guard.ready()) showTask(mode);
  }

  function changeMode(m: Mode) {
    setMode(m);
    writeJson(MODE_KEY, m);
    showTask(m);
  }

  function pressKey(key: PadKey) {
    setInput((text) => applyPadKey(text, key, { decimals }));
  }

  function submitTyped() {
    if (typed !== null) submit({ kind: 'number', value: typed });
  }

  // Physical keyboard (desktop): digits, comma/point, Backspace, Enter.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (result) {
        if (e.key === 'Enter') {
          e.preventDefault();
          next();
        }
        return;
      }
      if (kind === 'decision') return;
      const key = padKeyFromKeyboard(e.key);
      if (key) {
        e.preventDefault();
        pressKey(key);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        submitTyped();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  // After answering: make sure the verdict and the start of the explanation are on screen.
  useEffect(() => {
    if (result && revealRef.current) revealAboveBar(revealRef.current, barRef.current);
  }, [result]);

  const info = TASK_INFO[task.type];
  const pageStyle = { '--bar-space': `${barHeight}px` } as CSSProperties;

  return (
    <div className="page trainer" style={pageStyle}>
      <header className="topbar">
        <a className="topbar-link back" href={href('/')} aria-label="Wróć do menu">
          ←
        </a>
        <h1>Matematyka</h1>
        <a className="topbar-link" href={href('/math/stats')}>
          Statystyki
        </a>
      </header>

      <nav className="mode-picker" aria-label="Typ zadań">
        <button className={mode === 'mixed' ? 'chip active' : 'chip'} onClick={() => changeMode('mixed')}>
          Mieszane
        </button>
        {TASK_TYPES.map((t) => (
          <button key={t} className={mode === t ? 'chip active' : 'chip'} onClick={() => changeMode(t)}>
            {TASK_INFO[t].number}. {SHORT_NAMES[t]}
          </button>
        ))}
      </nav>

      <section className="task-card">
        <div className="task-type">
          {info.number}. {info.title}
        </div>
        {task.hand && <HandView hand={task.hand} />}
        {task.spot && <SpotView spot={task.spot} showStack={task.type === 'callFold' || task.type === 'implied'} />}
        <p className="question">{task.question}</p>
      </section>

      {result && (
        <div className="reveal" ref={revealRef}>
          <section className={result.check.correct ? 'feedback good' : 'feedback bad'}>
            <div className="feedback-title">{result.check.correct ? '✓ Dobrze' : '✗ Źle'}</div>
            <div>Twoja odpowiedź: {result.given}</div>
            <div className="feedback-answer">{result.check.answerText}</div>
          </section>
          <Explanation blocks={task.explanation} />
        </div>
      )}

      <div className="action-bar" ref={barRef}>
        {result ? (
          <div className="bar-row">
            <div
              className={`answer-display choice ${result.check.correct ? 'good' : 'bad'}`}
              role="status"
              aria-label={`${result.check.correct ? 'Dobrze' : 'Źle'}: ${result.given}`}
            >
              {result.check.correct ? '✓' : '✗'} {result.given}
            </div>
            <button className="btn primary" onClick={next}>
              Dalej →
            </button>
          </div>
        ) : kind === 'decision' ? (
          <div className="bar-row">
            <button className="btn secondary choice" onClick={() => submit({ kind: 'fold' })}>
              FOLD
            </button>
            <button className="btn secondary choice" onClick={() => submit({ kind: 'call' })}>
              CALL
            </button>
          </div>
        ) : (
          <div className="number-pad">
            <NumberPad onKey={pressKey} decimals={decimals} />
            <p className="pad-hint">Wpisz z klawiatury, Enter = Sprawdź</p>
            <div className="bar-row">
              <div className="answer-display" aria-label="Twoja odpowiedź" aria-live="polite">
                {kind === 'dollars' && <span className="affix">$</span>}
                <span className="answer-value">
                  {input}
                  <span className="caret" aria-hidden="true" />
                  {input === '' && <span className="placeholder">{PLACEHOLDERS[kind]}</span>}
                </span>
                {kind === 'percent' && <span className="affix">%</span>}
              </div>
              {kind === 'dollars' && (
                <button className="btn secondary" onClick={() => submit({ kind: 'impossible' })}>
                  Nie da się
                </button>
              )}
              <button className="btn primary" disabled={typed === null} onClick={submitTyped}>
                Sprawdź
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

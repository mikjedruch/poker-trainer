import { useState } from 'react';
import type { FormEvent } from 'react';
import type { AnswerCheck, Task, TaskType, UserAnswer } from '../../core/math/tasks';
import { TASK_INFO, TASK_TYPES, checkAnswer, generateTask } from '../../core/math/tasks';
import { createRng, randomSeed } from '../../core/rng';
import { readJson, writeJson } from '../../shared/storage';
import { href } from '../../shared/router';
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

export function MathTrainer() {
  const [progress, setProgress] = useState<Progress>(() => sanitizeProgress(readJson(PROGRESS_KEY)));
  const [mode, setMode] = useState<Mode>(loadMode);
  const [task, setTask] = useState<Task>(() => newTask(mode, progress));
  const [input, setInput] = useState('');
  const [result, setResult] = useState<Result | null>(null);

  const typed = parseUserNumber(input);

  function submit(answer: UserAnswer) {
    if (result) return;
    const check = checkAnswer(task, answer);
    const updated = recordResult(progress, task.type, check.correct);
    setProgress(updated);
    writeJson(PROGRESS_KEY, updated);
    setResult({ check, given: describeAnswer(task, answer) });
  }

  function next(nextMode: Mode = mode) {
    setTask(newTask(nextMode, progress));
    setInput('');
    setResult(null);
    window.scrollTo(0, 0);
  }

  function changeMode(m: Mode) {
    setMode(m);
    writeJson(MODE_KEY, m);
    next(m);
  }

  function onSubmitNumber(e: FormEvent) {
    e.preventDefault();
    if (typed !== null) submit({ kind: 'number', value: typed });
  }

  const info = TASK_INFO[task.type];
  const kind = task.answer.kind;

  return (
    <div className="page trainer">
      <header className="topbar">
        <a className="topbar-link" href={href('/')} aria-label="Wróć do menu">
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
        <section className={result.check.correct ? 'feedback good' : 'feedback bad'} aria-live="polite">
          <div className="feedback-title">{result.check.correct ? '✓ Dobrze' : '✗ Źle'}</div>
          <div>Twoja odpowiedź: {result.given}</div>
          <div className="feedback-answer">{result.check.answerText}</div>
        </section>
      )}
      {result && <Explanation blocks={task.explanation} />}

      <div className="action-bar">
        {result ? (
          <button className="btn primary wide" onClick={() => next()}>
            Następne zadanie →
          </button>
        ) : kind === 'decision' ? (
          <div className="btn-pair">
            <button className="btn danger" onClick={() => submit({ kind: 'fold' })}>
              FOLD
            </button>
            <button className="btn primary" onClick={() => submit({ kind: 'call' })}>
              CALL
            </button>
          </div>
        ) : (
          <form className="answer-form" onSubmit={onSubmitNumber}>
            <label className="answer-field">
              {kind === 'dollars' && <span className="affix">$</span>}
              <input
                inputMode={kind === 'count' ? 'numeric' : 'decimal'}
                enterKeyHint="done"
                autoComplete="off"
                placeholder={kind === 'count' ? 'liczba outów' : kind === 'dollars' ? 'kwota' : 'np. 27.5'}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                aria-label="Twoja odpowiedź"
              />
              {kind === 'percent' && <span className="affix">%</span>}
            </label>
            <button className="btn primary" type="submit" disabled={typed === null}>
              Sprawdź
            </button>
            {kind === 'dollars' && (
              <button className="btn secondary" type="button" onClick={() => submit({ kind: 'impossible' })}>
                Nie da się
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}

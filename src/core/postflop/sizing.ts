import { usd } from '../math/format';
import type { Rng } from '../rng';
import { pick, randomInt } from '../rng';

// Bet sizing: with a bet of s × pot,
//   bluff share  s / (1 + 2s)  — the share of bluffs that makes the opponent's call break even;
//   MDF          1 / (1 + s)   — how often the opponent must continue so a pure bluff does not profit;
//   equity needed to call  s / (1 + 2s)  — the caller's pot odds (the same number as the bluff share).

export interface Fraction {
  num: number;
  den: number;
}

export const SIZING_FRACTIONS: readonly Fraction[] = [
  { num: 1, den: 4 },
  { num: 1, den: 3 },
  { num: 1, den: 2 },
  { num: 2, den: 3 },
  { num: 3, den: 4 },
  { num: 1, den: 1 },
  { num: 3, den: 2 },
  { num: 2, den: 1 },
];

export const SIZING_TOLERANCE_PP = 2;
/** Slider limits in the flop analysis, percent of the pot. */
export const SLIDER_MIN_PCT = 10;
export const SLIDER_MAX_PCT = 200;

export const bluffShare = (s: number): number => s / (1 + 2 * s);
export const minimumDefense = (s: number): number => 1 / (1 + s);
export const callEquityNeeded = (s: number): number => s / (1 + 2 * s);

export interface SizingNumbers {
  bluffShare: number;
  mdf: number;
  callEquity: number;
}

export const sizingNumbers = (s: number): SizingNumbers => ({
  bluffShare: bluffShare(s),
  mdf: minimumDefense(s),
  callEquity: callEquityNeeded(s),
});

/** Size as the object of "Betujesz …": "1/3 puli", "pulę", "1.5× pulę", "2× pulę". */
export function fractionText(f: Fraction): string {
  if (f.num === f.den) return 'pulę';
  if (f.num > f.den) return `${String(f.num / f.den)}× pulę`;
  return `${f.num}/${f.den} puli`;
}

const fracValue = (f: Fraction): number => f.num / f.den;
/** "2/3", "1", "3/2" for formulas. */
const fracFormula = (f: Fraction): string => (f.den === 1 ? String(f.num) : `${f.num}/${f.den}`);
const pctText = (x: number): string => `${(x * 100).toFixed(1).replace(/\.0$/, '')}%`;

export type SizingQuestion = 'bluff' | 'mdf';

export interface SizingTask {
  question: SizingQuestion;
  size: Fraction;
  /** Example pot and bet in dollars; the pot is a multiple of 12, so every size is a whole dollar amount. */
  pot: number;
  bet: number;
  /** Correct answer in percent. */
  answerPct: number;
  prompt: string;
  explanation: string[];
  formulas: string[];
}

export function sizingTask(question: SizingQuestion, size: Fraction, pot: number): SizingTask {
  if (pot % size.den !== 0) throw new Error('Pot must make the bet a whole number of dollars');
  const s = fracValue(size);
  const bet = (pot * size.num) / size.den;
  const sizeText = fractionText(size);
  if (question === 'bluff') {
    const answer = bluffShare(s);
    return {
      question,
      size,
      pot,
      bet,
      answerPct: answer * 100,
      prompt: `Betujesz ${sizeText} (${usd(bet)} do puli ${usd(pot)}). Jaki odsetek Twoich betów może być blefem, żeby call przeciwnika był na zero?`,
      formulas: [
        `s / (1 + 2s) = ${fracFormula(size)} / (1 + 2 × ${fracFormula(size)}) = ${pctText(answer)}`,
        `W dolarach: ${bet} / (${pot} + 2 × ${bet}) = ${bet} / ${pot + 2 * bet} = ${pctText(answer)}`,
      ],
      explanation: [
        `Przeciwnik płaci ${usd(bet)}, żeby wygrać ${usd(pot + bet)} (pula + Twój bet). Potrzebuje więc ${pctText(answer)} equity.`,
        `Jeśli dokładnie ${pctText(answer)} Twoich betów to blefy, jego call jest na zero. Więcej blefów — call zarabia; mniej — fold zarabia.`,
        'Im większy bet, tym więcej blefów możesz mieć w zakresie.',
      ],
    };
  }
  const answer = minimumDefense(s);
  return {
    question,
    size,
    pot,
    bet,
    answerPct: answer * 100,
    prompt: `Betujesz ${sizeText} (${usd(bet)} do puli ${usd(pot)}). Jak często przeciwnik musi bronić się (call lub raise), żeby Twój blef dowolnymi kartami nie zarabiał? (MDF)`,
    formulas: [
      `1 / (1 + s) = 1 / (1 + ${fracFormula(size)}) = ${pctText(answer)}`,
      `W dolarach: ${pot} / (${pot} + ${bet}) = ${pctText(answer)}`,
    ],
    explanation: [
      `Blef za ${usd(bet)} zarabia, jeśli przechodzi częściej niż ${pctText(1 - answer)} (${bet} / ${pot + bet}).`,
      `Przeciwnik musi więc kontynuować co najmniej w ${pctText(answer)} przypadków. Gdy pasuje częściej (typowe przy dużych betach na live), blefuj więcej.`,
    ],
  };
}

/** Random task: size from the specification list, question bluff share or MDF, pot $24–$240. */
export function generateSizingTask(rng: Rng): SizingTask {
  const size = pick(rng, SIZING_FRACTIONS);
  const question: SizingQuestion = rng() < 0.5 ? 'bluff' : 'mdf';
  const pot = 12 * (2 + randomInt(rng, 19));
  return sizingTask(question, size, pot);
}

export const isSizingCorrect = (task: SizingTask, givenPct: number): boolean =>
  Number.isFinite(givenPct) && Math.abs(givenPct - task.answerPct) <= SIZING_TOLERANCE_PP + 1e-9;

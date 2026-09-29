import type { Card } from '../cards';
import type { DrawSpot, Street } from '../draws';
import { DRAW_CATEGORIES, DRAW_NAMES_PL, generateDrawSpot } from '../draws';
import type { EquityResult } from '../equity';
import { equityExact } from '../equity';
import { CATEGORY_NAMES_PL, CATEGORY_NAMES_PL_ACCUSATIVE } from '../evaluator';
import type { OutCard, OutsResult } from '../outs';
import { computeOuts } from '../outs';
import type { Rng } from '../rng';
import { pick } from '../rng';
import type { BetSpot } from './betting';
import { betLabel, generateBetSpot } from './betting';
import { decimal, money, outsWord, pct, pctValue, signedUsd, usd } from './format';
import {
  bluffBreakEven,
  callEv,
  impliedOddsNeeded,
  minimumDefenseFrequency,
  requiredEquity,
  ruleOf2And4,
} from './formulas';

export const TASK_TYPES = ['outs', 'equity', 'potOdds', 'callFold', 'mdf', 'bluff', 'implied'] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const TASK_INFO: Readonly<Record<TaskType, { number: number; title: string }>> = {
  outs: { number: 1, title: 'Ile masz outów?' },
  equity: { number: 2, title: 'Oszacuj equity' },
  potOdds: { number: 3, title: 'Equity potrzebne do calla' },
  callFold: { number: 4, title: 'Call czy fold?' },
  mdf: { number: 5, title: 'MDF: jak często bronić' },
  bluff: { number: 6, title: 'Jak często bluff musi przejść' },
  implied: { number: 7, title: 'Implied odds' },
};

export const TOLERANCE = { equityPp: 5, oddsPp: 2, impliedUsd: 5 } as const;

export type CorrectAnswer =
  | { kind: 'count'; value: number }
  /** value and tolerance in percentage points */
  | { kind: 'percent'; value: number; tolerance: number }
  | { kind: 'decision'; value: 'call' | 'fold' | 'either'; ev: number }
  /** W in dollars; impossible when W exceeds what is left behind after the call (limit). */
  | { kind: 'dollars'; value: number; tolerance: number; limit: number; impossible: boolean };

export type UserAnswer = { kind: 'number'; value: number } | { kind: 'call' } | { kind: 'fold' } | { kind: 'impossible' };

export type ExplanationBlock =
  | { kind: 'text'; text: string }
  | { kind: 'formula'; text: string }
  | { kind: 'cards'; label: string; cards: Card[] };

export interface Task {
  type: TaskType;
  question: string;
  hand: DrawSpot | null;
  spot: BetSpot | null;
  answer: CorrectAnswer;
  explanation: ExplanationBlock[];
}

export interface AnswerCheck {
  correct: boolean;
  /** "Poprawna odpowiedź: …" */
  answerText: string;
}

const text = (t: string): ExplanationBlock => ({ kind: 'text', text: t });
const formula = (t: string): ExplanationBlock => ({ kind: 'formula', text: t });
const cardsBlock = (label: string, cards: Card[]): ExplanationBlock => ({ kind: 'cards', label, cards });

const nextStreetIn = (street: Street): string => (street === 'flop' ? 'turnie' : 'riverze');

function potAndBet(spot: BetSpot, who: 'villain' | 'hero'): string {
  const label = betLabel(spot);
  const size = label ? ` (${label})` : '';
  return who === 'villain'
    ? `W puli jest ${usd(spot.pot)}. Przeciwnik betuje ${usd(spot.bet)}${size}.`
    : `W puli jest ${usd(spot.pot)}. Blefujesz za ${usd(spot.bet)}${size}.`;
}

// ---------- explanation pieces ----------

function groupBy<K>(items: OutCard[], key: (o: OutCard) => K): Map<K, OutCard[]> {
  const map = new Map<K, OutCard[]>();
  for (const o of items) {
    const k = key(o);
    map.set(k, [...(map.get(k) ?? []), o]);
  }
  return map;
}

function outsBlocks(outs: OutsResult): ExplanationBlock[] {
  const blocks: ExplanationBlock[] = [];
  const byHero = [...groupBy(outs.outs, (o) => o.heroCategory).entries()].sort((a, b) => b[0] - a[0]);
  for (const [category, cards] of byHero) {
    blocks.push(cardsBlock(`${CATEGORY_NAMES_PL[category]} (${cards.length})`, cards.map((o) => o.card)));
  }
  if (outs.outs.length === 0) blocks.push(text('Brak outów: żadna karta nie daje ci wygranej.'));

  const falseGroups = groupBy(outs.falseOuts, (o) => `${o.heroCategory}:${o.villainCategory}`);
  for (const cards of falseGroups.values()) {
    const first = cards[0]!;
    const hero = CATEGORY_NAMES_PL_ACCUSATIVE[first.heroCategory]!;
    const villain = CATEGORY_NAMES_PL_ACCUSATIVE[first.villainCategory]!;
    const reason =
      first.heroCategory === first.villainCategory
        ? `dają ci ${hero}, ale przeciwnik ma wyższy układ tego samego typu (zdominowany draw)`
        : `dają ci ${hero}, ale przeciwnik ma ${villain}`;
    blocks.push(cardsBlock(`Fałszywe outy (${cards.length}): ${reason}`, cards.map((o) => o.card)));
  }
  if (outs.splits.length > 0) {
    blocks.push(cardsBlock(`Remis (${outs.splits.length}), nie liczy się jako out`, outs.splits.map((o) => o.card)));
  }
  return blocks;
}

function equityDescription(eq: EquityResult, street: Street): string {
  const where = street === 'flop' ? `${eq.boards} kombinacjach turn + river` : `${eq.boards} kartach rivera`;
  const ties = eq.ties > 0 ? `, remis ${eq.ties}` : '';
  return `Twoje equity: ${pct(eq.equity)}. Liczone dokładnie na wszystkich ${where}: wygrana ${eq.wins}${ties}, przegrana ${eq.losses}.`;
}

// ---------- task builders ----------

interface TaskData {
  hand?: DrawSpot;
  spot?: BetSpot;
}

function requireHand(data: TaskData, type: TaskType): DrawSpot {
  if (!data.hand) throw new Error(`Task ${type} needs a hand`);
  return data.hand;
}

function requireSpot(data: TaskData, type: TaskType): BetSpot {
  if (!data.spot) throw new Error(`Task ${type} needs a bet spot`);
  if (data.spot.bet > data.spot.stack) throw new Error('Bet exceeds the stack');
  return data.spot;
}

function buildOuts(hand: DrawSpot): Task {
  const outs = computeOuts(hand.hero, hand.villain, hand.board);
  return {
    type: 'outs',
    question: `Ile masz outów? Out to karta, po której na ${nextStreetIn(hand.street)} wygrywasz z ręką przeciwnika (remis się nie liczy).`,
    hand,
    spot: null,
    answer: { kind: 'count', value: outs.outs.length },
    explanation: [
      text(`Masz: ${outs.heroNow.name}, draw: ${DRAW_NAMES_PL[hand.category]}. Przeciwnik ma: ${outs.villainNow.name}.`),
      ...outsBlocks(outs),
      formula(
        `Razem ${outsWord(outs.outs.length)} z ${outs.cardsLeft} nieznanych kart = ${pct(outs.outs.length / outs.cardsLeft)} na ${nextStreetIn(hand.street)}.`,
      ),
    ],
  };
}

function buildEquity(hand: DrawSpot): Task {
  const eq = equityExact(hand.hero, hand.villain, hand.board);
  const outs = computeOuts(hand.hero, hand.villain, hand.board);
  const multiplier = hand.street === 'flop' ? 4 : 2;
  const estimate = ruleOf2And4(outs.outs.length, hand.street);
  const diffPp = (estimate - eq.equity) * 100;

  const explanation: ExplanationBlock[] = [
    text(equityDescription(eq, hand.street)),
    formula(`Reguła ${multiplier}: ${outs.outs.length} × ${multiplier} = ${pct(estimate)}`),
    text(
      Math.abs(diffPp) < 0.05
        ? 'Reguła trafia dokładnie.'
        : `Reguła ${diffPp > 0 ? 'zawyża' : 'zaniża'} o ${Math.abs(diffPp).toFixed(1)} pp.`,
    ),
  ];

  if (Math.abs(diffPp) > TOLERANCE.equityPp) {
    if (outs.falseOuts.length > 0) {
      explanation.push(
        cardsBlock(
          'Część kart wygląda na outy, ale to fałszywe outy (poprawiają ci rękę, a przeciwnik i tak wygrywa)',
          outs.falseOuts.map((o) => o.card),
        ),
      );
    }
    if (diffPp > 0 && hand.street === 'flop') {
      explanation.push(
        text(
          'Reguła 4 zakłada, że każdy out wygrywa do końca. Tu przeciwnik ma redraw: nawet gdy trafisz na turnie, river może dać mu lepszy układ.',
        ),
      );
    }
    if (diffPp < 0) {
      explanation.push(
        text(
          'Reguła liczy tylko czyste outy na następną kartę. Nie liczy remisów ani runner-runner (np. dwóch kolejnych kart do koloru lub strita).',
        ),
      );
    }
  }
  explanation.push(...outsBlocks(outs));

  return {
    type: 'equity',
    question: 'Oszacuj swoje equity przeciwko tej ręce do końca rozdania (w %).',
    hand,
    spot: null,
    answer: { kind: 'percent', value: eq.equity * 100, tolerance: TOLERANCE.equityPp },
    explanation,
  };
}

function buildPotOdds(spot: BetSpot): Task {
  const { pot: p, bet: x } = spot;
  const need = requiredEquity(p, x);
  return {
    type: 'potOdds',
    question: `${potAndBet(spot, 'villain')} Jakiego equity potrzebujesz, żeby call był na zero?`,
    hand: null,
    spot,
    answer: { kind: 'percent', value: need * 100, tolerance: TOLERANCE.oddsPp },
    explanation: [
      formula('Potrzebne equity = bet / (pula + 2 × bet)'),
      formula(`= ${x} / (${p} + ${2 * x}) = ${pct(need)}`),
      text(
        `Dokładasz ${usd(x)}, a po callu w puli jest ${usd(p + 2 * x)} (${usd(p)} + ${usd(x)} + ${usd(x)}). Call wychodzi na zero, gdy wygrywasz tę pulę w ${x} na ${p + 2 * x} przypadków.`,
      ),
    ],
  };
}

function buildCallFold(hand: DrawSpot, spot: BetSpot): Task {
  if (hand.street === 'flop' && !spot.allIn) {
    throw new Error('Call/fold on the flop is only asked when the bet is all-in');
  }
  const { pot: p, bet: x } = spot;
  const eq = equityExact(hand.hero, hand.villain, hand.board);
  const ev = callEv(eq.equity, p, x);
  const decision = Math.abs(ev) < 1e-9 ? 'either' : ev > 0 ? 'call' : 'fold';
  const winnings = Math.round(eq.equity * (p + 2 * x) * 100) / 100;

  const explanation: ExplanationBlock[] = [
    text(equityDescription(eq, hand.street)),
    formula(`Potrzebne equity: ${x} / (${p} + ${2 * x}) = ${pct(requiredEquity(p, x))}`),
    formula('EV(call) = e × (pula + 2 × bet) − bet'),
    formula(`= ${decimal(eq.equity)} × ${p + 2 * x} − ${x} = ${money(winnings)} − ${x} = ${signedUsd(winnings - x)}`),
    text(
      decision === 'either'
        ? 'EV = 0: call i fold są tak samo dobre.'
        : decision === 'call'
          ? 'EV > 0, więc CALL.'
          : 'EV < 0, więc FOLD.',
    ),
  ];
  if (hand.street === 'flop') {
    explanation.push(
      text('Przeciwnik jest all-in, więc zobaczysz turn i river bez dalszych betów. Dlatego liczy się equity do rivera.'),
    );
  } else if (!spot.allIn) {
    explanation.push(
      text('To czyste pot odds: nie liczymy, ile wygrasz lub stracisz na riverze (to temat zadania 7, implied odds).'),
    );
  }

  return {
    type: 'callFold',
    question: `${potAndBet(spot, 'villain')} Call czy fold?`,
    hand,
    spot,
    answer: { kind: 'decision', value: decision, ev },
    explanation,
  };
}

function buildMdf(spot: BetSpot): Task {
  const { pot: p, bet: x } = spot;
  const mdf = minimumDefenseFrequency(p, x);
  return {
    type: 'mdf',
    question: `${potAndBet(spot, 'villain')} Jak często (w %) musisz bronić (call lub raise), żeby jego bluff dowolnymi kartami nie był automatycznie zyskowny?`,
    hand: null,
    spot,
    answer: { kind: 'percent', value: mdf * 100, tolerance: TOLERANCE.oddsPp },
    explanation: [
      formula('MDF = pula / (pula + bet)'),
      formula(`= ${p} / (${p} + ${x}) = ${pct(mdf)}`),
      text(
        `Przeciwnik ryzykuje ${usd(x)}, żeby wygrać ${usd(p)}. Jeśli pasujesz częściej niż ${pct(1 - mdf)}, bet za ${usd(x)} z dowolnymi kartami przynosi mu zysk.`,
      ),
    ],
  };
}

function buildBluff(spot: BetSpot): Task {
  const { pot: p, bet: x } = spot;
  const needed = bluffBreakEven(p, x);
  return {
    type: 'bluff',
    question: `${potAndBet(spot, 'hero')} Jak często (w %) przeciwnik musi spasować, żeby bluff był na zero?`,
    hand: null,
    spot,
    answer: { kind: 'percent', value: needed * 100, tolerance: TOLERANCE.oddsPp },
    explanation: [
      formula('Bluff musi przejść: bet / (pula + bet)'),
      formula(`= ${x} / (${p} + ${x}) = ${pct(needed)}`),
      text(`Ryzykujesz ${usd(x)}, żeby wygrać ${usd(p)}. Bluff jest na zero, gdy przeciwnik pasuje w ${x} na ${p + x} przypadków.`),
    ],
  };
}

function buildImplied(hand: DrawSpot, spot: BetSpot): Task {
  if (hand.street !== 'turn') throw new Error('Implied odds are asked on the turn only');
  if (spot.bet >= spot.stack) throw new Error('Implied odds need money behind after the call');
  const { pot: p, bet: x } = spot;
  const eq = equityExact(hand.hero, hand.villain, hand.board);
  const e = eq.equity;
  const w = impliedOddsNeeded(e, p, x);
  const limit = spot.stack - x;
  const impossible = w > limit;
  const direct = Math.round(e * (p + 2 * x) * 100) / 100;

  const explanation: ExplanationBlock[] = [
    text(equityDescription(eq, hand.street)),
    formula(`Bez implied odds: EV(call) = ${decimal(e)} × ${p + 2 * x} − ${x} = ${signedUsd(direct - x)}`),
  ];
  if (w === 0) {
    explanation.push(text('Call jest na plus już bez implied odds, więc nie musisz nic dowygrać. Odpowiedź: $0.'));
  } else {
    const gross = Math.round((((1 - e) * x) / e) * 100) / 100;
    explanation.push(
      formula('W = (1 − e) × bet / e − pula − bet'),
      formula(`= (1 − ${decimal(e)}) × ${x} / ${decimal(e)} − ${p} − ${x} = ${money(gross)} − ${p + x} = ${usd(gross - p - x)}`),
      text(
        impossible
          ? `Po callu za plecami zostaje wam ${usd(limit)}, a potrzeba ${usd(w)}, więc nie da się: nawet all-in na riverze nie wystarczy.`
          : `Po callu za plecami zostaje wam ${usd(limit)}, więc da się: przeciwnik musi średnio zapłacić ${usd(w)} na riverze, gdy trafisz.`,
      ),
    );
  }

  return {
    type: 'implied',
    question: `${potAndBet(spot, 'villain')} Ile $ musisz średnio dowygrać na riverze, gdy trafisz, żeby call był na zero? Jeśli to więcej, niż zostaje w stacku, wybierz „nie da się”.`,
    hand,
    spot,
    answer: { kind: 'dollars', value: w, tolerance: TOLERANCE.impliedUsd, limit, impossible },
    explanation,
  };
}

/** Builds a task from given data. All answers are computed here, never in the UI. */
export function buildTask(type: TaskType, data: TaskData): Task {
  switch (type) {
    case 'outs':
      return buildOuts(requireHand(data, type));
    case 'equity':
      return buildEquity(requireHand(data, type));
    case 'potOdds':
      return buildPotOdds(requireSpot(data, type));
    case 'callFold':
      return buildCallFold(requireHand(data, type), requireSpot(data, type));
    case 'mdf':
      return buildMdf(requireSpot(data, type));
    case 'bluff':
      return buildBluff(requireSpot(data, type));
    case 'implied':
      return buildImplied(requireHand(data, type), requireSpot(data, type));
  }
}

const randomStreet = (rng: Rng): Street => (rng() < 0.5 ? 'flop' : 'turn');

export function generateTask(type: TaskType, rng: Rng): Task {
  const drawHand = (street: Street) => generateDrawSpot(rng, pick(rng, DRAW_CATEGORIES), street);
  switch (type) {
    case 'outs':
    case 'equity':
      return buildTask(type, { hand: drawHand(randomStreet(rng)) });
    case 'potOdds':
    case 'mdf':
    case 'bluff':
      return buildTask(type, { spot: generateBetSpot(rng) });
    case 'callFold': {
      const street = randomStreet(rng);
      const spot = street === 'flop' ? generateBetSpot(rng, { forceAllIn: true }) : generateBetSpot(rng);
      return buildTask(type, { hand: drawHand(street), spot });
    }
    case 'implied':
      return buildTask(type, { hand: drawHand('turn'), spot: generateBetSpot(rng, { allowAllIn: false }) });
  }
}

export function checkAnswer(task: Task, user: UserAnswer): AnswerCheck {
  const a = task.answer;
  switch (a.kind) {
    case 'count':
      return {
        correct: user.kind === 'number' && user.value === a.value,
        answerText: `Poprawna odpowiedź: ${outsWord(a.value)}`,
      };
    case 'percent':
      return {
        correct: user.kind === 'number' && Math.abs(user.value - a.value) <= a.tolerance + 1e-9,
        answerText: `Poprawna odpowiedź: ${pctValue(a.value)} (akceptujemy ±${a.tolerance} pp)`,
      };
    case 'decision': {
      const correct = a.value === 'either' ? user.kind === 'call' || user.kind === 'fold' : user.kind === a.value;
      const label = a.value === 'either' ? 'call lub fold' : a.value.toUpperCase();
      return { correct, answerText: `Poprawna odpowiedź: ${label} (EV calla ${signedUsd(a.ev)})` };
    }
    case 'dollars': {
      // Near the stack limit both answers are accepted, within the dollar tolerance.
      const impossibleOk = a.value > a.limit - a.tolerance;
      const numberOk =
        user.kind === 'number' && Math.abs(user.value - a.value) <= a.tolerance + 1e-9 && a.value <= a.limit + a.tolerance;
      const correct = user.kind === 'impossible' ? impossibleOk : numberOk;
      const answerText = a.impossible
        ? `Poprawna odpowiedź: nie da się (potrzeba ${Number.isFinite(a.value) ? usd(a.value) : 'nieskończenie dużo'}, a za plecami zostaje ${usd(a.limit)})`
        : `Poprawna odpowiedź: ${usd(a.value)} (akceptujemy ±$${a.tolerance})`;
      return { correct, answerText };
    }
  }
}

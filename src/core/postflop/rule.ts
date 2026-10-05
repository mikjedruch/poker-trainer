import { pctValue } from '../math/format';
import type { HandCat, RangeSummary } from './categories';
import type { EquityCount } from './rangeEquity';

// Decision rule — a heuristic, labelled in the UI as "reguła bazowa v1". Everything it uses
// (equity, nut advantage, texture, hand category) is computed exactly elsewhere in src/core.

export const RULE_LABEL_PL = 'reguła bazowa v1';

export const BOARD_STRATEGIES = ['check', 'small', 'large'] as const;
export type BoardStrategy = (typeof BOARD_STRATEGIES)[number];

export const STRATEGY_NAMES_PL: Readonly<Record<BoardStrategy, string>> = {
  check: 'Głównie check',
  small: 'Częsty mały c-bet (1/3 puli)',
  large: 'Rzadszy duży c-bet (2/3 puli)',
};

export const STRATEGY_SHORT_PL: Readonly<Record<BoardStrategy, string>> = {
  check: 'Głównie check',
  small: 'Mały c-bet 1/3',
  large: 'Duży c-bet 2/3',
};

/** Equity below this (percent) means mostly check. */
export const EQUITY_THRESHOLD_PCT = 50;
/** Nut advantage below this (percentage points) means mostly check. */
export const NUT_THRESHOLD_PP = -3;

export type RuleId = 'lowEquity' | 'nutDisadvantage' | 'dry' | 'wet';

export interface StrategyDecision {
  strategy: BoardStrategy;
  /** Rule number from the specification: 1 = check, 2 = dry, 3 = wet. */
  ruleNumber: 1 | 2 | 3;
  /** Every reason that holds (rule 1 can fire for both equity and nut advantage). */
  rules: RuleId[];
  /** E in percent. */
  equityPct: number;
  /** N in percentage points: % strong hands of hero minus % of villain. */
  nutPp: number;
  /** Polish sentences explaining which rule fired, with the numbers. */
  reasons: string[];
}

export const equityPct = (e: EquityCount): number => (e.triples === 0 ? Number.NaN : (50 * e.points) / e.triples);

export function nutAdvantagePp(hero: RangeSummary, villain: RangeSummary): number {
  if (hero.combos === 0 || villain.combos === 0) return 0;
  return 100 * (hero.counts.strong / hero.combos - villain.counts.strong / villain.combos);
}

/** "+1.4 pp", "−5.6 pp" */
export function formatPp(pp: number): string {
  // Rounded on the absolute value, so +x and −x always print the same digits.
  const tenths = Math.round(Math.abs(pp) * 10);
  const text = (tenths / 10).toFixed(1);
  if (tenths === 0) return `${text} pp`;
  return pp > 0 ? `+${text} pp` : `−${text} pp`;
}

export const formatEquity = (pct: number): string => `${pct.toFixed(2)}%`;

/**
 * Board strategy (heads-up):
 * 1. E < 50 or N < −3 → mostly check; 2. otherwise a dry flop → frequent small c-bet;
 * 3. otherwise (wet) → less frequent large c-bet. Thresholds compared in exact integer arithmetic.
 */
export function boardStrategy(equity: EquityCount, hero: RangeSummary, villain: RangeSummary, wet: boolean): StrategyDecision {
  if (equity.triples === 0 || hero.combos === 0 || villain.combos === 0) throw new Error('Empty range on this flop');
  const ePct = equityPct(equity);
  const nPp = nutAdvantagePp(hero, villain);
  // E < 50%  ⇔  points / (2·triples) < 1/2  ⇔  points < triples
  const lowEquity = equity.points * 100 < EQUITY_THRESHOLD_PCT * 2 * equity.triples;
  // N < −3 pp  ⇔  100·(sH·nV − sV·nH) < −3·nH·nV
  const nutDisadvantage =
    100 * (hero.counts.strong * villain.combos - villain.counts.strong * hero.combos) < NUT_THRESHOLD_PP * hero.combos * villain.combos;

  const e = `E = ${formatEquity(ePct)}`;
  const n = `N = ${formatPp(nPp)}`;
  if (lowEquity || nutDisadvantage) {
    const rules: RuleId[] = [];
    const reasons: string[] = [];
    if (lowEquity) {
      rules.push('lowEquity');
      reasons.push(`${e} — poniżej 50%: zakres przeciwnika ma przewagę equity.`);
    }
    if (nutDisadvantage) {
      rules.push('nutDisadvantage');
      reasons.push(`${n} — poniżej −3 pp: przeciwnik ma więcej silnych rąk (setów, dwóch par, stritów).`);
    }
    reasons.push('Reguła 1: E < 50% lub N < −3 pp → głównie check.');
    return { strategy: 'check', ruleNumber: 1, rules, equityPct: ePct, nutPp: nPp, reasons };
  }
  const base = `${e} (≥ 50%) i ${n} (≥ −3 pp) — masz przewagę zakresu.`;
  if (!wet) {
    return {
      strategy: 'small',
      ruleNumber: 2,
      rules: ['dry'],
      equityPct: ePct,
      nutPp: nPp,
      reasons: [base, 'Reguła 2: flop suchy → częsty mały c-bet (1/3 puli): tanio betujesz prawie cały zakres.'],
    };
  }
  return {
    strategy: 'large',
    ruleNumber: 3,
    rules: ['wet'],
    equityPct: ePct,
    nutPp: nPp,
    reasons: [base, 'Reguła 3: flop mokry → rzadszy duży c-bet (2/3 puli): betujesz mocne ręce i drawy, resztę checkujesz.'],
  };
}

// ---------- decision with a specific hand ----------

/** Column of the decision table: the board strategy, or multiway (PM). */
export type DecisionColumn = BoardStrategy | 'multiway';

export const COLUMN_NAMES_PL: Readonly<Record<DecisionColumn, string>> = {
  small: 'mały c-bet',
  large: 'duży c-bet',
  check: 'głównie check',
  multiway: 'multiway, bet 1/2 puli',
};

export type BetSize = 'third' | 'half' | 'twoThirds';

export const BET_FRACTIONS: Readonly<Record<BetSize, number>> = { third: 1 / 3, half: 1 / 2, twoThirds: 2 / 3 };
export const BET_SIZE_NAMES_PL: Readonly<Record<BetSize, string>> = { third: '1/3 puli', half: '1/2 puli', twoThirds: '2/3 puli' };
export const BET_SIZE_SHORT: Readonly<Record<BetSize, string>> = { third: '1/3', half: '1/2', twoThirds: '2/3' };

/**
 * Bet size of a column: small 1/3, large 2/3, multiway 1/2. With "mostly check" the few bets
 * (strong hands only) are 2/3: a rarely-betting, polarised range bets big.
 */
export const COLUMN_BET_SIZE: Readonly<Record<DecisionColumn, BetSize>> = {
  small: 'third',
  large: 'twoThirds',
  check: 'twoThirds',
  multiway: 'half',
};

export interface HandContext {
  /** Villain profile calls too often postflop (e.g. loose-live). */
  callsTooMuch: boolean;
  /** Hero acts last after the flop. */
  inPosition: boolean;
}

export type HandAction = 'bet' | 'check';

export interface HandDecision {
  action: HandAction;
  /** Set when the action is bet. */
  size: BetSize | null;
  /** Polish reasons: why this row of the table says bet or check. */
  reasons: string[];
}

const bet = (column: DecisionColumn, ...reasons: string[]): HandDecision => ({ action: 'bet', size: COLUMN_BET_SIZE[column], reasons });
const check = (...reasons: string[]): HandDecision => ({ action: 'check', size: null, reasons });

const LOOSE_FEWER_BLUFFS = 'Przeciw profilowi, który za często sprawdza, blefujesz mniej — taki gracz rzadko pasuje.';
const OOP_NO_BLUFF = 'Bez pozycji blef traci więcej, gdy dostaje calla, więc ręka bez trafienia gra check.';
const MULTIWAY_NO_BLUFF = 'Multiway blef musi przejść przez kilku graczy naraz, więc betujesz tylko mocne ręce i silne drawy.';

/** The decision table from the specification (one row per hand category). */
export function handDecision(category: HandCat, column: DecisionColumn, ctx: HandContext): HandDecision {
  switch (category) {
    case 'strong':
      return column === 'check'
        ? bet(
            column,
            'Silna ręka betuje nawet przy strategii „głównie check” — za 2/3 puli, bo betujesz rzadko i tylko najmocniejszymi rękami.',
          )
        : bet(column, 'Silna ręka betuje zawsze: budujesz pulę na value.');

    case 'tpGood':
      if (column === 'check') {
        return check(
          'Przy strategii „głównie check” nawet top para z dobrym kickerem gra check: zakres przeciwnika jest tu mocniejszy, więc nie budujesz puli przeciw lepszym rękom.',
        );
      }
      if (column === 'multiway') return bet(column, 'Mocna para betuje także multiway: value od kilku gorszych rąk.');
      return bet(column, 'Top para z dobrym kickerem albo overpara: value od gorszych par i drawów.');

    case 'tpWeak':
      if (column === 'small') {
        return bet(column, 'Mały c-bet obejmuje prawie cały zakres: top para ze słabym kickerem też zbiera value od gorszych rąk.');
      }
      if (column === 'large') {
        return ctx.callsTooMuch
          ? bet(
              column,
              'Przeciw profilowi, który za często sprawdza, value może być cieńsze: zapłaci gorszą parą, więc top para ze słabym kickerem betuje.',
            )
          : check('Duży bet ze słabym kickerem sprawdzają głównie lepsze ręce, więc check i kontrola puli.');
      }
      if (column === 'multiway') {
        return check('Multiway top para ze słabym kickerem często jest już pokonana albo zdominowana — check.');
      }
      return check('Przy strategii „głównie check” top para ze słabym kickerem gra check.');

    case 'weakPair':
      if (column === 'small') {
        return bet(column, 'Mały c-bet obejmuje prawie cały zakres: słabsza para betuje tanio — trochę value, trochę ochrony.');
      }
      if (column === 'large') return check('Słabsza para nie wytrzyma dużego betu: sprawdzą ją głównie lepsze ręce — check.');
      if (column === 'multiway') return check('Multiway słabsza para gra check: przeciw kilku graczom rzadko jest najlepsza.');
      return check('Przy strategii „głównie check” słabsza para gra check.');

    case 'draw':
      if (column === 'check') {
        return check(
          'Przy strategii „głównie check” draw gra check: bez przewagi zakresu semi-blef rzadziej wymusza fold, a equity realizujesz taniej.',
        );
      }
      if (column === 'multiway') return bet(column, 'Silny draw betuje także multiway: semi-blef, który ma outy, gdy dostanie calla.');
      return bet(column, 'Draw betuje jako semi-blef: wygrywasz od razu albo masz outy, gdy dostaniesz calla.');

    case 'nothing':
      if (column === 'small') {
        const reasons: string[] = [];
        if (ctx.callsTooMuch) reasons.push(LOOSE_FEWER_BLUFFS);
        if (!ctx.inPosition) reasons.push(OOP_NO_BLUFF);
        if (reasons.length > 0) return check(...reasons);
        return bet(column, 'Tani blef za 1/3 puli w pozycji: na suchym flopie przeciwnik często nic nie trafił.');
      }
      if (column === 'large') return check('Na mokrym flopie przeciwnik ma dużo trafień i drawów: duży blef bez equity traci za dużo — check.');
      if (column === 'multiway') return check(MULTIWAY_NO_BLUFF);
      return check('Ręka bez trafienia przy strategii „głównie check”: check.');
  }
}

/** Short label of the table cell, e.g. "bet 1/3" or "check". */
export const decisionLabel = (d: HandDecision): string => (d.action === 'bet' ? `bet ${BET_SIZE_SHORT[d.size!]}` : 'check');

export const percentText = (fraction: number): string => pctValue(fraction * 100);

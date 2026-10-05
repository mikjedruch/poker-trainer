import { RANK_CHARS } from '../cards';
import { pct } from '../math/format';
import type { HandClass } from '../range';
import type { Action } from './data';
import { SIZES, STAKES, scenarioRanges } from './data';
import type { PreflopSpot } from './situation';
import { heroOutOfPosition, isolationSize, openSize, positionsAfter, threeBetSize, villainThreeBetSize } from './situation';

// Explanations for preflop answers. The category templates are the ones from the specification;
// where a template would contradict the correct action (e.g. "podbijasz" with JJ when the answer
// is call), a variant consistent with the action is used instead. All numbers are computed here.

export type HandCategory =
  | 'premium'
  | 'mediumPair'
  | 'smallPair'
  | 'suitedWheelAce'
  | 'suitedAce'
  | 'suitedBroadway'
  | 'suitedConnector'
  | 'suitedOther'
  | 'offsuitBroadway'
  | 'weakOffsuit';

const rank = (ch: string): number => RANK_CHARS.indexOf(ch);
const TEN = rank('T');
const JACK = rank('J');
const SEVEN = rank('7');
const FIVE = rank('5');
const ACE = rank('A');
const KING = rank('K');

export function handCategory(cls: HandClass): HandCategory {
  const high = rank(cls[0]!);
  const low = rank(cls[1]!);
  if (high === low) return high >= JACK ? 'premium' : high >= SEVEN ? 'mediumPair' : 'smallPair';
  if (high === ACE && low === KING) return 'premium';
  const suited = cls[2] === 's';
  const broadway = low >= TEN;
  if (!suited) return broadway ? 'offsuitBroadway' : 'weakOffsuit';
  if (high === ACE) return low <= FIVE ? 'suitedWheelAce' : broadway ? 'suitedBroadway' : 'suitedAce';
  if (broadway) return 'suitedBroadway';
  return high - low - 1 <= 1 ? 'suitedConnector' : 'suitedOther';
}

// ---------- numbers ----------

const choose = (n: number, k: number): number => {
  let r = 1;
  for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
  return r;
};

/** A pocket pair flops a set (or better) when the flop holds one of the 2 remaining cards of its rank. */
export const SET_ON_FLOP = 1 - choose(48, 3) / choose(50, 3);
/** Rule of thumb for set-mining: call only with at least ~15× the call left behind. */
export const SET_MINING_RATIO = 15;

const oneDecimal = (x: number): string => x.toFixed(1).replace(/\.0$/, '');

/** Stack left behind after putting in `total`, and how many times `total` that is. */
export function stackRatio(total: number): { behind: number; ratio: number } {
  const behind = STAKES.stack - total;
  return { behind, ratio: behind / total };
}

const players = (n: number): string => (n === 1 ? '1 gracz' : `${n} graczy`);
const limpersLocative = (n: number): string => (n === 1 ? '1 limperze' : `${n} limperach`);
const comboShare = (combos: number): string => pct(combos / 1326);

function isolationFormula(spot: PreflopSpot): string {
  const { hero, limpers } = spot.situation;
  const n = limpers.length;
  const parts = [`$${SIZES.isolateOneLimper}`];
  if (n === 2) parts.push(`$${SIZES.isolatePerExtraLimper}`);
  if (n > 2) parts.push(`${n - 1} × $${SIZES.isolatePerExtraLimper}`);
  if (hero === 'SB' || hero === 'BB') parts.push(`$${SIZES.isolateFromBlindsExtra} z blindów`);
  return parts.length === 1 ? parts[0]! : `${parts.join(' + ')} = $${isolationSize(hero, n)}`;
}

/** Price of calling: what hero adds, the pot before the call and the equity that breaks even. */
function callPrice(spot: PreflopSpot) {
  const call = spot.options.find((o) => o.action === 'call');
  const heroSeat = spot.seats.find((s) => s.position === spot.situation.hero)!;
  const toCall = (call?.total ?? 0) - heroSeat.bet;
  return { toCall, pot: spot.pot, needed: toCall / (spot.pot + toCall) };
}

// ---------- sentences ----------

function actionSentence(spot: PreflopSpot): string {
  const { situation: s, handClass: cls, correct } = spot;
  const ranges = scenarioRanges(spot.scenario);
  switch (s.family) {
    case 'rfi': {
      const share = comboShare(ranges.raiseCombos);
      const first = s.hero === 'UTG' ? 'Jesteś pierwszy do akcji.' : 'Wszyscy przed Tobą spasowali.';
      if (correct === 'raise')
        return `${first} ${cls} jest w zakresie otwarcia z ${s.hero} (${share} rąk), więc raise do $${openSize(s.hero)}.`;
      const left = positionsAfter(s.hero).length;
      const why =
        left === 1
          ? 'Za Tobą jest już tylko BB, ale grasz przeciw niemu bez pozycji'
          : `Za Tobą jest jeszcze ${players(left)}, którzy mogą mieć lepszą rękę`;
      return `${cls} jest poza zakresem otwarcia z ${s.hero} (otwierasz ${share} rąk). ${why} — fold.`;
    }
    case 'limpers': {
      const before = `Przed Tobą limpuje ${players(s.limpers.length)}, w puli $${spot.pot}.`;
      if (correct === 'raise')
        return `${before} ${cls} jest w zakresie izolacji (${ranges.raiseText}): raise do ${isolationFormula(spot)}.`;
      if (correct === 'check')
        return `${before} W BB widzisz flop bez dopłaty, a ${cls} nie jest w zakresie podbicia (${ranges.raiseText}) — check.`;
      if (correct === 'call')
        return s.hero === 'SB'
          ? `${before} ${cls} nie jest w zakresie podbicia (${ranges.raiseText}), ale za $${STAKES.bigBlind - STAKES.smallBlind} dopłaty dostajesz bardzo dobrą cenę — dopłacasz.`
          : `${before} ${cls} nie jest w zakresie izolacji (${ranges.raiseText}), ale nadaje się do taniego wejścia: limp $${STAKES.bigBlind}.`;
      return `${before} ${cls} jest za słaba nawet na ${s.hero === 'SB' ? 'dopłatę' : 'limp'} — fold.`;
    }
    case 'vsOpen': {
      const opened = `${s.opener} otwiera do $${SIZES.villainOpen}.`;
      if (correct === 'raise')
        return `${opened} ${cls} jest w zakresie 3betu (${ranges.raiseText}): 3bet do $${threeBetSize(s.hero)}${s.hero === 'SB' || s.hero === 'BB' ? ' (z blindów, bez pozycji)' : ' (w pozycji)'}.`;
      if (correct === 'call') return `${opened} ${cls} nie jest w zakresie 3betu (${ranges.raiseText}), ale jest w zakresie calla — call $${SIZES.villainOpen}.`;
      return `${opened} ${cls} jest poza zakresem calla i 3betu przeciw openowi z ${s.opener} — fold.`;
    }
    case 'vs3bet': {
      const tb = villainThreeBetSize(s.threeBettor!);
      const opened = `Twój open do $${openSize(s.hero)}, ${s.threeBettor} 3betuje do $${tb}.`;
      if (correct === 'raise') return `${opened} ${cls} jest w zakresie 4betu (${ranges.raiseText}): 4bet do $${SIZES.fourBet}.`;
      if (correct === 'call') return `${opened} ${cls} jest w zakresie calla (${ranges.callText}): call $${tb}.`;
      return `${opened} ${cls} jest poza zakresem calla i 4betu — fold. Tracisz tylko $${openSize(s.hero)} z openu.`;
    }
  }
}

function smallPairSentence(spot: PreflopSpot): string {
  const s = spot.situation;
  const threeBet = s.family === 'vs3bet' ? villainThreeBetSize(s.threeBettor!) : SIZES.villainThreeBetInPosition;
  const vs3 = stackRatio(threeBet);
  const parts = [
    `Set-mining: set trafiasz na flopie w ${pct(SET_ON_FLOP)} przypadków (ok. 1 na ${oneDecimal(1 / SET_ON_FLOP)}).`,
    `Call opłaca się, gdy efektywny stack to min. ~${SET_MINING_RATIO}× kwoty calla.`,
    `Przeciw 3betowi $${threeBet} przy $${vs3.behind} za plecami (${oneDecimal(vs3.ratio)}×) — fold.`,
  ];
  const call = spot.options.find((o) => o.action === 'call');
  if (call?.total && s.family !== 'vs3bet') {
    const here = stackRatio(call.total);
    const enough = here.ratio >= SET_MINING_RATIO ? 'więcej' : 'mniej';
    parts.push(`Tu wchodzisz za $${call.total}, a za plecami zostaje $${here.behind} (${oneDecimal(here.ratio)}×) — ${enough} niż ${SET_MINING_RATIO}×.`);
  }
  return parts.join(' ');
}

const TEMPLATES: Readonly<Record<Exclude<HandCategory, 'smallPair'>, string>> = {
  premium: 'Ręka na value — podbijasz, żeby budować pulę i zawęzić pole.',
  mediumPair: 'Za mocne, żeby tylko limpować; przeciw 3betowi zwykle już tylko call albo fold.',
  suitedWheelAce: 'Nutowy kolor plus szansa na strit A–5; dobre w pulach multiway.',
  suitedConnector: 'Grają dobrze multiway i tanio; tracą wartość przy drogim wejściu i bez pozycji.',
  offsuitBroadway: 'Często zdominowane przez lepsze kickery, szczególnie przeciw zakresom limperów i openów z wczesnych pozycji.',
  weakOffsuit: 'Za mało equity i grywalności, żeby płacić za wejście.',
  // Categories the specification does not list:
  suitedAce: 'As w kolorze daje szansę na nutowy kolor, ale kicker jest słaby: gdy trafisz asa, często przegrywasz z lepszym asem.',
  suitedBroadway:
    'Dwie wysokie karty w kolorze: robią top pary z dobrym kickerem oraz kolory i strity do nuts. Słabsze z nich (np. KTs, QTs) bywają zdominowane przez mocne zakresy.',
  suitedOther:
    'Kolor dodaje grywalności, ale bez połączenia i bez wysokiej drugiej karty rzadko trafiasz coś mocnego. Takie ręce grasz głównie z późnej pozycji albo tanio z BB.',
};

function categorySentence(spot: PreflopSpot): string {
  const { situation: s, correct } = spot;
  const category = handCategory(spot.handClass);
  const passive: Action[] = ['call', 'check'];

  if (category === 'smallPair') return smallPairSentence(spot);

  if (category === 'premium' && correct !== 'raise') {
    return `Mocna ręka, ale w tej sytuacji podbijasz tylko z ${scenarioRanges(spot.scenario).raiseText}. Z tą ręką grasz call.`;
  }

  if (category === 'mediumPair' && s.family === 'limpers' && passive.includes(correct)) {
    if (correct === 'check')
      return 'Średnia para, ale podbicie bez pozycji przeciw limperom rzadko daje pulę heads-up. Lepiej zobaczyć flop za darmo i grać na seta.';
    if (s.hero === 'SB')
      return 'Średnia para, ale z SB zagrasz bez pozycji przez całe rozdanie. Tania dopłata i gra na seta jest lepsza niż budowanie puli bez pozycji.';
    return `Średnia para, ale przy ${limpersLocative(s.limpers.length)} izolacja do $${isolationSize(s.hero, s.limpers.length)} rzadko daje pulę heads-up. Limp to tanie wejście do puli multiway, w której liczysz na seta.`;
  }

  if (category === 'weakOffsuit' && correct === 'raise') {
    const left = positionsAfter(s.hero).length;
    return `Słaba ręka, ale z ${s.hero} otwierasz szerzej: za Tobą jest już tylko ${players(left)}, więc często od razu zabierasz blindy.`;
  }

  if (category === 'weakOffsuit' && correct === 'call') {
    const price = callPrice(spot);
    const wide = s.family === 'vsOpen' && s.hero === 'BB' ? ` Open z ${s.opener} ma szeroki zakres.` : '';
    return `Słaba ręka, ale cena jest dobra: dopłacasz $${price.toCall} do puli $${price.pot}, więc wystarczy ${pct(price.needed)} equity.${wide}`;
  }

  return TEMPLATES[category];
}

export const POSITION_SENTENCE = 'Po flopie grasz bez pozycji: działasz pierwszy na każdej ulicy, więc trudniej zrealizować equity.';

export interface PreflopExplanation {
  /** Correct option label, e.g. "Raise do $16". */
  answer: string;
  paragraphs: string[];
}

export function explainSpot(spot: PreflopSpot): PreflopExplanation {
  const option = spot.options.find((o) => o.action === spot.correct);
  if (!option) throw new Error(`Correct action ${spot.correct} is not offered in ${spot.scenario}`);
  const paragraphs = [actionSentence(spot), categorySentence(spot)];
  if (heroOutOfPosition(spot.situation)) paragraphs.push(POSITION_SENTENCE);
  return { answer: option.label, paragraphs };
}

import { usd } from '../../core/math/format';
import { SIZES } from '../../core/preflop/data';
import type { FlopSeats } from '../../core/postflop/scenarios';
import type { SeatInfo } from '../../shared/PokerTable';
import { POSITIONS } from '../../core/table';

// Screen text and table seats for postflop spots (formatting only, no poker answers).

const joinPl = (items: readonly string[]): string =>
  items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} i ${items[items.length - 1]}`;

/** "Ty (UTG) raise do $8, BB call · flop, pula $17" */
export function flopSituationLine(seats: FlopSeats): string {
  return `Ty (${seats.hero}) raise do ${usd(SIZES.open)}, ${joinPl(seats.opponents)} call · flop, pula ${usd(seats.pot)}`;
}

/** Players in the hand sit in, everyone else has folded; no bets yet on the flop. */
export function flopTableSeats(seats: FlopSeats): SeatInfo[] {
  const inHand = new Set([seats.hero, ...seats.opponents]);
  return POSITIONS.map((position) => ({ position, folded: !inHand.has(position) }));
}

export const positionNote = (seats: FlopSeats): string =>
  seats.opponents.length > 1 ? 'multiway' : seats.inPosition ? 'Ty w pozycji' : 'Ty bez pozycji';

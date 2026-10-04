// 6-max table positions. Listed clockwise, which is also the preflop action order.

export const POSITIONS = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'] as const;
export type Position = (typeof POSITIONS)[number];

/** Seats clockwise starting with `first`: the order a table drawn with `first` at the bottom shows them. */
export function seatsClockwiseFrom(first: Position): Position[] {
  const start = POSITIONS.indexOf(first);
  return POSITIONS.map((_, i) => POSITIONS[(start + i) % POSITIONS.length]!);
}

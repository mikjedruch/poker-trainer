import { Fragment } from 'react';
import type { CSSProperties } from 'react';
import { usd } from '../core/math/format';
import type { Position } from '../core/table';
import { seatsClockwiseFrom } from '../core/table';

export interface SeatInfo {
  position: Position;
  /** Money this player has put in on the current street; shown as a chip in front of the seat. */
  bet?: number;
  folded?: boolean;
}

interface Point {
  x: number;
  y: number;
}

// Seat centres in % of the table box, clockwise from the hero at the bottom.
const SEAT_POINTS: readonly Point[] = [
  { x: 50, y: 89 },
  { x: 11, y: 69 },
  { x: 11, y: 27 },
  { x: 50, y: 9 },
  { x: 89, y: 27 },
  { x: 89, y: 69 },
];
const CENTER: Point = { x: 50, y: 50 };

const lerp = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const at = (p: Point): CSSProperties => ({ left: `${p.x}%`, top: `${p.y}%` });

/** Dealer button: a little in front of the seat, shifted sideways so it does not cover the chip. */
function dealerPoint(seat: Point): Point {
  const base = lerp(seat, CENTER, 0.3);
  const dx = CENTER.x - seat.x;
  const dy = CENTER.y - seat.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: base.x - (dy / len) * 13, y: base.y + (dx / len) * 13 };
}

function describe(order: Position[], byPosition: Map<Position, SeatInfo>, hero: Position, pot: number): string {
  const parts = order.map((p) => {
    const s = byPosition.get(p);
    const who = p === hero ? `${p} (Ty)` : p;
    if (s?.folded) return `${who}: fold`;
    return s?.bet ? `${who}: ${usd(s.bet)}` : who;
  });
  return `Stół 6-max. ${parts.join(', ')}. Pula ${usd(pot)}.`;
}

/** 6-max table seen from above, hero always at the bottom. */
export function PokerTable({ heroPosition, seats, pot }: { heroPosition: Position; seats: readonly SeatInfo[]; pot: number }) {
  const order = seatsClockwiseFrom(heroPosition);
  const byPosition = new Map(seats.map((s) => [s.position, s]));

  return (
    <div className="poker-table" role="img" aria-label={describe(order, byPosition, heroPosition, pot)}>
      <div className="table-felt" />
      <div className="table-pot" style={at(CENTER)}>
        Pula <strong>{usd(pot)}</strong>
      </div>
      {order.map((position, i) => {
        const point = SEAT_POINTS[i]!;
        const seat = byPosition.get(position);
        const isHero = position === heroPosition;
        const className = ['table-seat', isHero ? 'hero' : '', seat?.folded ? 'folded' : ''].filter(Boolean).join(' ');
        return (
          <Fragment key={position}>
            <div className={className} style={at(point)}>
              {isHero ? `Ty · ${position}` : position}
            </div>
            {seat?.bet ? (
              <div className="table-chip" style={at(lerp(point, CENTER, 0.42))}>
                <span className="table-chip-dot" />
                {usd(seat.bet)}
              </div>
            ) : null}
            {position === 'BTN' && (
              <div className="table-dealer" style={at(dealerPoint(point))}>
                D
              </div>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

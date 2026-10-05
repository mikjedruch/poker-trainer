import type { CSSProperties } from 'react';
import type { ActionCell } from '../../core/postflop/analysis';
import type { HandClass } from '../../core/range';

/** Text for screen readers and the cell summary line. */
export function cellSummary(cell: ActionCell): string {
  const n = cell.combos.length;
  if (n === 0) return `${cell.handClass}: poza zakresem`;
  if (cell.bets === n) return `${cell.handClass}: bet`;
  if (cell.bets === 0) return `${cell.handClass}: check`;
  return `${cell.handClass}: bet ${cell.bets} z ${n} kombinacji, reszta check`;
}

/**
 * 13×13 grid of the hero's flop decisions. A cell fills from the bottom with the share of its
 * combos that bet (e.g. only the suited combos with a flush draw); hands outside the open range
 * are dark. `changed` outlines cells whose decision differs from a reference (baseline profile).
 */
export function ActionGrid({
  grid,
  marked,
  onSelect,
  changed,
}: {
  grid: readonly (readonly ActionCell[])[];
  marked?: HandClass | null;
  onSelect?: (cls: HandClass) => void;
  changed?: (cell: ActionCell, row: number, col: number) => boolean;
}) {
  return (
    <div className="range-grid" role="grid" aria-label="Twoje decyzje na flopie, siatka 13×13">
      {grid.map((row, r) => (
        <div key={r} className="range-row" role="row">
          {row.map((cell, c) => {
            const n = cell.combos.length;
            const share = n === 0 ? 0 : cell.bets / n;
            const classes = ['range-cell', n === 0 ? 'out' : share >= 0.5 ? 'action-mix mostly-bet' : 'action-mix mostly-check'];
            if (cell.handClass === marked) classes.push('marked');
            if (n > 0 && changed?.(cell, r, c)) classes.push('changed');
            const style = n === 0 ? undefined : ({ '--bet-share': `${(share * 100).toFixed(1)}%` } as CSSProperties);
            const label = cellSummary(cell);
            return onSelect ? (
              <button
                key={c}
                type="button"
                role="gridcell"
                className={classes.join(' ')}
                style={style}
                aria-label={label}
                aria-pressed={cell.handClass === marked}
                onClick={() => onSelect(cell.handClass)}
              >
                {cell.handClass}
              </button>
            ) : (
              <span key={c} role="gridcell" className={classes.join(' ')} style={style} aria-label={label}>
                {cell.handClass}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

import type { Action } from '../core/preflop/data';
import type { HandClass } from '../core/range';
import { gridLabel } from '../core/range';

export const ACTION_NAMES_PL: Readonly<Record<Action, string>> = {
  raise: 'raise',
  call: 'call',
  fold: 'fold',
  check: 'check',
};

/**
 * 13×13 hand grid: pairs on the diagonal, suited above, offsuit below.
 * Colours: raise red, call/limp green, fold grey, check light grey (theme tokens).
 */
export function RangeGrid({
  cells,
  marked,
  onSelect,
  describe = (cls, a) => `${cls}: ${ACTION_NAMES_PL[a]}`,
}: {
  cells: readonly (readonly Action[])[];
  /** Hand to outline (the hand you were dealt, or the tapped cell). */
  marked?: HandClass | null;
  onSelect?: (cls: HandClass) => void;
  describe?: (cls: HandClass, action: Action) => string;
}) {
  return (
    <div className="range-grid" role="grid" aria-label="Siatka zakresu 13×13">
      {cells.map((row, r) => (
        <div key={r} className="range-row" role="row">
          {row.map((action, c) => {
            const cls = gridLabel(r, c);
            const className = `range-cell ${action}${cls === marked ? ' marked' : ''}`;
            return onSelect ? (
              <button
                key={c}
                type="button"
                role="gridcell"
                className={className}
                aria-label={describe(cls, action)}
                aria-pressed={cls === marked}
                onClick={() => onSelect(cls)}
              >
                {cls}
              </button>
            ) : (
              <span key={c} role="gridcell" className={className} aria-label={describe(cls, action)}>
                {cls}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** Colour key with the number of combos (out of 1326) and share for each action. */
export function RangeLegend({
  items,
  showRanges = false,
}: {
  items: ReadonlyArray<{ action: Action; label: string; combos: number; range?: string }>;
  /** Also print each action's range in notation like "66+, A9s+". */
  showRanges?: boolean;
}) {
  return (
    <ul className="range-legend">
      {items.map((it) => (
        <li key={it.action}>
          <span className={`legend-swatch ${it.action}`} aria-hidden="true" />
          <span className="legend-label">{it.label}</span>
          <span className="legend-value">
            {it.combos} komb. · {((it.combos / 1326) * 100).toFixed(1)}%
          </span>
          {showRanges && it.range && <span className="legend-range">{it.range}</span>}
        </li>
      ))}
    </ul>
  );
}

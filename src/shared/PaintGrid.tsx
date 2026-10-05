import { useRef } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import type { HandClass } from '../core/range';
import { gridLabel } from '../core/range';

const CELLS: HandClass[][] = Array.from({ length: 13 }, (_, r) => Array.from({ length: 13 }, (_, c) => gridLabel(r, c)));

function cellAt(x: number, y: number): HandClass | null {
  const el = document.elementFromPoint(x, y);
  const cell = el instanceof HTMLElement ? el.closest<HTMLElement>('[data-cls]') : null;
  return cell?.dataset.cls ?? null;
}

/**
 * Editable 13×13 range: touch a cell and drag a finger across the grid to paint. The first cell
 * decides the mode — starting on an empty cell adds hands, starting on a selected one removes them.
 * Painting blocks scrolling only while the finger is on the grid.
 */
export function PaintGrid({
  selected,
  onChange,
}: {
  selected: ReadonlySet<HandClass>;
  onChange: (next: Set<HandClass>) => void;
}) {
  const paint = useRef<{ add: boolean; working: Set<HandClass>; done: Set<HandClass> } | null>(null);

  function apply(cls: HandClass) {
    const p = paint.current;
    if (!p || p.done.has(cls)) return;
    p.done.add(cls);
    if (p.add) p.working.add(cls);
    else p.working.delete(cls);
    onChange(new Set(p.working));
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    const cls = (e.target as HTMLElement).closest<HTMLElement>('[data-cls]')?.dataset.cls;
    if (!cls) return;
    e.preventDefault();
    // Touch input captures the pointer to the first cell; release it so moves report the cell under the finger.
    const target = e.target as Element;
    if (target.hasPointerCapture?.(e.pointerId)) target.releasePointerCapture(e.pointerId);
    paint.current = { add: !selected.has(cls), working: new Set(selected), done: new Set() };
    apply(cls);
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!paint.current) return;
    const cls = cellAt(e.clientX, e.clientY);
    if (cls) apply(cls);
  }

  const stop = () => {
    paint.current = null;
  };

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, cls: HandClass) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    const next = new Set(selected);
    if (next.has(cls)) next.delete(cls);
    else next.add(cls);
    onChange(next);
  }

  return (
    <div
      className="range-grid paint-grid"
      role="grid"
      aria-label="Edytowalny zakres 13×13: dotknij i przeciągnij, żeby zaznaczać"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={stop}
      onPointerCancel={stop}
    >
      {CELLS.map((row, r) => (
        <div key={r} className="range-row" role="row">
          {row.map((cls) => {
            const on = selected.has(cls);
            return (
              <button
                key={cls}
                type="button"
                role="gridcell"
                data-cls={cls}
                className={`range-cell ${on ? 'call' : 'fold'}`}
                aria-pressed={on}
                aria-label={`${cls}: ${on ? 'w zakresie' : 'poza zakresem'}`}
                onKeyDown={(e) => onKeyDown(e, cls)}
              >
                {cls}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

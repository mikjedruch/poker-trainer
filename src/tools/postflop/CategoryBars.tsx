import type { RangeSummary } from '../../core/postflop/categories';
import { HAND_CATEGORIES, HAND_CATEGORY_NAMES_PL, shareOf } from '../../core/postflop/categories';

export type BarTone = 'hero' | 'villain' | 'villain-alt';

export interface BarSeries {
  label: string;
  summary: RangeSummary;
  tone: BarTone;
}

const pctText = (x: number) => `${(x * 100).toFixed(1)}%`;

/** Category distribution of up to three ranges as horizontal bars, one row per category. */
export function CategoryBars({ series }: { series: readonly BarSeries[] }) {
  const rows = [...HAND_CATEGORIES.map((c) => [c, HAND_CATEGORY_NAMES_PL[c]] as const), ['tpPlus', 'TP+ (razem z silnymi)'] as const];
  return (
    <div className="category-bars">
      <ul className="bars-legend">
        {series.map((s) => (
          <li key={s.label}>
            <span className={`legend-swatch tone-${s.tone}`} aria-hidden="true" />
            {s.label} <span className="muted">({s.summary.combos} komb.)</span>
          </li>
        ))}
      </ul>
      {rows.map(([key, name]) => (
        <div key={key} className={key === 'tpPlus' ? 'bars-row total' : 'bars-row'}>
          <div className="bars-name">{name}</div>
          {series.map((s) => {
            const share = shareOf(s.summary, key);
            return (
              <div key={s.label} className="bars-line" aria-label={`${s.label}: ${name} ${pctText(share)}`}>
                <div className="bars-track" aria-hidden="true">
                  <div className={`bars-fill tone-${s.tone}`} style={{ width: `${Math.min(100, share * 100)}%` }} />
                </div>
                <span className="bars-value">{pctText(share)}</span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

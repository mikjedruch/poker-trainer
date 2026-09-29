import type { DrawSpot } from '../../core/draws';
import type { BetSpot } from '../../core/math/betting';
import { usd } from '../../core/math/format';
import type { ExplanationBlock } from '../../core/math/tasks';
import { CardRow } from '../../shared/PlayingCard';

export function HandView({ hand }: { hand: DrawSpot }) {
  return (
    <div className="hand-view">
      <div className="hand-row">
        <span className="hand-label">Ty</span>
        <CardRow cards={hand.hero} />
      </div>
      <div className="hand-row">
        <span className="hand-label">{hand.street === 'flop' ? 'Flop' : 'Turn'}</span>
        <CardRow cards={hand.board} />
      </div>
      <div className="hand-row">
        <span className="hand-label">Przeciwnik</span>
        <CardRow cards={hand.villain} />
      </div>
    </div>
  );
}

export function SpotView({ spot, showStack }: { spot: BetSpot; showStack: boolean }) {
  return (
    <div className="spot-view">
      <span className="pill">Pula {usd(spot.pot)}</span>
      <span className="pill">Bet {usd(spot.bet)}</span>
      {showStack && <span className="pill">Stack {usd(spot.stack)}</span>}
    </div>
  );
}

export function Explanation({ blocks }: { blocks: readonly ExplanationBlock[] }) {
  return (
    <section className="explanation">
      <h2>Wyjaśnienie</h2>
      {blocks.map((b, i) => {
        if (b.kind === 'text') return <p key={i}>{b.text}</p>;
        if (b.kind === 'formula')
          return (
            <p key={i} className="formula">
              {b.text}
            </p>
          );
        return (
          <div key={i} className="card-group">
            <div className="card-group-label">{b.label}</div>
            <CardRow cards={b.cards} size="sm" />
          </div>
        );
      })}
    </section>
  );
}

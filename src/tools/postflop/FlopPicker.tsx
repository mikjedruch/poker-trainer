import { useState } from 'react';
import type { Card } from '../../core/cards';
import { RANK_CHARS, makeCard, parseCards } from '../../core/cards';
import { PlayingCard, SuitIcon } from '../../shared/PlayingCard';

const RANKS_DESC = Array.from({ length: 13 }, (_, i) => 12 - i);
const RANK_LABELS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const SUIT_ORDER = [3, 2, 1, 0]; // spades, hearts, diamonds, clubs
const SUIT_NAMES = ['trefl', 'karo', 'kier', 'pik'];
const SUIT_CLASSES = ['clubs', 'diamonds', 'hearts', 'spades'];

export type FlopSlots = [Card | null, Card | null, Card | null];

/**
 * Three card slots. Tap a slot, then a rank and a suit; the next empty slot opens on its own.
 * Cards already on the flop cannot be picked twice. The flop can also be typed ("Ks 7d 2c").
 */
export function FlopPicker({ slots, onChange, onRandom }: { slots: FlopSlots; onChange: (s: FlopSlots) => void; onRandom: () => void }) {
  const [open, setOpen] = useState<number | null>(null);
  const [rank, setRank] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const used = (card: Card, except: number) => slots.some((c, i) => i !== except && c === card);

  function pickSuit(suit: number) {
    if (open === null || rank === null) return;
    const card = makeCard(rank, suit);
    if (used(card, open)) return;
    const next = [...slots] as FlopSlots;
    next[open] = card;
    onChange(next);
    setRank(null);
    const empty = next.findIndex((c, i) => c === null && i !== open);
    setOpen(empty >= 0 ? empty : null);
  }

  function applyText() {
    try {
      const cards = parseCards(text);
      if (cards.length !== 3) throw new Error('3');
      onChange([cards[0]!, cards[1]!, cards[2]!]);
      setError(null);
      setOpen(null);
      setText('');
    } catch {
      setError('Wpisz trzy różne karty, np. Ks 7d 2c (rangi 2–9, T, J, Q, K, A; kolory s, h, d, c).');
    }
  }

  return (
    <div className="flop-picker">
      <div className="flop-slots">
        {slots.map((card, i) => (
          <button
            key={i}
            type="button"
            className={`flop-slot${open === i ? ' open' : ''}`}
            aria-label={card === null ? `Karta ${i + 1}: wybierz` : `Karta ${i + 1}: zmień`}
            aria-expanded={open === i}
            onClick={() => {
              setOpen(open === i ? null : i);
              setRank(null);
            }}
          >
            {card === null ? <span className="slot-empty">?</span> : <PlayingCard card={card} />}
          </button>
        ))}
        <button type="button" className="btn secondary flop-random" onClick={onRandom}>
          Losuj flop
        </button>
      </div>

      {open !== null && (
        <div className="card-chooser">
          <div className="chooser-label">Karta {open + 1}: ranga</div>
          <div className="rank-keys">
            {RANKS_DESC.map((r) => (
              <button key={r} type="button" className={`chooser-key${rank === r ? ' active' : ''}`} onClick={() => setRank(r)}>
                {RANK_LABELS[r]}
              </button>
            ))}
          </div>
          <div className="chooser-label">kolor</div>
          <div className="suit-keys">
            {SUIT_ORDER.map((s) => {
              const disabled = rank === null || used(makeCard(rank, s), open);
              return (
                <button
                  key={s}
                  type="button"
                  className={`chooser-key suit ${SUIT_CLASSES[s]}`}
                  disabled={disabled}
                  aria-label={rank === null ? SUIT_NAMES[s] : `${RANK_CHARS[rank]} ${SUIT_NAMES[s]}`}
                  onClick={() => pickSuit(s)}
                >
                  <SuitIcon suit={s} />
                </button>
              );
            })}
          </div>
        </div>
      )}

      <form
        className="flop-text"
        onSubmit={(e) => {
          e.preventDefault();
          applyText();
        }}
      >
        <input
          className="text-field"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="albo wpisz, np. Ks 7d 2c"
          aria-label="Flop w notacji, np. Ks 7d 2c"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <button type="submit" className="btn secondary" disabled={text.trim() === ''}>
          Ustaw
        </button>
      </form>
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}

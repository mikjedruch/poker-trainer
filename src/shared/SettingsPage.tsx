import type { Card } from '../core/cards';
import { parseCards } from '../core/cards';
import type { SeatInfo } from './PokerTable';
import { PokerTable } from './PokerTable';
import { CardRow } from './PlayingCard';
import { href } from './router';
import type { Deck, Theme } from './settings';
import { updateSettings, useSettings } from './settings';

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: ReadonlyArray<[T, string]>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="segmented">
      {options.map(([v, label]) => (
        <button key={v} type="button" aria-pressed={v === value} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  );
}

const THEMES: ReadonlyArray<[Theme, string]> = [
  ['dark', 'Ciemny'],
  ['light', 'Jasny'],
];

const DECKS: ReadonlyArray<[Deck, string]> = [
  ['four', '4 kolory'],
  ['two', '2 kolory'],
];

// Preview only: one card of each suit, and a sample preflop table (UTG limps, hero on CO).
const PREVIEW_CARDS: Card[] = parseCards('As Kh Qd Jc');
const PREVIEW_SEATS: SeatInfo[] = [
  { position: 'UTG', bet: 2 },
  { position: 'HJ', folded: true },
  { position: 'SB', bet: 1 },
  { position: 'BB', bet: 2 },
];
const PREVIEW_POT = PREVIEW_SEATS.reduce((sum, s) => sum + (s.bet ?? 0), 0);

export function SettingsPage() {
  const settings = useSettings();

  return (
    <div className="page">
      <header className="topbar">
        <a className="topbar-link back" href={href('/')} aria-label="Wróć do menu">
          ←
        </a>
        <h1>Ustawienia</h1>
        <span className="topbar-link" />
      </header>

      <div className="setting">
        <div className="setting-label">Motyw</div>
        <p className="setting-hint muted">Ciemny oszczędza oczy przy stole, jasny jest czytelniejszy w słońcu.</p>
        <Segmented options={THEMES} value={settings.theme} onChange={(theme) => updateSettings({ theme })} />
      </div>

      <div className="setting">
        <div className="setting-label">Talia</div>
        <p className="setting-hint muted">
          4 kolory: ♠ czarny, ♥ czerwony, ♦ niebieski, ♣ zielony. Mniej pomyłek przy liczeniu kolorów.
        </p>
        <Segmented options={DECKS} value={settings.deck} onChange={(deck) => updateSettings({ deck })} />
      </div>

      <h2 className="section-title">Podgląd</h2>
      <div className="preview">
        <CardRow cards={PREVIEW_CARDS} />
        <PokerTable heroPosition="CO" seats={PREVIEW_SEATS} pot={PREVIEW_POT} />
        <p className="muted setting-hint">Stół z pozycjami pojawi się w treningu preflopu i postflopu.</p>
      </div>
    </div>
  );
}

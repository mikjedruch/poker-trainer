import type { PadKey } from './padInput';

const ROWS: PadKey[][] = [
  ['1', '2', '3', 'back'],
  ['4', '5', '6', '.'],
  ['7', '8', '9', '0'],
];

function BackspaceIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M9 5h11a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-6-7z" />
      <path d="M12.5 9.5l5 5M17.5 9.5l-5 5" />
    </svg>
  );
}

/** Large on-screen keypad (phone layout). Editing rules live in numberPad.ts. */
export function NumberPad({ onKey, decimals }: { onKey: (key: PadKey) => void; decimals: boolean }) {
  return (
    <div className="pad-keys">
      {ROWS.flat().map((key) => {
        if (key === 'back')
          return (
            <button key={key} type="button" className="pad-key fn" aria-label="Usuń" onClick={() => onKey(key)}>
              <BackspaceIcon />
            </button>
          );
        if (key === '.')
          return (
            <button
              key={key}
              type="button"
              className="pad-key fn"
              aria-label="Przecinek dziesiętny"
              disabled={!decimals}
              onClick={() => onKey(key)}
            >
              .
            </button>
          );
        return (
          <button key={key} type="button" className="pad-key" onClick={() => onKey(key)}>
            {key}
          </button>
        );
      })}
    </div>
  );
}

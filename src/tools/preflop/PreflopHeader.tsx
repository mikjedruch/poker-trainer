import { href } from '../../shared/router';
import { TabLinks } from '../../shared/Segmented';

export const PREFLOP_TABS: ReadonlyArray<readonly [string, string]> = [
  ['/preflop', 'Drill'],
  ['/preflop/zakresy', 'Zakresy'],
  ['/preflop/stats', 'Statystyki'],
];

/** Top bar and Drill / Zakresy / Statystyki tabs shared by the preflop screens. */
export function PreflopHeader({ current }: { current: string }) {
  return (
    <>
      <header className="topbar">
        <a className="topbar-link back" href={href('/')} aria-label="Wróć do menu">
          ←
        </a>
        <h1>Preflop</h1>
        <span className="topbar-link" />
      </header>
      <TabLinks tabs={PREFLOP_TABS} current={current} />
    </>
  );
}

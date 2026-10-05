import { href } from '../../shared/router';
import { TabLinks } from '../../shared/Segmented';
import { setActiveProfile, useProfiles } from './profileStore';

export const POSTFLOP_TABS: ReadonlyArray<readonly [string, string]> = [
  ['/postflop', 'Quiz'],
  ['/postflop/analiza', 'Analiza'],
  ['/postflop/profile', 'Profile'],
];

/** Top bar and Quiz / Analiza / Profile tabs shared by the postflop screens. */
export function PostflopHeader({ current }: { current: string }) {
  return (
    <>
      <header className="topbar">
        <a className="topbar-link back" href={href('/')} aria-label="Wróć do menu">
          ←
        </a>
        <h1>Postflop</h1>
        <a className="topbar-link" href={href('/postflop/stats')} aria-current={current === '/postflop/stats' ? 'page' : undefined}>
          Statystyki
        </a>
      </header>
      <TabLinks tabs={POSTFLOP_TABS} current={current} />
    </>
  );
}

/** Active opponent profile, used by the quiz and the analysis. Compact: one row, no note. */
export function ProfileSelect({ compact = false }: { compact?: boolean }) {
  const { profiles, active } = useProfiles();
  return (
    <div className={compact ? 'profile-select compact' : 'profile-select'}>
      <label className="field-label" htmlFor="postflop-profile">
        {compact ? 'Przeciwnik' : 'Przeciwnik (profil)'}
      </label>
      <select id="postflop-profile" className="select-field" value={active.id} onChange={(e) => setActiveProfile(e.target.value)}>
        {profiles.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
            {p.builtIn ? '' : ' (własny)'}
          </option>
        ))}
      </select>
      {!compact && <p className="muted profile-note">Założenie: {active.assumptions}</p>}
    </div>
  );
}

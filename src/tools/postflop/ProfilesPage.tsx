import { useState } from 'react';
import type { Profile } from '../../core/postflop/profiles';
import { RANGE_KEYS, RANGE_KEY_SHORT_PL, comboCountOf } from '../../core/postflop/profiles';
import { href } from '../../shared/router';
import { PostflopHeader } from './PostflopHeader';
import { createCopy, deleteCustomProfile, setActiveProfile, useProfiles } from './profileStore';

export const editPath = (id: string): string => `/postflop/profile/${encodeURIComponent(id)}`;

function ProfileCard({ profile, active }: { profile: Profile; active: boolean }) {
  const [confirm, setConfirm] = useState(false);

  function copy() {
    const created = createCopy(profile);
    window.location.hash = href(editPath(created.id));
  }

  return (
    <section className={`profile-card${active ? ' active' : ''}`}>
      <div className="profile-head">
        <strong>{profile.name}</strong>
        <span className="badge">{profile.builtIn ? 'wbudowany' : 'własny'}</span>
        {active && <span className="badge accent">aktywny</span>}
      </div>
      <p className="muted">Założenie: {profile.assumptions}</p>
      <ul className="profile-ranges">
        {RANGE_KEYS.map((k) => (
          <li key={k}>
            <span>{RANGE_KEY_SHORT_PL[k]}</span>
            <span className="muted">{comboCountOf(profile.ranges[k])} komb.</span>
          </li>
        ))}
      </ul>
      {confirm ? (
        <div className="btn-pair">
          <button className="btn secondary" onClick={() => setConfirm(false)}>
            Anuluj
          </button>
          <button className="btn danger" onClick={() => deleteCustomProfile(profile.id)}>
            Tak, usuń
          </button>
        </div>
      ) : (
        <div className="profile-actions">
          {!active && (
            <button className="btn primary" onClick={() => setActiveProfile(profile.id)}>
              Używaj
            </button>
          )}
          <button className="btn secondary" onClick={copy}>
            Kopiuj
          </button>
          {!profile.builtIn && (
            <>
              <a className="btn secondary" href={href(editPath(profile.id))}>
                Edytuj
              </a>
              <button className="btn secondary" onClick={() => setConfirm(true)}>
                Usuń
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}

export function ProfilesPage() {
  const { profiles, active } = useProfiles();
  return (
    <div className="page postflop">
      <PostflopHeader current="/postflop/profile" />
      <p className="muted">
        Profil to zakresy, z którymi przeciwnik sprawdza Twój open, i jedno założenie o jego grze po flopie. Aktywny profil działa w quizie i w
        analizie. Skopiuj profil i dopasuj zakresy do swojego stołu — palcem na siatce albo notacją.
      </p>
      {profiles.map((p) => (
        <ProfileCard key={p.id} profile={p} active={p.id === active.id} />
      ))}
    </div>
  );
}

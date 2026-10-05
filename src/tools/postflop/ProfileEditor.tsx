import { useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { RangeKey } from '../../core/postflop/profiles';
import {
  MAX_NAME_LENGTH,
  RANGE_KEYS,
  RANGE_KEY_NAMES_PL,
  assumptionText,
  cleanName,
  comboCountOf,
  parseProfileRange,
} from '../../core/postflop/profiles';
import { HU_SCENARIOS, HU_SCENARIO_DEFS } from '../../core/postflop/scenarios';
import type { HandClass } from '../../core/range';
import { formatRange } from '../../core/range';
import { useElementHeight } from '../../shared/actionBar';
import { PaintGrid } from '../../shared/PaintGrid';
import { href } from '../../shared/router';
import { PostflopHeader } from './PostflopHeader';
import type { CustomProfile } from './profileStore';
import { saveCustomProfile, useProfiles } from './profileStore';

const usedIn = (key: RangeKey): string =>
  HU_SCENARIOS.filter((s) => HU_SCENARIO_DEFS[s].villainRange === key).join(', ');

const cloneProfile = (p: CustomProfile): CustomProfile => ({
  ...p,
  ranges: Object.fromEntries(RANGE_KEYS.map((k) => [k, new Set(p.ranges[k])])) as Record<RangeKey, Set<HandClass>>,
});

function Editor({ original }: { original: CustomProfile }) {
  const [draft, setDraft] = useState<CustomProfile>(() => cloneProfile(original));
  const [name, setName] = useState(original.name);
  const [key, setKey] = useState<RangeKey>('bbVsEarly');
  const [notation, setNotation] = useState(() => formatRange(original.ranges.bbVsEarly));
  const [notationError, setNotationError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const barHeight = useElementHeight(barRef);

  const range = draft.ranges[key];
  const combos = comboCountOf(range);

  function setRange(next: Set<HandClass>, k: RangeKey = key) {
    setDraft((d) => ({ ...d, ranges: { ...d.ranges, [k]: next } }));
    if (k === key) {
      setNotation(formatRange(next));
      setNotationError(null);
    }
  }

  function chooseKey(k: RangeKey) {
    setKey(k);
    setNotation(formatRange(draft.ranges[k]));
    setNotationError(null);
  }

  function applyNotation() {
    try {
      // "@SCENARIO.call" references are for profiles.json only; here the user types hands.
      if (notation.trim().startsWith('@')) throw new Error('reference');
      setRange(parseProfileRange(notation));
    } catch (e) {
      const msg = (e as Error).message;
      setNotationError(
        msg.startsWith('Range covers only part')
          ? `Notacja obejmuje tylko część komórki (${msg.replace('Range covers only part of ', '')}). Siatka działa na całych komórkach, np. AKs zamiast AsKs.`
          : 'Nie rozumiem tej notacji. Przykład: 22-JJ, A2s-AQs, K9s+, AJo-AQo, KQo',
      );
    }
  }

  function save() {
    const clean = cleanName(name);
    if (!clean) {
      setSaveError('Podaj nazwę profilu.');
      return;
    }
    const empty = RANGE_KEYS.find((k) => draft.ranges[k].size === 0);
    if (empty) {
      setSaveError(`Zakres „${RANGE_KEY_NAMES_PL[empty]}” jest pusty — zaznacz choć jedną rękę.`);
      return;
    }
    saveCustomProfile({ ...draft, name: clean, assumptions: assumptionText(draft.callsTooMuch) });
    window.location.hash = href('/postflop/profile');
  }

  return (
    <div className="page postflop" style={{ '--bar-space': `${barHeight}px` } as CSSProperties}>
      <PostflopHeader current="/postflop/profile" />

      <label className="field-label" htmlFor="profile-name">
        Nazwa
      </label>
      <input
        id="profile-name"
        className="text-field"
        value={name}
        maxLength={MAX_NAME_LENGTH}
        onChange={(e) => setName(e.target.value)}
      />

      <label className="toggle-row">
        <input
          type="checkbox"
          checked={draft.callsTooMuch}
          onChange={(e) => setDraft((d) => ({ ...d, callsTooMuch: e.target.checked }))}
        />
        <span>
          <strong>Za często sprawdza postflop, rzadko blefuje</strong>
          <span className="muted">
            {' '}
            — mniej blefów, cieńsze value (jak loose-live). Wyłączone: gra jak zakresy bazowe.
          </span>
        </span>
      </label>

      <label className="field-label" htmlFor="profile-range">
        Zakres do edycji
      </label>
      <select id="profile-range" className="select-field" value={key} onChange={(e) => chooseKey(e.target.value as RangeKey)}>
        {RANGE_KEYS.map((k) => (
          <option key={k} value={k}>
            {RANGE_KEY_NAMES_PL[k]} ({usedIn(k)})
          </option>
        ))}
      </select>

      <p className="cell-summary">
        {combos} komb. · {((combos / 1326) * 100).toFixed(1)}% rąk · zielone = sprawdza
      </p>
      <PaintGrid selected={range} onChange={(next) => setRange(next)} />
      <p className="muted grid-note">Dotknij komórki i przeciągnij palcem: zaczynając od pustej dodajesz ręce, od zaznaczonej — usuwasz.</p>

      <div className="btn-pair">
        <button className="btn secondary" onClick={() => setRange(new Set())}>
          Wyczyść
        </button>
        <button className="btn secondary" onClick={() => setRange(new Set(original.ranges[key]))}>
          Przywróć zapisany
        </button>
      </div>

      <label className="field-label notation-label" htmlFor="profile-notation">
        Notacja
      </label>
      <textarea
        id="profile-notation"
        className="text-field notation"
        value={notation}
        rows={4}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        onChange={(e) => setNotation(e.target.value)}
      />
      {notationError && <p className="field-error">{notationError}</p>}
      <button className="btn secondary wide" onClick={applyNotation}>
        Zastosuj notację
      </button>

      <div className="action-bar" ref={barRef}>
        <div className="bar-stack">
          {saveError && <p className="field-error">{saveError}</p>}
          <div className="bar-row">
            <a className="btn secondary" href={href('/postflop/profile')}>
              Anuluj
            </a>
            <button className="btn primary" onClick={save}>
              Zapisz
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProfileEditor({ id }: { id: string }) {
  const { custom } = useProfiles();
  const original = custom.find((p) => p.id === id);
  if (!original) {
    return (
      <div className="page postflop">
        <PostflopHeader current="/postflop/profile" />
        <p>Nie ma takiego profilu własnego.</p>
        <a className="btn secondary wide" href={href('/postflop/profile')}>
          Wróć do listy profili
        </a>
      </div>
    );
  }
  return <Editor key={original.id} original={original} />;
}

import { href } from './router';

/** Two to four mutually exclusive options, e.g. theme or deck. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: ReadonlyArray<readonly [T, string]>;
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

/** Same look as Segmented, but each option is a route (e.g. Drill / Zakresy). */
export function TabLinks({ tabs, current }: { tabs: ReadonlyArray<readonly [string, string]>; current: string }) {
  return (
    <nav className="segmented tabs">
      {tabs.map(([path, label]) => (
        <a key={path} href={href(path)} aria-current={path === current ? 'page' : undefined}>
          {label}
        </a>
      ))}
    </nav>
  );
}

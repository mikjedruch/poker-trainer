import { href, useHashPath } from './shared/router';
import { MathTrainer } from './tools/math/MathTrainer';
import { MathStats } from './tools/math/MathStats';

const TOOLS = [
  { path: '/math', title: 'Matematyka', description: 'Outy, equity, pot odds, MDF, implied odds', ready: true },
  { path: '/preflop', title: 'Preflop', description: 'Zakresy otwarć i obrony', ready: false },
  { path: '/postflop', title: 'Postflop', description: 'Decyzje na flopie, turnie i riverze', ready: false },
  { path: '/rules', title: 'Zasady', description: 'Przepisy i sytuacje przy stole live', ready: false },
];

function Home() {
  return (
    <main className="page">
      <header className="home-header">
        <h1>Trener pokera</h1>
        <p className="muted">Live 6-max NLHE · blindy $1/$2 · stack $200</p>
      </header>
      <nav className="tool-list">
        {TOOLS.map((tool) =>
          tool.ready ? (
            <a key={tool.path} className="tool-tile" href={href(tool.path)}>
              <strong>{tool.title}</strong>
              <span>{tool.description}</span>
            </a>
          ) : (
            <div key={tool.path} className="tool-tile disabled" aria-disabled="true">
              <strong>{tool.title}</strong>
              <span>{tool.description}</span>
              <em>wkrótce</em>
            </div>
          ),
        )}
      </nav>
    </main>
  );
}

export function App() {
  const path = useHashPath();
  if (path === '/math') return <MathTrainer />;
  if (path === '/math/stats') return <MathStats />;
  return <Home />;
}

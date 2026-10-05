// Builds src/data/flop-library.json: 150 flops stratified by texture (15 strata × 10), each analysed
// for scenarios P1–P5 against the built-in profiles. Runs before every build. The output is
// deterministic (fixed seed); when the file already matches the current ranges it is kept as is.
//
//   npm run precompute            (skips if up to date)
//   npm run precompute -- --force (always recomputes)

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { FlopLibrary } from '../src/core/postflop/library';
import {
  FLOPS_PER_STRATUM,
  LIBRARY_VERSION,
  STRATA,
  buildLibraryFlop,
  librarySignatures,
  sampleStratifiedFlops,
} from '../src/core/postflop/library';
import { createRng } from '../src/core/rng';

const SEED = 20261005;
const OUT = fileURLToPath(new URL('../src/data/flop-library.json', import.meta.url));
const force = process.argv.includes('--force');

function upToDate(): boolean {
  if (!existsSync(OUT)) return false;
  try {
    const old = JSON.parse(readFileSync(OUT, 'utf8')) as FlopLibrary;
    return (
      old.version === LIBRARY_VERSION &&
      old.seed === SEED &&
      old.flops.length === STRATA.length * FLOPS_PER_STRATUM &&
      JSON.stringify(old.ranges) === JSON.stringify(librarySignatures())
    );
  } catch {
    return false;
  }
}

if (!force && upToDate()) {
  console.log('precompute-flops: library is up to date (same version, seed and ranges), skipping');
} else {
  const started = performance.now();
  const flops = sampleStratifiedFlops(createRng(SEED), FLOPS_PER_STRATUM);
  const library: FlopLibrary = { version: LIBRARY_VERSION, seed: SEED, ranges: librarySignatures(), flops: [] };

  flops.forEach((flop, i) => {
    library.flops.push(buildLibraryFlop(flop));
    if ((i + 1) % 25 === 0 || i + 1 === flops.length) {
      const seconds = ((performance.now() - started) / 1000).toFixed(1);
      console.log(`precompute-flops: ${i + 1}/${flops.length} flops (${seconds} s)`);
    }
  });

  // One flop per line: readable diffs when ranges change.
  const lines = library.flops.map((f) => `    ${JSON.stringify(f)}`);
  const header = JSON.stringify({ version: library.version, seed: library.seed, ranges: library.ranges }, null, 2).slice(0, -2);
  writeFileSync(OUT, `${header},\n  "flops": [\n${lines.join(',\n')}\n  ]\n}\n`);
  console.log(`precompute-flops: wrote ${OUT}`);
}

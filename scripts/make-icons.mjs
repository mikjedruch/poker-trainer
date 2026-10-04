// Generates PWA icons (white spade on graphite) without any image dependencies.
// Run: npm run icons
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BG = [21, 23, 27]; // --color-bg (dark) in src/shared/theme.css
const FG = [242, 239, 228];

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size, pixel) {
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixel(x, y);
      const i = y * (size * 3 + 1) + 1 + x * 3;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Spade in unit coordinates centred at (0, 0): an upside-down heart plus a stem. */
function insideSpade(x, y) {
  // Heart curve (x² + y² − 1)³ − x² y³ ≤ 0, flipped vertically and scaled.
  // In image coordinates (y down) the heart's point is at the top: exactly a spade's outline.
  const hx = x / 0.6;
  const hy = (y + 0.25) / 0.55;
  const a = hx * hx + hy * hy - 1;
  if (a * a * a - hx * hx * hy * hy * hy <= 0) return true;
  // Stem: a flared triangle under the lobes.
  if (y > 0.2 && y < 0.78) {
    const half = 0.03 + (y - 0.2) * 0.38;
    return Math.abs(x) <= half;
  }
  return false;
}

function icon(size, scale) {
  const samples = 4;
  return png(size, (px, py) => {
    let hits = 0;
    for (let sy = 0; sy < samples; sy++)
      for (let sx = 0; sx < samples; sx++) {
        const x = ((px + (sx + 0.5) / samples) / size - 0.5) * 2 / scale;
        const y = ((py + (sy + 0.5) / samples) / size - 0.5) * 2 / scale;
        if (insideSpade(x, y)) hits++;
      }
    const t = hits / (samples * samples);
    return BG.map((c, i) => Math.round(c + (FG[i] - c) * t));
  });
}

mkdirSync('public', { recursive: true });
// Scale 0.8 keeps the spade inside the maskable safe zone.
writeFileSync('public/icon-192.png', icon(192, 0.8));
writeFileSync('public/icon-512.png', icon(512, 0.8));
writeFileSync('public/apple-touch-icon.png', icon(180, 0.8));
console.log('Icons written to public/');

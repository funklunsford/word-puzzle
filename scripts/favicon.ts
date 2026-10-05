// The browser-tab icon: the wordmark's S, in the game's own ink, on the dark board colour.
//
//   npx vite-node scripts/favicon.ts   # → public/favicon.svg

import { writeFileSync } from 'node:fs';
import { LETTERS } from '../src/glyphs';
import { inkOutline, inkSeed } from '../src/ink';

const S = LETTERS.S.parts;
// The S spans about x 0–1.25 and y 0–2 in letter units; centre it in a 32-unit square.
const UNIT = 10.5;
const cx = 16 - (1.25 / 2) * UNIT;
const cy = 16 - 1 * UNIT;
// A bold pen, so the S still reads at 16 px.
const strokes = S.map((p) => {
  const d = inkOutline(p.tile, p.rot ?? 0, inkSeed(p), 0.15);
  return `<path d="${d}" transform="translate(${(cx + p.x * UNIT).toFixed(2)} ${(cy + p.y * UNIT).toFixed(2)}) scale(${UNIT})" fill="#e2a0a0"/>`;
});
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#1f1d26"/>${strokes.join('')}</svg>
`;
writeFileSync(new URL('../public/favicon.svg', import.meta.url), svg);
console.log(`public/favicon.svg: ${svg.length} bytes`);

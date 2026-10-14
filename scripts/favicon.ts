// The browser-tab icon: four of the game's stroke tiles, as the tray shows them (the long bar, the
// rising slash, the big arc and the big chevron), drawn by the game's own ink renderer in the dark
// theme's colours (read from src/styles.css), on a board-coloured square with a ledge like the cells'.
//
//   npx vite-node scripts/favicon.ts   # → public/favicon.svg

import { readFileSync, writeFileSync } from 'node:fs';
import { TILES, type TileId } from '../src/glyphs';
import { inkOutline, inkSeed } from '../src/ink';

// The dark theme's colours, as the game has them.
const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const dark = css.slice(css.indexOf(":root[data-theme='dark']"));
const color = (name: string) => dark.match(new RegExp(`--${name}: (#[0-9a-f]{6})`))![1];
const rgb = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
/** CSS's color-mix(in srgb, a share, b). */
const mix = (a: string, share: number, b: string) => `#${rgb(a).map((x, i) => Math.round(x * share + rgb(b)[i] * (1 - share)).toString(16).padStart(2, '0')).join('')}`;
const f = (n: number) => +n.toFixed(2);

const [BG, SURFACE, LINE, LEDGE] = ['bg', 'surface', 'line', 'ledge'].map(color);
// The icon fills a 32-unit square: a face 30.5 tall on a 1.5-unit ledge, with the tiles in a 2×2.
const FACE = 30.5;
const SIZE = 12.8;
const GAP = 1.6;
const TILE_IDS: TileId[] = ['LV', 'LD', 'C', 'BV'];

/**
 * A tray tile centred at (cx, cy): tinted a little more than the header's parts (16% of its colour,
 * not 12%) and its stroke drawn with a broader pen, so both still read at 16 px.
 */
function tile(id: TileId, cx: number, cy: number) {
  const ink = color(`t-${id}`);
  const rot = TILES[id].display ?? 0;
  // The stroke at the header's scale for a tile (0.55 of a 1.6-unit tile).
  const unit = SIZE * (0.55 / 1.6);
  // Two decimals are plenty at this size, and keep the file small.
  const d = inkOutline(id, rot, inkSeed({ tile: id, x: 0, y: 0, rot }), 0.13, 1, undefined, [0, 0], 2.8).replace(/-?\d+\.\d+/g, (n) => String(+(+n).toFixed(2)));
  return (
    `<rect x="${f(cx - SIZE / 2)}" y="${f(cy - SIZE / 2)}" width="${SIZE}" height="${SIZE}" rx="${f(SIZE * 0.2375)}" fill="${mix(ink, 0.16, SURFACE)}" stroke="${mix(ink, 0.3, LINE)}" stroke-width="${f(SIZE * 0.03)}"/>` +
    `<path d="${d}" transform="translate(${f(cx)} ${f(cy)}) scale(${f(unit)})" fill="${ink}"/>`
  );
}

const step = (SIZE + GAP) / 2;
const tiles = TILE_IDS.map((id, i) => tile(id, 16 + (i % 2 ? step : -step), FACE / 2 + (i < 2 ? -step : step)));
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect y="1.5" width="32" height="${FACE}" rx="7" fill="${LEDGE}"/><rect width="32" height="${FACE}" rx="7" fill="${BG}" stroke="${LINE}" stroke-width="0.6"/>${tiles.join('')}</svg>
`;
writeFileSync(new URL('../public/favicon.svg', import.meta.url), svg);
console.log(`public/favicon.svg: ${svg.length} bytes`);

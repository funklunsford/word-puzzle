// Analyze every possible board against the ENABLE word list and write a handful of
// play-testable boards to public/boards.json.
//
//   npx vite-node scripts/boards.ts [--stats]

import { readFileSync, writeFileSync } from 'node:fs';
import { TILE_IDS, type TileId } from '../src/glyphs';
import { MIN_LENGTH, tilesFor, type Board } from '../src/game';

const MIN_WORDS = 40;
const MAX_WORDS = 600;
const PICK = 8;

const words = readFileSync(new URL('../data/enable1.txt', import.meta.url), 'utf8')
  .split('\n')
  .map((w) => w.trim().toUpperCase())
  .filter((w) => w.length >= MIN_LENGTH && /^[A-Z]+$/.test(w));
const wordTiles = words.map((w) => ({ w, tiles: tilesFor(w) }));

function* subsets<T>(items: T[], k: number, start = 0, acc: T[] = []): Generator<T[]> {
  if (acc.length === k) return yield acc;
  for (let i = start; i < items.length; i++) yield* subsets(items, k, i + 1, [...acc, items[i]]);
}

/**
 * Non-center tiles that, across the board's words, only ever appear alongside some other
 * non-center tile ("T>O"). Such a tile can never be smushed independently. Every word uses
 * the center, so it never counts.
 */
function tiedTiles(tiles: TileId[], center: TileId, valid: Set<TileId>[]): string[] {
  const charged = tiles.filter((t) => t !== center);
  const tied: string[] = [];
  for (const t of charged) {
    const withT = valid.filter((s) => s.has(t));
    const always = charged.filter((o) => o !== t && withT.every((s) => s.has(o)));
    if (!withT.length) tied.push(`${t}>unused`);
    else if (always.length) tied.push(`${t}>${always.join('+')}`);
  }
  return tied;
}

interface Candidate extends Board {
  score: number;
}

const candidates: Candidate[] = [];
const stats: Record<number, { boards: number; withPangram: number; inRange: number; untied: number }> = {};

for (const k of [5, 6, 7]) {
  stats[k] = { boards: 0, withPangram: 0, inRange: 0, untied: 0 };
  for (const tiles of subsets(TILE_IDS, k)) {
    const set = new Set(tiles);
    const fits = wordTiles.filter(({ tiles: t }) => [...t].every((x) => set.has(x)));
    const pangrams = fits.filter(({ tiles: t }) => t.size === set.size).map(({ w }) => w);
    stats[k].boards++;
    if (!pangrams.length) continue;
    stats[k].withPangram++;
    for (const center of tiles) {
      const valid = fits.filter(({ tiles: t }) => t.has(center));
      if (valid.length < MIN_WORDS || valid.length > MAX_WORDS) continue;
      const tied = tiedTiles(tiles, center, valid.map((v) => v.tiles));
      if (tied.some((t) => t.endsWith('>unused'))) continue;
      stats[k].inRange++;
      if (!tied.length) stats[k].untied++;
      const others = tiles.filter((t) => t !== center);
      candidates.push({
        id: `${tiles.join('-')}@${center}`,
        tiles,
        center,
        spicy: others[0],
        pangrams,
        words: valid.map(({ w }) => w),
        tied,
        // Prefer mid-sized boards with few pangrams and few tied tiles.
        score: -Math.abs(valid.length - 250) - 10 * Math.max(0, pangrams.length - 3) - 25 * tied.length,
      });
    }
  }
}

console.table(stats);

// Greedy pick: good boards that don't overlap too much with ones already chosen.
candidates.sort((a, b) => b.score - a.score);
const chosen: Candidate[] = [];
for (const c of candidates) {
  if (chosen.length >= PICK) break;
  const tooSimilar = chosen.some((o) => o.tiles.filter((t) => c.tiles.includes(t)).length >= c.tiles.length - 1);
  if (!tooSimilar) chosen.push(c);
}

for (const c of chosen) {
  console.log(`${c.id.padEnd(28)} words=${c.words.length} pangrams=${c.pangrams.slice(0, 4).join(',')} tied=${c.tied?.join(' ') || '-'}`);
}

const out: Board[] = chosen.map(({ score: _score, ...board }) => board);
writeFileSync(new URL('../public/boards.json', import.meta.url), JSON.stringify(out));
console.log(`wrote ${out.length} boards`);

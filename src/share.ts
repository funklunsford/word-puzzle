// Sharing a result: a picture card with the link back (no text to paste). The card shows the solve's
// shape, never its words: the start and goal in ink, and between them a row of squares per step, a
// square per letter, coloured by how many strokes went into that letter, with the step's strokes
// beside it. (A stroke moved from one letter to another colours both, so a row's squares can add up
// to more than it cost.) There's also the link preview for the site itself (og.png).

import { LETTERS, TILE_IDS, TRAY_TURN, drawnScale, drawnWidth, type TileId } from './glyphs';
import { inkOutline, inkSeed, opticalOffset } from './ink';
import { scoreName } from './golf';
import { spaced } from './spacing';
import { letterDiff } from './strokes';
import { palette, type PaletteChoice } from './palettes';

export interface ShareResult {
  /** The daily's number and date, if it's a daily. */
  number?: number;
  date?: string;
  start: string;
  goal: string;
  strokes: number;
  best: number;
  hints: number;
  hardcore: boolean;
  /** An Easycore daily (see src/easycore.ts): numbered like the classic ones, but another puzzle. */
  easycore?: boolean;
  /** Each step: the word it started from, the word it made, and what it cost. */
  steps: { from: string; to: string; cost: number }[];
}

/** What a result's card and share say it is, after its number: Easycore, or (for the 5-letter game) 5 letters. */
export const shareLabel = (r: Pick<ShareResult, 'easycore' | 'start'>) => (r.easycore ? 'Easycore' : r.start.length !== 4 ? `${r.start.length} letters` : '');

/** The share's title: "Strokes No. 15 · 5 letters", or for Easycore's No. 15, "Strokes No. 15 · Easycore". */
export function shareTitle(r: Pick<ShareResult, 'number' | 'easycore' | 'start'>): string {
  const label = shareLabel(r);
  return `Strokes${r.number ? ` No. ${r.number}` : ''}${label ? ` · ${label}` : ''}`;
}

/** The site's public address, with a trailing slash (VITE_SITE_URL in .env). */
export const SITE: string = import.meta.env.VITE_SITE_URL;

/** Strokes a letter change takes (a stroke moved within the letter counts once). */
function letterStrokes(a: string, b: string): number {
  if (a === b) return 0;
  const { removed, added } = letterDiff(a, b);
  const pool = [...added];
  let moved = 0;
  for (const t of removed) {
    const i = pool.indexOf(t);
    if (i >= 0) (pool.splice(i, 1), moved++);
  }
  return removed.length + added.length - moved;
}

/** One step's squares: 0 for a letter kept, else its strokes (1, 2, 3+). */
export const stepSquares = (from: string, to: string) => [...to].map((ch, i) => Math.min(3, letterStrokes(from[i], ch)));

// ---------- The picture card ----------

/** The light page's colours (the card is always on paper, whatever the player's theme; its strokes are in the player's palette, light). */
const PAPER = {
  bg: '#f7f4ee',
  surface: '#ffffff',
  ink: '#2b2a33',
  muted: '#6d6976',
  line: '#e4dfd5',
  ledge: '#e4ddcf',
  gold: '#ad8211',
  spicy: '#d4410d',
  /** Easycore's badge: the page's calm green (--ok), as on a ski run's easiest slopes. */
  easy: '#497c38',
  squares: ['#efeae0', '#f2c65a', '#e8913a', '#d9542f'],
  squareLedges: ['#ddd6c8', '#d6a63a', '#c9752a', '#b54224'],
  /** Colour-blind: yellow, blue, red (light, middle, dark to red-green colour blindness too). */
  squaresCB: ['#efeae0', '#f2c65a', '#3f7fd6', '#b8402a'],
  squareLedgesCB: ['#ddd6c8', '#d6a63a', '#2f63ad', '#8f2f1e'],
};

const FONT = 'ui-rounded, "SF Pro Rounded", system-ui, -apple-system, "Segoe UI", sans-serif';

/**
 * Draw a word in the game's own ink, in the stroke colours `tiles`, `unit` px per letter unit,
 * centred on cx, its top at y, its letters optically spaced (see spacing.ts).
 */
function drawWord(ctx: CanvasRenderingContext2D, word: string, cx: number, y: number, unit: number, tiles: Record<TileId, string>) {
  const starts = spaced(word);
  const left = cx - ((starts[starts.length - 1] + drawnWidth(word[word.length - 1])) * unit) / 2;
  for (const [i, ch] of [...word].entries()) {
    const x = left + starts[i] * unit;
    const g = LETTERS[ch];
    const { shape, place } = drawnScale(ch);
    for (const p of g.parts) {
      const px = p.x * place;
      const d = inkOutline(p.tile, p.rot ?? 0, inkSeed(p), 0.9 / unit, shape, p.look, [px, p.y]);
      ctx.save();
      ctx.translate(x + px * unit, y + p.y * unit);
      ctx.scale(unit, unit);
      ctx.fillStyle = tiles[p.tile];
      ctx.fill(new Path2D(d));
      ctx.restore();
    }
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** A pill with its words, centred on cx. */
function pill(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, color: string) {
  ctx.font = `800 30px ${FONT}`;
  const w = ctx.measureText(text).width + 44;
  roundRect(ctx, cx - w / 2, cy - 26, w, 52, 26);
  ctx.fillStyle = `${color}22`;
  ctx.fill();
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, cy + 1);
  return w;
}

/** A white card on the paper, with the game's ledge under it. */
function cardBase(ctx: CanvasRenderingContext2D, w: number, h: number, m: number) {
  ctx.fillStyle = PAPER.bg;
  ctx.fillRect(0, 0, w, h);
  roundRect(ctx, m, m + 12, w - 2 * m, h - 2 * m, 44);
  ctx.fillStyle = PAPER.ledge;
  ctx.fill();
  roundRect(ctx, m, m, w - 2 * m, h - 2 * m, 44);
  ctx.fillStyle = PAPER.surface;
  ctx.fill();
  ctx.strokeStyle = PAPER.line;
  ctx.lineWidth = 3;
  ctx.stroke();
}

/** A heat square: the game's tile shape, with its ledge. */
function square(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, heat: number, colorBlind = false) {
  const r = size * 0.22;
  const ledge = Math.max(3, size * 0.07);
  roundRect(ctx, x, y + ledge, size, size, r);
  ctx.fillStyle = (colorBlind ? PAPER.squareLedgesCB : PAPER.squareLedges)[heat];
  ctx.fill();
  roundRect(ctx, x, y, size, size, r);
  ctx.fillStyle = (colorBlind ? PAPER.squaresCB : PAPER.squares)[heat];
  ctx.fill();
}

/**
 * The result card (1080×1350, a portrait post): the score, then the solve as a ladder (the start
 * word in ink, a row of squares per step under the letters it changed, the goal word in ink), and
 * the link.
 */
export async function drawResultCard(r: ShareResult, colorBlind = false, strokes: PaletteChoice = 'earth', canvas = document.createElement('canvas')): Promise<HTMLCanvasElement> {
  await document.fonts?.ready;
  const tiles = palette(strokes).light;
  const W = 1080;
  const H = 1350;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  cardBase(ctx, W, H, 48);
  const cx = W / 2;

  drawWord(ctx, 'STROKES', cx, 104, 26, tiles);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = PAPER.muted;
  ctx.font = `700 28px ${FONT}`;
  const when = r.date ? new Date(`${r.date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : '';
  // (The desktop game's 5-letter puzzles say so: a phone's 4-letter puzzle that day is another one.
  // Easycore's say Easycore: the classic daily of that number is another one.)
  const letters = r.start.length;
  ctx.fillText([r.number ? `No. ${r.number}` : '', shareLabel(r), when].filter(Boolean).join(' · ').toUpperCase(), cx, 206);

  // The score.
  const perfect = r.strokes <= r.best;
  const num = String(r.strokes);
  const label = r.strokes === 1 ? 'stroke' : 'strokes';
  ctx.font = `900 132px ${FONT}`;
  const numW = ctx.measureText(num).width;
  ctx.font = `800 42px ${FONT}`;
  const labelW = ctx.measureText(label).width;
  const sx = cx - (numW + 14 + labelW) / 2;
  ctx.textAlign = 'left';
  ctx.fillStyle = PAPER.ink;
  ctx.font = `900 132px ${FONT}`;
  ctx.fillText(num, sx, 344);
  ctx.font = `800 42px ${FONT}`;
  ctx.fillText(label, sx + numW + 14, 344);
  ctx.textAlign = 'center';
  ctx.fillStyle = PAPER.muted;
  ctx.font = `600 30px ${FONT}`;
  ctx.fillText(`lowest possible ${r.best}${r.hints ? ` · ${r.hints} ${r.hints === 1 ? 'hint' : 'hints'}` : ''}`, cx, 394);

  // Badges: the score's golf name (an Ace in gold), and Hardcore or Easycore.
  const name = scoreName(r.strokes, r.best).toUpperCase();
  const badges: [string, string][] = [perfect ? [`★ ${name}`, PAPER.gold] : [name, PAPER.muted]];
  if (r.hardcore) badges.push(['🔥 HARDCORE', PAPER.spicy]);
  if (r.easycore) badges.push(['EASYCORE', PAPER.easy]);
  if (badges.length) {
    ctx.font = `800 30px ${FONT}`;
    const widths = badges.map(([t]) => ctx.measureText(t).width + 44);
    let bx = cx - (widths.reduce((a, b) => a + b, 0) + 16 * (badges.length - 1)) / 2;
    badges.forEach(([t, c], i) => {
      pill(ctx, t, bx + widths[i] / 2, 452, c);
      bx += widths[i] + 16;
    });
  }

  // The ladder: the start word, a row per step, the goal word; the letters over their columns.
  const top = badges.length ? 510 : 456;
  const bottom = 1124;
  const rows = r.steps.length + 2;
  const size = Math.min(100, Math.floor((bottom - top) / (rows * 1.22)));
  const gap = Math.round(size * 0.22);
  const ladderH = rows * size + (rows - 1) * gap;
  const y0 = top + (bottom - top - ladderH) / 2;
  const rowW = letters * size + (letters - 1) * gap;
  const tag = size * 1.1; // room for each step's "+2", to the right
  const x0 = cx - (rowW + tag) / 2 + tag / 2 - size * 0.3;
  const col = (k: number) => x0 + k * (size + gap);
  const rowY = (i: number) => y0 + i * (size + gap);
  const word = (w: string, i: number) => [...w].forEach((ch, k) => drawWord(ctx, ch, col(k) + size / 2, rowY(i) + size * 0.1, size * 0.4, tiles));
  word(r.start, 0);
  r.steps.forEach((s, i) => {
    const y = rowY(i + 1);
    stepSquares(s.from, s.to).forEach((n, k) => square(ctx, col(k), y, size, n, colorBlind));
    ctx.fillStyle = PAPER.muted;
    ctx.font = `800 ${Math.max(26, Math.round(size * 0.44))}px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`+${s.cost}`, col(letters) + size * 0.12, y + size / 2 + 1);
  });
  if (!r.steps.length) {
    ctx.fillStyle = PAPER.muted;
    ctx.font = `700 ${Math.round(size * 0.7)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('↓', x0 + rowW / 2, rowY(1) + size / 2);
  }
  word(r.goal, rows - 1);

  // The link.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = PAPER.muted;
  ctx.font = `600 28px ${FONT}`;
  ctx.fillText('A new word puzzle every day, drawn in strokes', cx, H - 150);
  ctx.fillStyle = PAPER.ink;
  ctx.font = `800 34px ${FONT}`;
  ctx.fillText(SITE.replace(/^https:\/\//, '').replace(/\/$/, ''), cx, H - 106);
  return canvas;
}

/** Two colours mixed, as CSS's color-mix in sRGB: `k` of `a`, the rest `b`. */
function mixHex(a: string, b: string, k: number) {
  const ch = (h: string, i: number) => parseInt(h.slice(1 + 2 * i, 3 + 2 * i), 16);
  return `rgb(${[0, 1, 2].map((i) => Math.round(ch(a, i) * k + ch(b, i) * (1 - k))).join(' ')})`;
}

/** A stroke's tile from the tray, `size` px square, centred on cx, cy: as the game draws it (see .tray-tile), in the colour `color`. */
function trayTile(ctx: CanvasRenderingContext2D, tile: TileId, color: string, cx: number, cy: number, size: number) {
  const k = size / 56; // the game's tile is 56 px at most
  const [x, y, r] = [cx - size / 2, cy - size / 2, 14 * k];
  roundRect(ctx, x, y + 4 * k, size, size, r);
  ctx.fillStyle = mixHex(color, PAPER.ledge, 0.35);
  ctx.fill();
  roundRect(ctx, x, y, size, size, r);
  ctx.fillStyle = mixHex(color, PAPER.surface, 0.12);
  ctx.fill();
  ctx.strokeStyle = mixHex(color, PAPER.line, 0.3);
  ctx.lineWidth = 1.5 * k;
  ctx.stroke();
  // The stroke, inked as in the tray (40 px for 2.4 units there), centred by eye.
  const rot = TRAY_TURN[tile];
  const minHalf = 0.6 / (40 / 2.4);
  const unit = (size - 14 * k) / 2.4;
  const [ox, oy] = opticalOffset(tile, rot, minHalf);
  ctx.save();
  ctx.translate(cx + ox * unit, cy + oy * unit);
  ctx.scale(unit, unit);
  ctx.fillStyle = color;
  ctx.fill(new Path2D(inkOutline(tile, rot, inkSeed({ tile, x: 0, y: 0, rot }), minHalf)));
  ctx.restore();
}

/** The link-preview card (1200×630, for og:image): the wordmark, what the game is, and the tray of strokes. */
export async function drawPreviewCard(canvas = document.createElement('canvas')): Promise<HTMLCanvasElement> {
  await document.fonts?.ready;
  const W = 1200;
  const H = 630;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  cardBase(ctx, W, H, 40);
  // The site's own picture, so in Earth's colours, whatever the player's.
  const tiles = palette('earth').light;
  drawWord(ctx, 'STROKES', W / 2, 96, 56, tiles);
  ctx.textAlign = 'center';
  ctx.fillStyle = PAPER.ink;
  ctx.font = `800 44px ${FONT}`;
  ctx.fillText('Turn one word into another, stroke by stroke.', W / 2, 300);
  ctx.fillStyle = PAPER.muted;
  ctx.font = `600 32px ${FONT}`;
  ctx.fillText('A new puzzle every day.', W / 2, 350);
  // The tray: every stroke the letters are made of.
  const size = 92;
  const gap = 16;
  TILE_IDS.forEach((t, i) => trayTile(ctx, t, tiles[t], W / 2 + (i - (TILE_IDS.length - 1) / 2) * (size + gap), 454, size));
  return canvas;
}

// Sharing a result, Wordle-style: a spoiler-free grid to paste into a text (which letters each step
// changed, and how many strokes it took), and a picture card for social posts. Both link back.
//
// The grid shows a solve's shape, never its words: one row per step, a square per letter,
// coloured by how many strokes went into that letter, and the step's strokes after it. (A stroke
// moved from one letter to another colours both, so a row's squares can add up to more than it cost.)

import { LETTERS, drawnScale, drawnWidth } from './glyphs';
import { inkOutline, inkSeed } from './ink';
import { letterDiff } from './strokes';

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
  /** Each step: the word it started from, the word it made, and what it cost. */
  steps: { from: string; to: string; cost: number }[];
}

export const SITE = 'https://funklunsford.github.io/strokes/';

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

const EMOJI = ['⬜', '🟨', '🟧', '🟥'];

/** The text to paste: a header, a row of squares per step with its strokes, and the link. */
export function shareText(r: ShareResult, url = SITE): string {
  const perfect = r.strokes <= r.best;
  const head = `Strokes${r.number ? ` No. ${r.number}` : ''}${r.hardcore ? ' 🔥' : ''}`;
  const score = `${r.start} → ${r.goal} · ${r.strokes} ${r.strokes === 1 ? 'stroke' : 'strokes'}${perfect ? ' ⭐' : ` (lowest ${r.best})`}${r.hints ? ` · ${r.hints} ${r.hints === 1 ? 'hint' : 'hints'}` : ''}`;
  const rows = r.steps.map((s) => `${stepSquares(s.from, s.to).map((n) => EMOJI[n]).join('')} ${s.cost}`);
  return [head, score, ...rows, url].join('\n');
}

// ---------- The picture card ----------

/** The light page's colours (the card is always on paper, whatever the player's theme). */
const PAPER = {
  bg: '#f7f4ee',
  surface: '#ffffff',
  ink: '#2b2a33',
  muted: '#8b8794',
  line: '#e4dfd5',
  ledge: '#e4ddcf',
  gold: '#d9a520',
  spicy: '#e4572e',
  squares: ['#efeae0', '#f2c65a', '#e8913a', '#d9542f'],
  squareLedges: ['#ddd6c8', '#d6a63a', '#c9752a', '#b54224'],
  tiles: { LV: '#3f5a74', H: '#b0583a', LD: '#6f8c58', LB: '#4e6b3f', SB: '#3f7f73', BV: '#b98a2f', SC: '#8a4f70', C: '#6b5b8f', P: '#a8545d' } as Record<string, string>,
};

const FONT = 'ui-rounded, "SF Pro Rounded", system-ui, -apple-system, "Segoe UI", sans-serif';
const GAP = 0.7;

const wordUnits = (word: string) => [...word].reduce((t, ch) => t + drawnWidth(ch), 0) + GAP * (word.length - 1);

/** Draw a word in the game's own ink, `unit` px per letter unit, centred on cx, its top at y. */
function drawWord(ctx: CanvasRenderingContext2D, word: string, cx: number, y: number, unit: number) {
  let x = cx - (wordUnits(word) * unit) / 2;
  for (const ch of word) {
    const g = LETTERS[ch];
    const { shape, place } = drawnScale(ch);
    for (const p of g.parts) {
      const px = p.x * place;
      const d = inkOutline(p.tile, p.rot ?? 0, inkSeed(p), 0.9 / unit, shape, p.look, [px, p.y]);
      ctx.save();
      ctx.translate(x + px * unit, y + p.y * unit);
      ctx.scale(unit, unit);
      ctx.fillStyle = PAPER.tiles[p.tile];
      ctx.fill(new Path2D(d));
      ctx.restore();
    }
    x += (drawnWidth(ch) + GAP) * unit;
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
function square(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, heat: number) {
  const r = size * 0.22;
  const ledge = Math.max(3, size * 0.07);
  roundRect(ctx, x, y + ledge, size, size, r);
  ctx.fillStyle = PAPER.squareLedges[heat];
  ctx.fill();
  roundRect(ctx, x, y, size, size, r);
  ctx.fillStyle = PAPER.squares[heat];
  ctx.fill();
}

/**
 * The result card (1080×1350, a portrait post): the score, then the solve as a ladder (the start
 * word in ink, a row of squares per step under the letters it changed, the goal word in ink), and
 * the link.
 */
export async function drawResultCard(r: ShareResult, canvas = document.createElement('canvas')): Promise<HTMLCanvasElement> {
  await document.fonts?.ready;
  const W = 1080;
  const H = 1350;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  cardBase(ctx, W, H, 48);
  const cx = W / 2;

  drawWord(ctx, 'STROKES', cx, 104, 26);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = PAPER.muted;
  ctx.font = `700 28px ${FONT}`;
  const when = r.date ? new Date(`${r.date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : '';
  ctx.fillText([r.number ? `No. ${r.number}` : '', when].filter(Boolean).join(' · ').toUpperCase(), cx, 206);

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

  // Badges.
  const badges: [string, string][] = [];
  if (perfect) badges.push(['★ PERFECT', PAPER.gold]);
  if (r.hardcore) badges.push(['🔥 HARDCORE', PAPER.spicy]);
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
  const rowW = 4 * size + 3 * gap;
  const tag = size * 1.1; // room for each step's "+2", to the right
  const x0 = cx - (rowW + tag) / 2 + tag / 2 - size * 0.3;
  const col = (k: number) => x0 + k * (size + gap);
  const rowY = (i: number) => y0 + i * (size + gap);
  const word = (w: string, i: number) => [...w].forEach((ch, k) => drawWord(ctx, ch, col(k) + size / 2, rowY(i) + size * 0.1, size * 0.4));
  word(r.start, 0);
  r.steps.forEach((s, i) => {
    const y = rowY(i + 1);
    stepSquares(s.from, s.to).forEach((n, k) => square(ctx, col(k), y, size, n));
    ctx.fillStyle = PAPER.muted;
    ctx.font = `800 ${Math.max(26, Math.round(size * 0.44))}px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`+${s.cost}`, col(4) + size * 0.12, y + size / 2 + 1);
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

/** The link-preview card (1200×630, for og:image): the wordmark and what the game is. */
export async function drawPreviewCard(canvas = document.createElement('canvas')): Promise<HTMLCanvasElement> {
  await document.fonts?.ready;
  const W = 1200;
  const H = 630;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  cardBase(ctx, W, H, 40);
  drawWord(ctx, 'STROKES', W / 2, 150, 64);
  ctx.textAlign = 'center';
  ctx.fillStyle = PAPER.ink;
  ctx.font = `800 46px ${FONT}`;
  ctx.fillText('Turn one word into another, stroke by stroke.', W / 2, 392);
  ctx.fillStyle = PAPER.muted;
  ctx.font = `600 34px ${FONT}`;
  ctx.fillText('A new puzzle every day.', W / 2, 452);
  // A row of the squares a shared result is made of.
  const heats = [0, 1, 0, 2, 0, 3, 0, 1, 2];
  heats.forEach((n, i) => square(ctx, W / 2 + (i - (heats.length - 1) / 2) * 66 - 26, 500, 52, n));
  return canvas;
}

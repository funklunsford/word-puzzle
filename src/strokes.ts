// Stroke-level geometry for the maze: what a cell of strokes "is", where a stroke may be
// dropped, and how many stroke edits separate two words.
//
// Shapes are compared up to a horizontal shift, so a lone long bar is the same shape whether it
// sits at x = 0 (as in I) or x = 0.5 (as in T).

import { collides } from './geometry';
import { LETTERS, xExtent, type Placement, type TileId } from './glyphs';

const norm = (r = 0) => ((r % 360) + 360) % 360;
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Identity of a placement within a cell (tile + position + orientation). */
export const slotKey = (p: Placement, dx = 0) => `${p.tile}@${r2(p.x + dx)},${r2(p.y)},${norm(p.rot)}`;

const shift = (p: Placement, dx: number): Placement => ({ ...p, x: r2(p.x + dx) });

/** Horizontal shifts that line `content` up with `glyph` (based on its first stroke). */
function alignments(content: Placement[], glyph: Placement[]): number[] {
  if (!content.length) return [0];
  const c = content[0];
  const out = new Set<number>();
  for (const g of glyph) if (g.tile === c.tile && r2(g.y) === r2(c.y) && norm(g.rot) === norm(c.rot)) out.add(r2(c.x - g.x));
  return [...out];
}

/** Multiset difference a − b by slot key. */
function minus(a: Placement[], b: Placement[]): Placement[] {
  const rest = b.map((p) => slotKey(p));
  return a.filter((p) => {
    const i = rest.indexOf(slotKey(p));
    if (i < 0) return true;
    rest.splice(i, 1);
    return false;
  });
}

/** The letter these strokes draw exactly (up to shift), if any. */
export function recognize(content: Placement[]): string | null {
  if (!content.length) return null;
  for (const [ch, g] of Object.entries(LETTERS)) {
    if (g.parts.length !== content.length) continue;
    for (const dx of alignments(content, g.parts)) {
      if (!minus(content, g.parts.map((p) => shift(p, dx))).length) return ch;
    }
  }
  return null;
}

export interface Slot {
  placement: Placement;
  /** Letters this drop keeps the cell on track to become. */
  toward: string[];
}

/** Shifts that line any stroke of `content` up with a same-shaped stroke of `glyph`. */
function anyAlignments(content: Placement[], glyph: Placement[]): number[] {
  const out = new Set<number>();
  for (const c of content) {
    for (const g of glyph) if (g.tile === c.tile && r2(g.y) === r2(c.y) && norm(g.rot) === norm(c.rot)) out.add(r2(c.x - g.x));
  }
  return [...out];
}

const center = (parts: Placement[]) => {
  const [lo, hi] = xExtent(parts);
  return (lo + hi) / 2;
};

/**
 * Where a stroke of `tile` may be dropped into a cell.
 *
 * Each candidate is a position the tile has in some letter, lined up with the cell's strokes; its
 * "fit" is how many of those strokes that letter would keep. Only the best-fitting positions are
 * offered. When the cell is still part of a real letter that means exactly the drops that keep it
 * so (remove extras, then add, always works). When it isn't (e.g. A's crossbar left alone after
 * removing the chevron), it falls back to positions that keep fewer strokes, down to plain
 * letter positions centered on (or beside) the cell's strokes. A drop never crosses or overlaps a stroke that isn't part
 * of the letter it was offered from.
 */
export function slotsFor(content: Placement[], tile: TileId): Slot[] {
  const slots = new Map<string, Slot & { fit: number }>();
  const offer = (ch: string, placed: Placement[]) => {
    const missing = minus(placed, content);
    const fit = placed.length - missing.length;
    // Strokes this letter doesn't account for. The new stroke may not cross or overlap them
    // (crossings within the letter itself, like X's, are fine).
    const strangers = minus(content, placed);
    for (const p of missing) {
      if (p.tile !== tile) continue;
      if (strangers.some((s) => collides(p, s))) continue;
      const k = slotKey(p);
      const s = slots.get(k);
      if (!s || fit > s.fit) slots.set(k, { placement: p, toward: [ch], fit });
      else if (fit === s.fit && !s.toward.includes(ch)) s.toward.push(ch);
    }
  };
  for (const [ch, g] of Object.entries(LETTERS)) {
    if (!g.parts.some((p) => p.tile === tile)) continue;
    const shifts = new Set(anyAlignments(content, g.parts));
    // Unanchored: the letter centered on what's already in the cell (or at the origin if empty),
    // plus a few positions either side so a stroke can sit beside strokes it would otherwise cross.
    if (!content.length) shifts.add(0);
    else for (const k of [0, -0.5, 0.5, -1, 1, -1.5, 1.5]) shifts.add(r2(center(content) - center(g.parts) + k));
    for (const dx of shifts) offer(ch, g.parts.map((p) => shift(p, dx)));
  }
  const best = Math.max(0, ...[...slots.values()].map((s) => s.fit));
  return [...slots.values()].filter((s) => s.fit === best).map(({ placement, toward }) => ({ placement, toward }));
}

// ---------- Word distance ----------

interface LetterDiff {
  removed: TileId[];
  added: TileId[];
}

const diffCache = new Map<string, LetterDiff>();

/** Strokes to remove from letter a and add to reach letter b, at the best alignment. */
export function letterDiff(a: string, b: string): LetterDiff {
  const k = a + b;
  const hit = diffCache.get(k);
  if (hit) return hit;
  let best: LetterDiff = { removed: [], added: [] };
  if (a !== b) {
    const A = LETTERS[a].parts;
    const B = LETTERS[b].parts;
    const shifts = new Set([0]);
    for (const pa of A) for (const pb of B) if (pa.tile === pb.tile) shifts.add(r2(pb.x - pa.x));
    let bestCost = Infinity;
    for (const dx of shifts) {
      const As = A.map((p) => shift(p, dx));
      const d = { removed: minus(As, B).map((p) => p.tile), added: minus(B, As).map((p) => p.tile) };
      const cost = editCost([d]);
      if (cost < bestCost) [bestCost, best] = [cost, d];
    }
  }
  diffCache.set(k, best);
  return best;
}

/** Removes + adds, where a removed stroke re-placed elsewhere (same tile) counts as one move. */
function editCost(diffs: LetterDiff[]): number {
  const removed = new Map<TileId, number>();
  const added = new Map<TileId, number>();
  let n = 0;
  for (const d of diffs) {
    for (const t of d.removed) (removed.set(t, (removed.get(t) ?? 0) + 1), n++);
    for (const t of d.added) (added.set(t, (added.get(t) ?? 0) + 1), n++);
  }
  for (const [t, r] of removed) n -= Math.min(r, added.get(t) ?? 0);
  return n;
}

/** Minimum stroke edits (add / remove / move) to turn word a into word b (same length). */
export function wordDistance(a: string, b: string): number {
  if (a.length !== b.length) return Infinity;
  const diffs: LetterDiff[] = [];
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diffs.push(letterDiff(a[i], b[i]));
  return editCost(diffs);
}

export const STEP_LIMIT = 3;

/** Words reachable from `word` in one step (at most STEP_LIMIT stroke edits). */
export function exits(word: string, dict: string[]): { word: string; cost: number }[] {
  const out: { word: string; cost: number }[] = [];
  for (const w of dict) {
    if (w === word) continue;
    const c = wordDistance(word, w);
    if (c <= STEP_LIMIT) out.push({ word: w, cost: c });
  }
  return out;
}

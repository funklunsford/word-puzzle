// Stroke-level geometry for the maze: what a cell of strokes "is", where a stroke may be
// dropped, and how many stroke edits separate two words.
//
// Shapes are compared up to a horizontal shift, so a lone long bar is the same shape whether it
// sits at x = 0 (as in I) or x = 0.5 (as in T).

import { LETTERS, type Placement, type TileId } from './glyphs';

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

/**
 * Where a stroke of `tile` may be dropped into a cell: only positions where the cell's strokes
 * plus the new one are all part of a single real letter, at that letter's exact positions. So a
 * complete T accepts nothing (no letter contains a T), while an F accepts only E's bottom bar.
 * Any change is still possible by removing strokes first, then adding.
 *
 * In an empty cell every placement of a stroke is equivalent up to shift, so each distinct
 * stroke (shape, height, orientation) is offered once, centered.
 */
export function slotsFor(content: Placement[], tile: TileId): Slot[] {
  const slots = new Map<string, Slot>();
  for (const [ch, g] of Object.entries(LETTERS)) {
    if (g.parts.length <= content.length) continue;
    for (const dx of alignments(content, g.parts)) {
      const placed = g.parts.map((p) => shift(p, dx));
      const missing = minus(placed, content);
      if (missing.length !== placed.length - content.length) continue; // not a subset of this letter
      for (const m of missing) {
        if (m.tile !== tile) continue;
        const p = content.length ? m : { ...m, x: EMPTY_CELL_X };
        const k = slotKey(p);
        const s = slots.get(k) ?? { placement: p, toward: [] };
        if (!s.toward.includes(ch)) s.toward.push(ch);
        slots.set(k, s);
      }
    }
  }
  return [...slots.values()];
}

/** Where a first stroke goes in an empty cell (the cell's display center). */
export const EMPTY_CELL_X = 0.5;

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

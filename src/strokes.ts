// Stroke-level geometry for the maze: what a cell of strokes "is", where a stroke may be
// dropped, and how many stroke edits separate two words.
//
// Shapes are compared up to a horizontal shift, so a lone long bar is the same shape whether it
// sits at x = 0 (as in I) or x = 0.5 (as in T).

import { LETTERS, TILE_IDS, type Look, type Placement, type TileId } from './glyphs';

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

/** The shifts at which all of `content` sits inside letter `ch` (as part of it, or all of it). */
function within(content: Placement[], ch: string): number[] {
  const parts = LETTERS[ch].parts;
  return alignments(content, parts).filter((dx) => !minus(content, parts.map((p) => shift(p, dx))).length);
}

/**
 * The letter a cell's strokes are drawn as, and where they sit in it: the letter they make; or, for
 * a shape on its way to exactly one letter at one place, that letter (a long bar and the cup can
 * only become U; a long bar with the chevron on top, only M). Null when it could be several, or none.
 */
export function onlyFit(content: Placement[]): { ch: string; dx: number } | null {
  if (!content.length) return null;
  const ch = recognize(content);
  if (ch) return { ch, dx: within(content, ch)[0] };
  const fits = Object.keys(LETTERS).flatMap((c) => within(content, c).map((dx) => ({ ch: c, dx })));
  return fits.length === 1 ? fits[0] : null;
}

/**
 * How a cell's strokes are drawn (see Look), matched stroke by stroke: the looks of the letter they
 * make, or of the only letter they can become (see onlyFit), so a half-built U's cup meets its bar
 * instead of crossing it. Null when no look applies (every stroke is drawn as itself).
 */
export function formedLooks(content: Placement[]): (Look | undefined)[] | null {
  const fit = onlyFit(content);
  if (!fit) return null;
  const free = LETTERS[fit.ch].parts.map((p) => shift(p, fit.dx));
  const looks = content.map((q) => free.splice(free.findIndex((p) => slotKey(p) === slotKey(q)), 1)[0].look);
  return recognize(content) || looks.some(Boolean) ? looks : null;
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
 * stroke (shape, height, orientation) is offered once, centered. One spot can take a rotatable
 * stroke in several orientations (an empty cell's chevron as V's `v` or A's `^`); the player
 * picks one by twisting the stroke.
 */
export function slotsFor(content: Placement[], tile: TileId): Slot[] {
  const slots = new Map<string, Slot>();
  for (const [ch, g] of Object.entries(LETTERS)) {
    if (g.parts.length <= content.length) continue;
    // The cell's strokes may fit this letter in more than one place (a lone stem is either side
    // of an H). Use only the rightmost fit, so letters always grow rightward from what's there.
    let missing: Placement[] | null = null;
    let bestDx = -Infinity;
    for (const dx of alignments(content, g.parts)) {
      const placed = g.parts.map((p) => shift(p, dx));
      const rest = minus(placed, content);
      if (rest.length !== placed.length - content.length) continue; // not a subset of this letter
      if (dx > bestDx) [bestDx, missing] = [dx, rest];
    }
    if (missing) {
      for (const { look: _look, ...m } of missing) {
        if (m.tile !== tile) continue;
        // Offered as the plain stroke: a look only applies once the letter is formed.
        const p = content.length ? m : { ...m, x: EMPTY_CELL_X };
        const k = slotKey(p);
        const s: Slot = slots.get(k) ?? { placement: p, toward: [] };
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

/**
 * The stroke difference between two words (same length): strokes to remove and add, a stroke
 * moved from one letter to another counting once. A lower bound on a step's real cost (see
 * wordDistance), since the editor may not allow the strokes in any order that achieves it.
 */
export function strokeDiff(a: string, b: string): number {
  if (a.length !== b.length) return Infinity;
  const diffs: LetterDiff[] = [];
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diffs.push(letterDiff(a[i], b[i]));
  return editCost(diffs);
}

export const STEP_LIMIT = 3;

/** What a cell's strokes lack and have spare against a letter, at the best alignment. */
function contentDiff(content: Placement[], ch: string): LetterDiff {
  const parts = LETTERS[ch].parts.map(({ look: _look, ...p }) => p);
  const shifts = new Set([0]);
  for (const c of content) for (const q of parts) if (c.tile === q.tile) shifts.add(r2(q.x - c.x));
  let best: LetterDiff | null = null;
  let bestCost = Infinity;
  for (const dx of shifts) {
    const moved = content.map((p) => shift(p, dx));
    const d = { removed: minus(moved, parts).map((p) => p.tile), added: minus(parts, moved).map((p) => p.tile) };
    const cost = d.removed.length + d.added.length;
    if (cost < bestCost) [bestCost, best] = [cost, d];
  }
  return best!;
}

const stepCache = new Map<string, number>();

/**
 * The fewest strokes the editor needs to turn the letters `from` into `to` (position by position),
 * or Infinity if it takes more than STEP_LIMIT. Each stroke is one action: add one from the tray,
 * remove one, or move one (to another letter, or turned on its spot), and the editor only takes a
 * stroke where the letter's strokes stay part of a real letter. So the order matters: KALE → TAME
 * differs by 3 strokes, but every one of them is blocked until another has gone, and it needs 4.
 * Searched depth-first, cut off where even the stroke difference can't make it in time.
 */
function stepCost(from: string[], to: string[]): number {
  const key = from.map((f, i) => f + to[i]).sort().join(',');
  const hit = stepCache.get(key);
  if (hit !== undefined) return hit;
  const left = (cells: Placement[][]) => editCost(cells.map((c, i) => contentDiff(c, to[i])));
  const done = (cells: Placement[][]) => cells.every((c, i) => recognize(c) === to[i]);
  const search = (cells: Placement[][], budget: number): boolean => {
    if (done(cells)) return true;
    if (budget === 0 || left(cells) > budget) return false;
    const go = (next: Placement[][]) => search(next, budget - 1);
    for (let c = 0; c < cells.length; c++) {
      for (let i = 0; i < cells[c].length; i++) {
        const p = cells[c][i];
        const rest = cells[c].filter((_, k) => k !== i);
        // Remove it.
        if (go(cells.map((x, k) => (k === c ? rest : x)))) return true;
        // Move it: to another letter, or elsewhere in its own (turned on its spot, say). It can land
        // turned: a mouse's swipe turns a carried stroke. A finger can't swipe, but every step stays
        // just as cheap under one (src/turns.ts: a stroke carried into an empty letter lands the way
        // the tray starts it).
        for (let d = 0; d < cells.length; d++) {
          const base = d === c ? rest : cells[d];
          for (const slot of slotsFor(base, p.tile)) {
            const q = slot.placement;
            if (d === c && slotKey(q) === slotKey(p)) continue;
            if (go(cells.map((x, k) => (k === d ? [...base, q] : k === c ? rest : x)))) return true;
          }
        }
      }
      // Add one from the tray.
      for (const tile of TILE_IDS) for (const slot of slotsFor(cells[c], tile)) if (go(cells.map((x, k) => (k === c ? [...x, slot.placement] : x)))) return true;
    }
    return false;
  };
  const start = from.map((f) => LETTERS[f].parts.map(({ look: _look, ...p }) => p));
  let cost = Infinity;
  for (let budget = left(start); budget <= STEP_LIMIT; budget++) {
    if (search(start, budget)) {
      cost = budget;
      break;
    }
  }
  stepCache.set(key, cost);
  return cost;
}

/** Strokes for a step from word a to word b, in that direction only (Infinity beyond STEP_LIMIT). */
export function oneWayCost(a: string, b: string): number {
  if (a.length !== b.length) return Infinity;
  if (a === b) return 0;
  if (strokeDiff(a, b) > STEP_LIMIT) return Infinity;
  const from: string[] = [];
  const to: string[] = [];
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) (from.push(a[i]), to.push(b[i]));
  return stepCost(from, to);
}

/**
 * Strokes for one step between words a and b (same length) as the editor allows them: Infinity if
 * it can't be done within STEP_LIMIT. Never less than strokeDiff, sometimes more. The same either
 * way round (each order of strokes undoes in reverse; a test checks every pair of maze words); both
 * are checked, as the maze's doors open both ways.
 */
export function wordDistance(a: string, b: string): number {
  return Math.max(oneWayCost(a, b), oneWayCost(b, a));
}

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

// Stroke tiles and the letters built from them.
//
// Coordinates are in "units": cap height is 2, y points down, the baseline is y = 2.
// Each tile's path is drawn in local coordinates centered on its bounding box, so a
// placement is just a translate + rotate. Recipes are derived from placements, so
// this file is the single source of truth for both rendering and game rules.

export type TileId = 'LV' | 'H' | 'LD' | 'LB' | 'SB' | 'BV' | 'SC' | 'C' | 'P';

export interface TileShape {
  id: TileId;
  name: string;
  path: string;
  /** Whether the tile may be rotated when placed in a letter. */
  rotates: boolean;
  /** Rotation (degrees clockwise) the tile is shown and picked up at in the tray (chevrons as in V, M and Y). */
  display?: number;
}

export const TILES: Record<TileId, TileShape> = {
  LV: { id: 'LV', name: 'Long bar', path: 'M0 -1 L0 1', rotates: false },
  // One 1-unit bar: flat as a crossbar (E, F, H…), upright as Y's stem.
  H: { id: 'H', name: 'Bar', path: 'M-0.5 0 L0.5 0', rotates: true, display: 0 },
  LD: { id: 'LD', name: 'Rising slash', path: 'M-0.5 1 L0.5 -1', rotates: false },
  LB: { id: 'LB', name: 'Falling slash', path: 'M-0.5 -1 L0.5 1', rotates: false },
  SB: { id: 'SB', name: 'Tail', path: 'M-0.25 -0.5 L0.25 0.5', rotates: false },
  BV: { id: 'BV', name: 'Big chevron', path: 'M-1 -1 L0 1 L1 -1', rotates: true, display: 0 },
  SC: { id: 'SC', name: 'Small chevron', path: 'M-1 -0.5 L0 0.5 L1 -0.5', rotates: true, display: 0 },
  C: { id: 'C', name: 'Big arc', path: 'M0.5 -1 A1 1 0 0 0 0.5 1', rotates: true, display: 90 },
  P: { id: 'P', name: 'Bowl', path: 'M-0.5 -0.5 L0 -0.5 A0.5 0.5 0 0 1 0 0.5 L-0.5 0.5', rotates: true },
};

export const TILE_IDS = Object.keys(TILES) as TileId[];

/** Half-width and half-height of each tile at rotation 0, in units. */
const TILE_EXTENT: Record<TileId, [number, number]> = {
  LV: [0, 1],
  H: [0.5, 0],
  LD: [0.5, 1],
  LB: [0.5, 1],
  SB: [0.25, 0.5],
  BV: [1, 1],
  SC: [1, 0.5],
  C: [0.5, 1],
  P: [0.5, 0.5],
};

/**
 * The end a shortened stroke (Placement.len) keeps in place, relative to its centre, at rotation
 * `rot`: the far end of its own axis (local +x). An upright bar keeps its foot, so G's chin stays
 * on the baseline.
 */
export function lengthAnchor(tile: TileId, rot = 0): [number, number] {
  const hx = TILE_EXTENT[tile][0];
  const t = (rot * Math.PI) / 180;
  const r = (n: number) => Math.round(n * 1e6) / 1e6;
  return [r(hx * Math.cos(t)), r(hx * Math.sin(t))];
}

/** Horizontal extent [min, max] of a set of placements. */
export function xExtent(parts: Placement[]): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (const p of parts) {
    const [hx, hy] = TILE_EXTENT[p.tile];
    // A flat stroke's span runs from its anchored end back along its axis for `len` of its length.
    const flat = (p.rot ?? 0) % 180 === 0;
    const [ax] = lengthAnchor(p.tile, p.rot);
    const [a, b] = flat ? [ax, ax - Math.sign(ax) * 2 * hx * (p.len ?? 1)] : [-hy, hy];
    lo = Math.min(lo, p.x + Math.min(a, b));
    hi = Math.max(hi, p.x + Math.max(a, b));
  }
  return [lo, hi];
}

export interface Placement {
  tile: TileId;
  x: number;
  y: number;
  /** Degrees clockwise. */
  rot?: number;
  /**
   * Drawn length as a fraction of the stroke's own (default 1), once its letter is formed, keeping
   * one end in place (see lengthAnchor). Display only, like LetterGlyph.squeeze: it never affects
   * slots, recognition or distances.
   */
  len?: number;
}

export interface LetterGlyph {
  width: number;
  parts: Placement[];
  /**
   * Draw the letter squeezed horizontally by this factor once it's formed. Display only: the
   * strokes and their positions (and so the game rules) are unchanged.
   */
  squeeze?: number;
}

const p = (tile: TileId, x: number, y: number, rot = 0, len?: number): Placement =>
  len === undefined ? { tile, x, y, rot } : { tile, x, y, rot, len };

export const LETTERS: Record<string, LetterGlyph> = {
  // The chevron is 1 wide at mid-height, so A's crossbar sits at the same height as E/F/H's.
  A: { width: 2, parts: [p('BV', 1, 1, 180), p('H', 1, 1)] },
  B: { width: 1, parts: [p('LV', 0, 1), p('P', 0.5, 0.5), p('P', 0.5, 1.5)] },
  C: { width: 1, parts: [p('C', 0.5, 1)] },
  D: { width: 1, parts: [p('LV', 0, 1), p('C', 0.5, 1, 180)] },
  E: { width: 1, parts: [p('LV', 0, 1), p('H', 0.5, 0), p('H', 0.5, 1), p('H', 0.5, 2)] },
  F: { width: 1, parts: [p('LV', 0, 1), p('H', 0.5, 0), p('H', 0.5, 1)] },
  // The arc with an upright bar as its chin, drawn ¾ long from the baseline so there's air between
  // it and the arc's top end. It sits where Y's stem does, so the two share a spot.
  G: { width: 1, parts: [p('C', 0.5, 1), p('H', 1, 1.5, 90, 0.75)] },
  H: { width: 1, parts: [p('LV', 0, 1), p('LV', 1, 1), p('H', 0.5, 1)] },
  I: { width: 0, parts: [p('LV', 0, 1)] },
  // A mirrored L, and U is H with its bar dropped: both share the long bar with H, L, I and T,
  // so words with J and U are a stroke or two from everyday words.
  J: { width: 1, parts: [p('LV', 1, 1), p('H', 0.5, 2)] },
  K: { width: 1, parts: [p('LV', 0, 1), p('SC', 0.5, 1, 90)] },
  L: { width: 1, parts: [p('LV', 0, 1), p('H', 0.5, 2)] },
  M: { width: 2, parts: [p('LV', 0, 1), p('LV', 2, 1), p('SC', 1, 0.5)] },
  N: { width: 1, parts: [p('LV', 0, 1), p('LV', 1, 1), p('LB', 0.5, 1)] },
  O: { width: 2, parts: [p('C', 0.5, 1), p('C', 1.5, 1, 180)] },
  P: { width: 1, parts: [p('LV', 0, 1), p('P', 0.5, 0.5)] },
  Q: { width: 2, parts: [p('C', 0.5, 1), p('C', 1.5, 1, 180), p('SB', 1.6, 1.9)] },
  R: { width: 1, parts: [p('LV', 0, 1), p('P', 0.5, 0.5), p('SB', 0.75, 1.5)] },
  // The same bowl stroke as B/P/R. The bowls are offset by a quarter so their middle ends overlap
  // into a short spine: no full-width bar across the middle, and only a slight lean.
  S: { width: 1.25, parts: [p('P', 0.5, 0.5, 180), p('P', 0.75, 1.5)] },
  T: { width: 1, parts: [p('H', 0.5, 0), p('LV', 0.5, 1)] },
  U: { width: 1, parts: [p('LV', 0, 1), p('LV', 1, 1), p('H', 0.5, 2)] },
  V: { width: 2, parts: [p('BV', 1, 1)] },
  // Two full chevrons are 4 wide; once formed, W is drawn 2.5 wide (V's chevrons are untouched).
  W: { width: 4, squeeze: 0.625, parts: [p('BV', 1, 1), p('BV', 3, 1)] },
  X: { width: 1, parts: [p('LD', 0.5, 1), p('LB', 0.5, 1)] },
  Y: { width: 2, parts: [p('SC', 1, 0.5), p('H', 1, 1.5, 90)] },
  Z: { width: 1, parts: [p('H', 0.5, 0), p('H', 0.5, 2), p('LD', 0.5, 1)] },
};

/** How wide a letter is drawn (its width after any squeeze). */
export const drawnWidth = (letter: string) => LETTERS[letter].width * (LETTERS[letter].squeeze ?? 1);

/** Tile counts needed to build a letter. */
export function recipe(letter: string): Map<TileId, number> {
  const counts = new Map<TileId, number>();
  for (const part of LETTERS[letter].parts) counts.set(part.tile, (counts.get(part.tile) ?? 0) + 1);
  return counts;
}

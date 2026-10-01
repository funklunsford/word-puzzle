// Stroke tiles and the letters built from them.
//
// Coordinates are in "units": cap height is 2, y points down, the baseline is y = 2.
// Each tile's path is drawn in local coordinates centered on its bounding box, so a
// placement is just a translate + rotate. Recipes are derived from placements, so
// this file is the single source of truth for both rendering and game rules.

export type TileId = 'LV' | 'SV' | 'H' | 'LD' | 'LB' | 'SB' | 'BV' | 'SC' | 'C' | 'P';

export interface TileShape {
  id: TileId;
  name: string;
  path: string;
  /** Whether the tile may be rotated when placed in a letter. */
  rotates: boolean;
}

export const TILES: Record<TileId, TileShape> = {
  LV: { id: 'LV', name: 'Long bar', path: 'M0 -1 L0 1', rotates: false },
  SV: { id: 'SV', name: 'Short bar', path: 'M0 -0.5 L0 0.5', rotates: false },
  H: { id: 'H', name: 'Crossbar', path: 'M-0.5 0 L0.5 0', rotates: false },
  LD: { id: 'LD', name: 'Rising slash', path: 'M-0.5 1 L0.5 -1', rotates: false },
  LB: { id: 'LB', name: 'Falling slash', path: 'M-0.5 -1 L0.5 1', rotates: false },
  SB: { id: 'SB', name: 'Tail', path: 'M-0.25 -0.5 L0.25 0.5', rotates: false },
  BV: { id: 'BV', name: 'Big chevron', path: 'M-0.8 -1 L0 1 L0.8 -1', rotates: true },
  SC: { id: 'SC', name: 'Small chevron', path: 'M-1 -0.5 L0 0.5 L1 -0.5', rotates: true },
  C: { id: 'C', name: 'Big arc', path: 'M0.5 -1 A1 1 0 0 0 0.5 1', rotates: true },
  P: { id: 'P', name: 'Bowl', path: 'M-0.5 -0.5 L0 -0.5 A0.5 0.5 0 0 1 0 0.5 L-0.5 0.5', rotates: true },
};

export const TILE_IDS = Object.keys(TILES) as TileId[];

export interface Placement {
  tile: TileId;
  x: number;
  y: number;
  /** Degrees clockwise. */
  rot?: number;
}

export interface LetterGlyph {
  width: number;
  parts: Placement[];
}

const p = (tile: TileId, x: number, y: number, rot = 0): Placement => ({ tile, x, y, rot });

export const LETTERS: Record<string, LetterGlyph> = {
  A: { width: 1.6, parts: [p('BV', 0.8, 1, 180), p('H', 0.8, 1.25)] },
  B: { width: 1, parts: [p('LV', 0, 1), p('P', 0.5, 0.5), p('P', 0.5, 1.5)] },
  C: { width: 1, parts: [p('C', 0.5, 1)] },
  D: { width: 1, parts: [p('LV', 0, 1), p('C', 0.5, 1, 180)] },
  E: { width: 1, parts: [p('LV', 0, 1), p('H', 0.5, 0), p('H', 0.5, 1), p('H', 0.5, 2)] },
  F: { width: 1, parts: [p('LV', 0, 1), p('H', 0.5, 0), p('H', 0.5, 1)] },
  G: { width: 1.5, parts: [p('C', 0.5, 1), p('H', 1, 1), p('SV', 1, 1.5)] },
  H: { width: 1, parts: [p('LV', 0, 1), p('LV', 1, 1), p('H', 0.5, 1)] },
  I: { width: 0, parts: [p('LV', 0, 1)] },
  J: { width: 1, parts: [p('SV', 1, 0.5), p('P', 0.5, 1.5, 90)] },
  K: { width: 1, parts: [p('LV', 0, 1), p('SC', 0.5, 1, 90)] },
  L: { width: 1, parts: [p('LV', 0, 1), p('H', 0.5, 2)] },
  M: { width: 2, parts: [p('LV', 0, 1), p('LV', 2, 1), p('SC', 1, 0.5)] },
  N: { width: 1, parts: [p('LV', 0, 1), p('LV', 1, 1), p('LB', 0.5, 1)] },
  O: { width: 2, parts: [p('C', 0.5, 1), p('C', 1.5, 1, 180)] },
  P: { width: 1, parts: [p('LV', 0, 1), p('P', 0.5, 0.5)] },
  Q: { width: 2, parts: [p('C', 0.5, 1), p('C', 1.5, 1, 180), p('SB', 1.6, 1.9)] },
  R: { width: 1, parts: [p('LV', 0, 1), p('P', 0.5, 0.5), p('SB', 0.75, 1.5)] },
  // Offset bowls so their middle legs coincide into a single spine.
  S: { width: 1.5, parts: [p('P', 0.5, 0.5, 180), p('P', 1, 1.5)] },
  T: { width: 1, parts: [p('H', 0.5, 0), p('LV', 0.5, 1)] },
  U: { width: 1, parts: [p('SV', 0, 0.5), p('SV', 1, 0.5), p('P', 0.5, 1.5, 90)] },
  V: { width: 1.6, parts: [p('BV', 0.8, 1)] },
  W: { width: 3.2, parts: [p('BV', 0.8, 1), p('BV', 2.4, 1)] },
  X: { width: 1, parts: [p('LD', 0.5, 1), p('LB', 0.5, 1)] },
  Y: { width: 2, parts: [p('SC', 1, 0.5), p('SV', 1, 1.5)] },
  Z: { width: 1, parts: [p('H', 0.5, 0), p('H', 0.5, 2), p('LD', 0.5, 1)] },
};

/** Tile counts needed to build a letter. */
export function recipe(letter: string): Map<TileId, number> {
  const counts = new Map<TileId, number>();
  for (const part of LETTERS[letter].parts) counts.set(part.tile, (counts.get(part.tile) ?? 0) + 1);
  return counts;
}

export function placementTransform({ x, y, rot = 0 }: Placement): string {
  return `translate(${x} ${y})${rot ? ` rotate(${rot})` : ''}`;
}

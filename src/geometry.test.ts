import { describe, expect, it } from 'vitest';
import type { Placement, TileId } from './glyphs';
import { collides } from './geometry';

const at = (tile: TileId, x: number, y: number, rot = 0): Placement => ({ tile, x, y, rot });

describe('collides', () => {
  it('flags a stroke crossing through the middle of another', () => {
    expect(collides(at('LV', 0.5, 1), at('H', 0.5, 1))).toBe(true); // a plus sign
    expect(collides(at('LD', 0.5, 1), at('LB', 0.5, 1))).toBe(true); // X's slashes
  });

  it('flags strokes lying on top of each other', () => {
    expect(collides(at('LV', 0, 1), at('LV', 0, 1))).toBe(true);
    expect(collides(at('LV', 0, 1), at('SV', 0, 0.5))).toBe(true); // short bar inside a long one
    expect(collides(at('C', 0.5, 1), at('C', 0.5, 1))).toBe(true);
  });

  it('allows strokes that join at an end', () => {
    expect(collides(at('LV', 0, 1), at('H', 0.5, 1))).toBe(false); // E's middle bar on its stem
    expect(collides(at('H', 0.5, 0), at('LV', 0.5, 1))).toBe(false); // T: stem meets bar
    expect(collides(at('SV', 0, 0.5), at('SV', 0, 1.5))).toBe(false); // end to end
    expect(collides(at('SA', 0.25, 0.5), at('SA', 0.75, 1.5, 180))).toBe(false); // S's halves
    expect(collides(at('LV', 0, 1), at('SC', 0.5, 1, 90))).toBe(false); // K's chevron tip on the stem
  });

  it('ignores strokes that are apart', () => {
    expect(collides(at('LV', 0, 1), at('LV', 1, 1))).toBe(false);
    expect(collides(at('H', 0.5, 0), at('H', 0.5, 1))).toBe(false);
  });
});

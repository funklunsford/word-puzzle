import { describe, expect, it } from 'vitest';
import { LETTERS, drawnScale, drawnWidth } from '../../glyphs';
import { inkOutline, inkSeed, type Pt } from '../../ink';
import { CELL_W_COMPACT, CELL_W_COMPACT_5, MAX_DRAWN_COMPACT, MAX_DRAWN_COMPACT_5, drawnSqueeze, pointing } from './WordEditor';

/** How wide a formed letter is drawn in phone cells with this cap. */
const drawn = (ch: string, cap: number) => LETTERS[ch].width * drawnSqueeze(ch, cap) * (LETTERS[ch].spread ?? 1);

/** How wide a formed letter's ink is in phone cells with this cap: its strokes' outlines, edge to edge. */
function inkWidth(ch: string, cap: number) {
  const squeeze = drawnSqueeze(ch, cap);
  const xs = LETTERS[ch].parts.flatMap((p) => {
    const at: Pt = [p.x * squeeze, p.y];
    const nums = inkOutline(p.tile, p.rot ?? 0, inkSeed(p), 0, squeeze, p.look, at).match(/-?\d*\.?\d+/g)!.map(Number);
    return nums.filter((_, i) => i % 2 === 0).map((x) => x + at[0]);
  });
  return Math.max(...xs) - Math.min(...xs);
}

describe('letters in phone cells', () => {
  it('draws no formed letter wider than the cap, and leaves narrower ones as they are', () => {
    for (const cap of [MAX_DRAWN_COMPACT, MAX_DRAWN_COMPACT_5]) {
      for (const ch of Object.keys(LETTERS)) {
        expect(drawn(ch, cap)).toBeLessThanOrEqual(cap + 1e-9);
        if (drawnWidth(ch) <= cap) expect(drawnSqueeze(ch, cap)).toBe(drawnScale(ch).shape);
      }
    }
  });

  it("draws an O nearly round in a five-letter cell, its ink still clear of the cell's sides", () => {
    // At 1.7 units (85% of its width) it looked thin; it's drawn at least 90% as wide as it is tall.
    expect(drawn('O', MAX_DRAWN_COMPACT_5)).toBeGreaterThanOrEqual(0.9 * LETTERS.O.width);
    // The ink, thickest at the back of the curves, keeps at least a tenth of a unit from each side
    // (about 3 px on a phone); drawn at its full 2 units it would come within a few hundredths.
    expect((CELL_W_COMPACT_5 - inkWidth('O', MAX_DRAWN_COMPACT_5)) / 2).toBeGreaterThan(0.1);
    expect((CELL_W_COMPACT_5 - inkWidth('O', 2)) / 2).toBeLessThan(0.1);
    // Four-letter cells have more room: there it's drawn at its full width.
    expect(drawn('O', MAX_DRAWN_COMPACT)).toBe(LETTERS.O.width);
    expect((CELL_W_COMPACT - inkWidth('O', MAX_DRAWN_COMPACT)) / 2).toBeGreaterThan(0.1);
  });
});

describe('turning a stroke with a swipe', () => {
  // A swipe turns a stroke to point the way it goes (its corner, or the back of its curve); How
  // to play's ghost swipes the way the turned stroke points.
  const close = ([x, y]: number[], [ex, ey]: number[]) => expect(Math.hypot(x - ex, y - ey)).toBeLessThan(1e-6);

  it('turns a V over with a swipe up, and back with one down', () => {
    close(pointing('BV', 180), [0, -1]);
    close(pointing('BV', 0), [0, 1]);
  });

  it('turns a C around with a swipe to the right', () => {
    close(pointing('C', 180), [1, 0]);
    close(pointing('C', 0), [-1, 0]);
  });
});

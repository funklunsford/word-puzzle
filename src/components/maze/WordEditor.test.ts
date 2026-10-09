import { describe, expect, it } from 'vitest';
import { LETTERS, drawnScale, drawnWidth } from '../../glyphs';
import { CELL_W_COMPACT, CELL_W_COMPACT_5, MAX_DRAWN_COMPACT, MAX_DRAWN_COMPACT_5, drawnSqueeze } from './WordEditor';

/** How wide a formed letter is drawn in phone cells with this cap. */
const drawn = (ch: string, cap: number) => LETTERS[ch].width * drawnSqueeze(ch, cap) * (LETTERS[ch].spread ?? 1);

describe('letters in phone cells', () => {
  it('draws no formed letter wider than the cap, and leaves narrower ones as they are', () => {
    for (const cap of [MAX_DRAWN_COMPACT, MAX_DRAWN_COMPACT_5]) {
      for (const ch of Object.keys(LETTERS)) {
        expect(drawn(ch, cap)).toBeLessThanOrEqual(cap + 1e-9);
        if (drawnWidth(ch) <= cap) expect(drawnSqueeze(ch, cap)).toBe(drawnScale(ch).shape);
      }
    }
  });

  it("keeps an O as clear of a five-letter cell's sides as of a four-letter one's", () => {
    // Cells share the row, so a unit is a row's width over (letters × cell width): compare the
    // room either side of the O as a share of the row.
    const room = (letters: number, cellW: number, cap: number) => (cellW - drawn('O', cap)) / 2 / (letters * cellW);
    expect(room(5, CELL_W_COMPACT_5, MAX_DRAWN_COMPACT_5)).toBeGreaterThanOrEqual(room(4, CELL_W_COMPACT, MAX_DRAWN_COMPACT));
    // Before, with the cap at 2, the O filled the five-letter cell to within 0.2 units each side.
    expect(room(5, CELL_W_COMPACT_5, 2)).toBeLessThan(room(4, CELL_W_COMPACT, MAX_DRAWN_COMPACT));
  });
});

import { describe, expect, it } from 'vitest';
import { shareLabel, shareTitle, stepSquares } from './share';

describe('sharing a result', () => {
  it('colours each letter by the strokes that went into it', () => {
    expect(stepSquares('PINK', 'PINT')).toEqual([0, 0, 0, 2]);
    expect(stepSquares('PINE', 'DUNE')).toEqual([2, 2, 0, 0]);
    expect(stepSquares('PINT', 'PINE')).toEqual([0, 0, 0, 3]);
    expect(stepSquares('PINE', 'PINE')).toEqual([0, 0, 0, 0]);
  });

  it("says an Easycore daily is one, since the classic daily of its number is another puzzle", () => {
    expect(shareTitle({ number: 15, start: 'SHEEP', easycore: true })).toBe('Strokes No. 15 · Easycore');
    expect(shareLabel({ start: 'SHEEP', easycore: true })).toBe('Easycore');
    // The classic 5-letter daily, and the 4-letter one, as before.
    expect(shareTitle({ number: 15, start: 'SNARE' })).toBe('Strokes No. 15 · 5 letters');
    expect(shareTitle({ number: 1, start: 'PINK', easycore: false })).toBe('Strokes No. 1');
    expect(shareTitle({ start: 'SNARE' })).toBe('Strokes · 5 letters');
  });
});

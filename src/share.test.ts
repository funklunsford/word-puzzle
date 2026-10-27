import { describe, expect, it } from 'vitest';
import { kindsIn, shareLabel, shareTitle, stepHeat, stepSquares } from './share';

describe('sharing a result', () => {
  it('colours each letter by the strokes that went into it', () => {
    expect(stepSquares('PINK', 'PINT')).toEqual([0, 0, 0, 2]);
    expect(stepSquares('PINE', 'DUNE')).toEqual([2, 2, 0, 0]);
    expect(stepSquares('PINT', 'PINE')).toEqual([0, 0, 0, 3]);
    expect(stepSquares('PINE', 'PINE')).toEqual([0, 0, 0, 0]);
  });

  it("colours a step's letters from its moves: a carried stroke where it went, the letter it left outlined", () => {
    expect(stepHeat(5, [{ kind: 'add', at: 2 }, { kind: 'add', at: 3 }])).toEqual({ heat: [0, 0, 1, 1, 0], gave: [] });
    expect(stepHeat(5, [{ kind: 'carry', at: 4, to: 0 }, { kind: 'turn', at: 1 }])).toEqual({ heat: [1, 1, 0, 0, 0], gave: [4] });
    // 3 is the most a square shows.
    const four = [{ kind: 'remove', at: 0 }, { kind: 'add', at: 0 }, { kind: 'add', at: 0 }, { kind: 'move', at: 0 }] as const;
    expect(stepHeat(5, [...four]).heat).toEqual([3, 0, 0, 0, 0]);
  });

  it("marks each kind of move a step made once, in the card's order", () => {
    expect(kindsIn([{ kind: 'turn', at: 1 }, { kind: 'add', at: 0 }, { kind: 'carry', at: 2, to: 3 }, { kind: 'add', at: 4 }])).toEqual(['add', 'carry', 'turn']);
    expect(kindsIn(undefined)).toEqual([]);
  });

  it("says an Easycore daily is one, since the classic daily of its number is another puzzle", () => {
    expect(shareTitle({ number: 15, start: 'SHEEP', easycore: true })).toBe('Strokes No. 15 · Easy');
    expect(shareLabel({ start: 'SHEEP', easycore: true })).toBe('Easy');
    // The classic 5-letter daily, and the 4-letter one, as before.
    expect(shareTitle({ number: 15, start: 'SNARE' })).toBe('Strokes No. 15 · 5 letters');
    expect(shareTitle({ number: 1, start: 'PINK', easycore: false })).toBe('Strokes No. 1');
    expect(shareTitle({ start: 'SNARE' })).toBe('Strokes · 5 letters');
  });
});

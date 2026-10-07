import { describe, expect, it } from 'vitest';
import { SITE, shareText, stepSquares } from './share';

describe('sharing a result', () => {
  it('colours each letter by the strokes that went into it', () => {
    expect(stepSquares('PINK', 'PINT')).toEqual([0, 0, 0, 2]);
    expect(stepSquares('PINE', 'DUNE')).toEqual([2, 2, 0, 0]);
    expect(stepSquares('PINE', 'PINE')).toEqual([0, 0, 0, 0]);
  });

  it('pastes as a header, a row of squares per step, and the link, with no words from the route', () => {
    const steps = [
      { from: 'PINK', to: 'PINT', cost: 2 },
      { from: 'PINT', to: 'PINE', cost: 3 },
      { from: 'PINE', to: 'DUNE', cost: 3 },
    ];
    const text = shareText({ number: 1, start: 'PINK', goal: 'DUNE', strokes: 8, best: 8, hints: 0, hardcore: true, steps });
    expect(text.split('\n')).toEqual(['Strokes No. 1 🔥', 'PINK → DUNE · 8 strokes ⭐', '⬜⬜⬜🟧 2', '⬜⬜⬜🟥 3', '🟧🟧⬜⬜ 3', SITE]);
    expect(text).not.toMatch(/PINT|PINE/);
  });

  it('says how far off the lowest a solve was, and the hints', () => {
    const text = shareText({ start: 'PINK', goal: 'DUNE', strokes: 9, best: 8, hints: 1, hardcore: false, steps: [] });
    expect(text.split('\n').slice(0, 2)).toEqual(['Strokes', 'PINK → DUNE · 9 strokes (lowest 8) · 1 hint']);
  });
});

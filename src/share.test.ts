import { describe, expect, it } from 'vitest';
import { stepSquares } from './share';

describe('sharing a result', () => {
  it('colours each letter by the strokes that went into it', () => {
    expect(stepSquares('PINK', 'PINT')).toEqual([0, 0, 0, 2]);
    expect(stepSquares('PINE', 'DUNE')).toEqual([2, 2, 0, 0]);
    expect(stepSquares('PINT', 'PINE')).toEqual([0, 0, 0, 3]);
    expect(stepSquares('PINE', 'PINE')).toEqual([0, 0, 0, 0]);
  });
});

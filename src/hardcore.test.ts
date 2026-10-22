import { describe, expect, it } from 'vitest';
import { hasStarted } from './hardcore';

// (Where the choice is kept, under its old key too: src/easycore.test.ts.)
describe('the hardcore switch', () => {
  it('turns on without starting over before the puzzle has started', () => {
    expect(hasStarted({ words: 0, strokes: 0, hints: 0 })).toBe(false);
  });

  it('starts the puzzle over once there is a stroke on the board, a word made, or a hint taken', () => {
    expect(hasStarted({ words: 0, strokes: 1, hints: 0 })).toBe(true);
    expect(hasStarted({ words: 1, strokes: 0, hints: 0 })).toBe(true);
    expect(hasStarted({ words: 0, strokes: 0, hints: 1 })).toBe(true);
    // A won game has made its words.
    expect(hasStarted({ words: 5, strokes: 0, hints: 0 })).toBe(true);
  });
});

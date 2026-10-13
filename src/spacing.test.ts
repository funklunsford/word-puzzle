import { describe, expect, it } from 'vitest';
import { drawnWidth } from './glyphs';
import { advance, letterProfile, spaced, type Profile } from './spacing';

/** The closest two letters' ink comes, `b` placed `dx` after `a`, on the same row. */
function closest(a: Profile, b: Profile, dx: number) {
  return Math.min(...a.right.map((r, k) => dx + b.left[k] - r).filter(Number.isFinite));
}

describe('optical spacing', () => {
  it('sets each letter after the last', () => {
    const starts = spaced('STROKES', 1.2);
    expect(starts[0]).toBe(0);
    starts.slice(1).forEach((x, i) => expect(x).toBeGreaterThan(starts[i]));
  });

  it('gives two straight stems more room than two rounds or an open side', () => {
    const [I, O, L, E] = ['I', 'O', 'L', 'E'].map((ch) => letterProfile(ch));
    // The gap between the letters' boxes (their strokes' centre lines).
    const II = advance(I, I) - drawnWidth('I');
    expect(advance(O, O) - drawnWidth('O')).toBeLessThan(II);
    expect(advance(L, E) - drawnWidth('L')).toBeLessThan(II);
  });

  it('never lets bars run into the next letter', () => {
    for (const pair of ['ET', 'TS', 'LE', 'LT', 'TT', 'FA', 'PA']) {
      const [a, b] = [...pair].map((ch) => letterProfile(ch, 1.2));
      expect(closest(a, b, advance(a, b)), pair).toBeGreaterThan(0.3);
    }
  });
});

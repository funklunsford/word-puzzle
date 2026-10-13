import { describe, expect, it } from 'vitest';
import { scoreName } from './golf';

describe('scoreName', () => {
  it('names each score by the strokes over the lowest possible', () => {
    const best = 12;
    expect([12, 13, 14, 15, 16, 17, 18].map((s) => scoreName(s, best))).toEqual(['Ace', 'Albatross', 'Eagle', 'Birdie', 'Par', 'Bogey', 'Bogey']);
  });

  it('counts past a bogey as strokes over', () => {
    expect(scoreName(19, 12)).toBe('+7 over');
    expect(scoreName(30, 12)).toBe('+18 over');
  });

  it('never goes under an ace', () => {
    expect(scoreName(11, 12)).toBe('Ace');
  });
});

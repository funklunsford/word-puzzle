import { describe, expect, it } from 'vitest';
import { FLAGS } from './flags';
import { AD_CLIENT, adsReady, railWidth, railsMin } from './ads';

// The game's columns (src/MazeApp.tsx): the main column, and the path card beside it.
const FIVE = 760;
const FOUR = 640;
const SIDE = 260;

describe('ad slots', () => {
  it('are off unless the flag is turned on', () => {
    expect(FLAGS.ads.on).toBe(false);
  });

  it('load nothing while the AdSense IDs are placeholders', () => {
    expect(AD_CLIENT).toBe('ca-pub-0000000000000000');
    expect(adsReady()).toBe(false);
  });

  it('show rails only where both fit beside the whole game', () => {
    expect(railsMin(FIVE, SIDE, 160)).toBe(1464);
    expect(railsMin(FIVE, SIDE, 300)).toBe(1744);
    expect(railWidth(1100, FIVE, SIDE)).toBe(0);
    expect(railWidth(1280, FIVE, SIDE)).toBe(0);
    expect(railWidth(1463, FIVE, SIDE)).toBe(0);
    expect(railWidth(1464, FIVE, SIDE)).toBe(160);
    expect(railWidth(1600, FIVE, SIDE)).toBe(160);
    expect(railWidth(1743, FIVE, SIDE)).toBe(160);
    expect(railWidth(1744, FIVE, SIDE)).toBe(300);
    expect(railWidth(1920, FIVE, SIDE)).toBe(300);
  });

  it('fit beside the narrower 4-letter game sooner', () => {
    expect(railWidth(1343, FOUR, SIDE)).toBe(0);
    expect(railWidth(1344, FOUR, SIDE)).toBe(160);
    expect(railWidth(1624, FOUR, SIDE)).toBe(300);
  });

  it('leave the game its full width beside them', () => {
    // The rails, the gaps, the page's padding and a scrollbar all fit around the game's columns.
    for (const w of [1464, 1600, 1744, 1920, 2560]) {
      const rail = railWidth(w, FIVE, SIDE);
      expect(w - 17 - 32 - 2 * (rail + 24)).toBeGreaterThanOrEqual(FIVE + 24 + SIDE);
    }
  });
});

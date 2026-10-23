import { describe, expect, it } from 'vitest';
import { FLAGS } from './flags';
import { AD_CLIENT, adsReady, railWidth, railsMin } from './ads';

// The game's column (src/MazeApp.tsx), for 5 letters and 4.
const FIVE = 760;
const FOUR = 640;

describe('ad slots', () => {
  it('are off unless the flag is turned on', () => {
    expect(FLAGS.ads.on).toBe(false);
  });

  it('load nothing while the AdSense IDs are placeholders', () => {
    expect(AD_CLIENT).toBe('ca-pub-0000000000000000');
    expect(adsReady()).toBe(false);
  });

  it('show rails only where both fit beside the game', () => {
    expect(railsMin(FIVE, 160)).toBe(1180);
    expect(railsMin(FIVE, 300)).toBe(1460);
    expect(railWidth(1100, FIVE)).toBe(0);
    expect(railWidth(1179, FIVE)).toBe(0);
    expect(railWidth(1180, FIVE)).toBe(160);
    expect(railWidth(1280, FIVE)).toBe(160);
    expect(railWidth(1459, FIVE)).toBe(160);
    expect(railWidth(1460, FIVE)).toBe(300);
    expect(railWidth(1920, FIVE)).toBe(300);
  });

  it('fit beside the narrower 4-letter game sooner', () => {
    expect(railWidth(1059, FOUR)).toBe(0);
    expect(railWidth(1060, FOUR)).toBe(160);
    expect(railWidth(1340, FOUR)).toBe(300);
  });

  it('leave the game its full width beside them', () => {
    // The rails, the gaps, the page's padding and a scrollbar all fit around the game's column.
    for (const w of [1180, 1280, 1460, 1920, 2560]) {
      const rail = railWidth(w, FIVE);
      expect(w - 17 - 32 - 2 * (rail + 24)).toBeGreaterThanOrEqual(FIVE);
    }
  });
});

// Optical spacing for words drawn large in the game's ink: the wordmark, and the name on the share
// card and link preview.
//
// A fixed gap between letters' boxes leaves straight stems cramped (I beside P) and open letters
// loose (the room above an L's foot, either side of a T's stem). So each pair is set so the white
// between them, averaged down the cap height, comes out the same, the way type designers space
// letters. Hollows deeper than DEPTH into a letter count only that deep, since the eye doesn't take
// them for space between letters, and no two letters' ink comes closer than CLEAR.

import { LETTERS, drawnScale } from './glyphs';
import { inkOutline, inkSeed, type Pt } from './ink';

/** The rows the white is measured along: the cap height, every 0.05. */
const ROWS = Array.from({ length: 41 }, (_, i) => i * 0.05);
/** The white between two letters, averaged down the rows. */
const WHITE = 0.6;
/** How far into a letter an open side counts as white between letters. */
const DEPTH = 0.6;
/** The closest two letters' ink may come, a row above or below included (so slants don't brush). */
const CLEAR = 0.34;

/** A shape's ink on each row: its leftmost and rightmost edge (NaN where the row has none). */
export interface Profile {
  left: number[];
  right: number[];
}

/** The profile of closed outlines, each a list of points. */
export function profileOf(outlines: Pt[][]): Profile {
  const left: number[] = [];
  const right: number[] = [];
  for (const y of ROWS) {
    let lo = Infinity;
    let hi = -Infinity;
    for (const pts of outlines) {
      for (let i = 0; i < pts.length; i++) {
        const [a, b] = [pts[i], pts[(i + 1) % pts.length]];
        if (a[1] === b[1] || (a[1] - y) * (b[1] - y) > 0) continue;
        const x = a[0] + ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]);
        lo = Math.min(lo, x);
        hi = Math.max(hi, x);
      }
    }
    left.push(lo === Infinity ? NaN : lo);
    right.push(hi === -Infinity ? NaN : hi);
  }
  return { left, right };
}

/** A letter's profile as drawn with pen `weight`, measured from the letter's origin. */
export function letterProfile(ch: string, weight = 1): Profile {
  const { shape, place } = drawnScale(ch);
  return profileOf(
    LETTERS[ch].parts.map((p) => {
      const at: Pt = [p.x * place, p.y];
      const nums = inkOutline(p.tile, p.rot ?? 0, inkSeed(p), 0, shape, p.look, at, weight).match(/-?\d*\.?\d+/g)!.map(Number);
      return Array.from({ length: nums.length / 2 }, (_, i): Pt => [nums[2 * i] + at[0], nums[2 * i + 1] + at[1]]);
    }),
  );
}

/** A profile with its hollows filled to DEPTH: what the eye counts as the letter's edge. */
function filled({ left, right }: Profile): Profile {
  const outer = Math.max(...right.filter(Number.isFinite));
  const inner = Math.min(...left.filter(Number.isFinite));
  return {
    left: left.map((x) => (Number.isFinite(x) ? Math.min(x, inner + DEPTH) : inner + DEPTH)),
    right: right.map((x) => (Number.isFinite(x) ? Math.max(x, outer - DEPTH) : outer - DEPTH)),
  };
}

/** How far after `a`'s origin `b`'s goes. */
export function advance(a: Profile, b: Profile): number {
  const [fa, fb] = [filled(a), filled(b)];
  const white = ROWS.reduce((t, _, k) => t + fb.left[k] - fa.right[k], 0) / ROWS.length;
  // Never closer than CLEAR, a row either side included.
  let clear = -Infinity;
  ROWS.forEach((_, k) => {
    for (const j of [k - 1, k, k + 1]) {
      if (j >= 0 && j < ROWS.length && Number.isFinite(a.right[k]) && Number.isFinite(b.left[j])) clear = Math.max(clear, a.right[k] - b.left[j] + CLEAR);
    }
  });
  return Math.max(WHITE - white, clear);
}

/**
 * Where each letter of `word` starts, drawn with pen `weight`. With a `lead` shape (the wordmark's
 * nib) the lead sits at 0 and the letters follow it.
 */
export function spaced(word: string, weight = 1, lead?: Profile): number[] {
  const shapes = [...word].map((ch) => letterProfile(ch, weight));
  let x = lead ? advance(lead, shapes[0]) : 0;
  return shapes.map((p, i) => (i === 0 ? x : (x += advance(shapes[i - 1], p))));
}

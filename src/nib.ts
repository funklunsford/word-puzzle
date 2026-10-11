// The pen nib before the wordmark, in the header and on the link preview: a gold nib a cap height
// tall, drawn rather than built from strokes. It has an arched top, rounded shoulders and sides
// sweeping in to a fine point, with a breather hole and a slit cut through it, and its tip is
// dipped in the D's purple ink (in the header the ink first runs through the strokes' colours: see
// .nib-ink in styles.css). Its tip sits on the baseline, in letter units (cap height 2).

import type { Pt } from './ink';
import { profileOf, spaced } from './spacing';

/**
 * It leans `tilt` degrees about its middle, its point towards the D, and sits `room` further from
 * the D than the letters' own spacing would put it.
 */
export const NIB = { tilt: -20, room: 0.3 };
/** The nib's right side, from the middle of its top to its point: a quadratic, then two cubics. Its left side mirrors it. */
const NIB_SIDE: Pt[][] = [
  [[0, 0], [0.22, -0.01], [0.42, 0.06]],
  [[0.42, 0.06], [0.5, 0.2], [0.54, 0.38], [0.53, 0.55]],
  [[0.53, 0.55], [0.51, 0.95], [0.15, 1.55], [0, 2]],
];
const mirror = ([x, y]: Pt): Pt => [-x, y];
const curve = (seg: Pt[]) => `${seg.length === 3 ? 'Q' : 'C'}${seg.slice(1).map(([x, y]) => `${x} ${y}`).join(' ')}`;
/** The nib's outline, then its breather hole and slit (cut through it by filling even-odd). */
export const NIB_PATH = [
  'M0 0',
  ...NIB_SIDE.map(curve),
  ...[...NIB_SIDE].reverse().map((seg) => curve([...seg].reverse().map(mirror))),
  'Z M0.085 0.82 A0.085 0.085 0 1 0 -0.085 0.82 A0.085 0.085 0 1 0 0.085 0.82 Z M-0.02 0.905 L0.02 0.905 L0.01 1.97 L-0.01 1.97 Z',
].join(' ');
/** A point `t` of the way along a Bézier segment. */
function bezier(seg: Pt[], t: number): Pt {
  let pts = seg;
  while (pts.length > 1) pts = pts.slice(1).map((p, i): Pt => [pts[i][0] + (p[0] - pts[i][0]) * t, pts[i][1] + (p[1] - pts[i][1]) * t]);
  return pts[0];
}
/** A point of the nib, leaning by its tilt about its middle (0, 1). */
function tilted([x, y]: Pt): Pt {
  const t = (NIB.tilt * Math.PI) / 180;
  return [x * Math.cos(t) - (y - 1) * Math.sin(t), 1 + x * Math.sin(t) + (y - 1) * Math.cos(t)];
}
/** The leaning nib's outline as points, its middle at 0: what the name is spaced from. */
export const NIB_PROFILE = (() => {
  const side = NIB_SIDE.flatMap((seg) => Array.from({ length: 16 }, (_, i) => bezier(seg, (i + 1) / 16)));
  const outline: Pt[] = [[0, 0], ...side, ...[...side].reverse().map(mirror)];
  return profileOf([outline.map(tilted)]);
})();
/** How far the leaning nib reaches left of its middle. */
export const NIB_LEAD = -Math.min(...NIB_PROFILE.left.filter(Number.isFinite));
/** The ink it was dipped in, up to a wavy line across its lower part (clipped to the nib). */
export const NIB_INK = 'M-0.7 1.27 C-0.42 1.15 -0.2 1.35 0 1.25 C0.2 1.15 0.42 1.35 0.7 1.22 L0.7 2.1 L-0.7 2.1 Z';

/**
 * Where each letter of `word` starts after the nib, drawn with pen `weight`, measured from the
 * nib's left edge (its middle is at NIB_LEAD).
 */
export function afterNib(word: string, weight = 1): number[] {
  return spaced(word, weight, NIB_PROFILE).map((x) => x + NIB_LEAD + NIB.room);
}

// The mark before the wordmark, in the header and on the link preview: a golf club whose head is a
// gold pen nib, with a golf ball by its toe. The nib has an arched top, rounded shoulders and sides
// sweeping in to a fine point, with a breather hole and a slit cut through it; it lies on its side as
// the club's head, its point (the toe) towards the name, dipped in the purple ink the O drips (in the
// header the ink first runs through the strokes' colours: see .nib-ink in styles.css). In letter
// units (cap height 2), measured from the middle of the head.

import type { Pt } from './ink';
import { profileOf, spaced } from './spacing';

/**
 * The club: its head (the nib, turned `rot` degrees about its middle and drawn at `scale`, its
 * middle at `x, y`), a shaft from the head's heel up to its grip end (the top `grip` of it wrapped
 * in a grip `gripWidth` across), and a golf ball of radius `r` by the toe. The name sits `room`
 * further off than the letters' own spacing would put it.
 */
export const CLUB = {
  head: { x: 0, y: 1.68, rot: -80, scale: 0.5 },
  shaft: { from: [-0.47, 1.6] as Pt, to: [-1.1, -0.05] as Pt, width: 0.16, grip: 0.3, gripWidth: 0.24 },
  ball: { x: 0.73, y: 1.86, r: 0.12 },
  room: 0.3,
};
/** The nib's right side, from the middle of its top to its point: a quadratic, then two cubics. Its left side mirrors it. */
const NIB_SIDE: Pt[][] = [
  [[0, 0], [0.22, -0.01], [0.42, 0.06]],
  [[0.42, 0.06], [0.5, 0.2], [0.54, 0.38], [0.53, 0.55]],
  [[0.53, 0.55], [0.51, 0.95], [0.15, 1.55], [0, 2]],
];
const mirror = ([x, y]: Pt): Pt => [-x, y];
const curve = (seg: Pt[]) => `${seg.length === 3 ? 'Q' : 'C'}${seg.slice(1).map(([x, y]) => `${x} ${y}`).join(' ')}`;
/** The nib's outline, upright with its point down, then its breather hole and slit (cut through it by filling even-odd). */
export const NIB_PATH = [
  'M0 0',
  ...NIB_SIDE.map(curve),
  ...[...NIB_SIDE].reverse().map((seg) => curve([...seg].reverse().map(mirror))),
  'Z M0.085 0.82 A0.085 0.085 0 1 0 -0.085 0.82 A0.085 0.085 0 1 0 0.085 0.82 Z M-0.02 0.905 L0.02 0.905 L0.01 1.97 L-0.01 1.97 Z',
].join(' ');
/** The ink it was dipped in, up to a wavy line across its point end (clipped to the nib). */
export const NIB_INK = 'M-0.7 1.27 C-0.42 1.15 -0.2 1.35 0 1.25 C0.2 1.15 0.42 1.35 0.7 1.22 L0.7 2.1 L-0.7 2.1 Z';
/** The SVG transform that turns the upright nib (its middle at 0, 1) into the club's head. */
export const HEAD_TRANSFORM = `translate(${CLUB.head.x} ${CLUB.head.y}) rotate(${CLUB.head.rot}) scale(${CLUB.head.scale}) translate(0 -1)`;

/** A point `t` of the way along a Bézier segment. */
function bezier(seg: Pt[], t: number): Pt {
  let pts = seg;
  while (pts.length > 1) pts = pts.slice(1).map((p, i): Pt => [pts[i][0] + (p[0] - pts[i][0]) * t, pts[i][1] + (p[1] - pts[i][1]) * t]);
  return pts[0];
}
/** A point of the upright nib, placed as the club's head (what HEAD_TRANSFORM does). */
function asHead([x, y]: Pt): Pt {
  const { x: hx, y: hy, rot, scale } = CLUB.head;
  const t = (rot * Math.PI) / 180;
  const [u, v] = [x * scale, (y - 1) * scale];
  return [hx + u * Math.cos(t) - v * Math.sin(t), hy + u * Math.sin(t) + v * Math.cos(t)];
}
/** The club's ink as outlines: its head, its shaft (as wide as its grip) and the ball. */
function clubOutlines(): Pt[][] {
  const side = NIB_SIDE.flatMap((seg) => Array.from({ length: 16 }, (_, i) => bezier(seg, (i + 1) / 16)));
  const outline: Pt[] = [[0, 0], ...side, ...[...side].reverse().map(mirror)];
  const head = outline.map(asHead);
  const { from, to, gripWidth } = CLUB.shaft;
  const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const [nx, ny] = [((from[1] - to[1]) / len) * (gripWidth / 2), ((to[0] - from[0]) / len) * (gripWidth / 2)];
  const shaft: Pt[] = [[from[0] + nx, from[1] + ny], [to[0] + nx, to[1] + ny], [to[0] - nx, to[1] - ny], [from[0] - nx, from[1] - ny]];
  const { x, y, r } = CLUB.ball;
  const ball = Array.from({ length: 24 }, (_, i): Pt => [x + r * Math.cos((i * Math.PI) / 12), y + r * Math.sin((i * Math.PI) / 12)]);
  return [head, shaft, ball];
}
/** The club's profile, measured from the middle of its head: what the name is spaced from. */
export const MARK_PROFILE = profileOf(clubOutlines());
/** How far the club reaches left of the middle of its head. */
export const MARK_LEAD = -Math.min(...MARK_PROFILE.left.filter(Number.isFinite));

/**
 * Where each letter of `word` starts after the club, drawn with pen `weight`, measured from the
 * club's left edge (the middle of its head is at MARK_LEAD).
 */
export function afterMark(word: string, weight = 1): number[] {
  return spaced(word, weight, MARK_PROFILE).map((x) => x + MARK_LEAD + CLUB.room);
}

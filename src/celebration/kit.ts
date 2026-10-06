// Small helpers for celebration scenes: easing and walking along a word's strokes.

import type { Pt } from '../ink';

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** 0 before a, 1 after b, smooth between. */
export const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export const mix = (a: number, b: number, k: number) => a + (b - a) * k;

/** A polyline with its running length, for walking along it. */
export interface Line {
  pts: Pt[];
  cum: number[];
  length: number;
}

export const toLine = (pts: Pt[]): Line => {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, cum, length: cum[cum.length - 1] };
};

/** The point `d` along a line, with the unit tangent there. */
export function along(l: Line, d: number): { x: number; y: number; tx: number; ty: number } {
  const dd = Math.min(l.length, Math.max(0, d));
  let i = 1;
  while (i < l.cum.length - 1 && l.cum[i] < dd) i++;
  const [a, b] = [l.pts[i - 1], l.pts[i]];
  const seg = l.cum[i] - l.cum[i - 1] || 1;
  const f = (dd - l.cum[i - 1]) / seg;
  return { x: a[0] + (b[0] - a[0]) * f, y: a[1] + (b[1] - a[1]) * f, tx: (b[0] - a[0]) / seg, ty: (b[1] - a[1]) / seg };
}

// "Nib + ink" stroke rendering: each stroke is drawn as a filled outline, as if by a broad-nib
// pen held at an angle (downstrokes thick, crossbars thin) with a little hand-drawn wobble.
//
// Geometry and game rules still use the plain centreline paths in glyphs.ts; this only changes
// how a stroke looks. Because the nib angle is fixed on the page, the outline depends on the
// stroke's rotation, so it is computed in its final orientation (rotation baked in).

import { TILES, type Look, type Placement, type TileId } from './glyphs';

export type Pt = [number, number];

const STEP = 0.02;
/** Pen angle: the nib's edge runs 38° up from horizontal. */
const NIB = (38 * Math.PI) / 180;
/** Half-width when moving along the nib's edge (thinnest) and the extra at right angles to it. */
const THIN = 0.035;
const SPAN = 0.115;
const WOBBLE = 0.012;
const PRESSURE = 0.08;

const centerlines = new Map<TileId, Pt[]>();

/** Sample a tile's path (M / L / semicircular A commands) in its local coordinates. */
function centerline(tile: TileId): Pt[] {
  const hit = centerlines.get(tile);
  if (hit) return hit;
  const tokens = TILES[tile].path.match(/[MLA]|-?\d*\.?\d+/g)!;
  const pts: Pt[] = [];
  let cur: Pt = [0, 0];
  let i = 0;
  const num = () => Number(tokens[i++]);
  while (i < tokens.length) {
    const cmd = tokens[i++];
    if (cmd === 'M') {
      cur = [num(), num()];
      pts.push(cur);
    } else if (cmd === 'L') {
      const to: Pt = [num(), num()];
      const n = Math.max(1, Math.ceil(Math.hypot(to[0] - cur[0], to[1] - cur[1]) / STEP));
      for (let k = 1; k <= n; k++) pts.push([cur[0] + ((to[0] - cur[0]) * k) / n, cur[1] + ((to[1] - cur[1]) * k) / n]);
      cur = to;
    } else {
      // A rx ry x-axis-rotation large-arc sweep x y. Every arc in the tile set is a semicircle,
      // so its centre is the chord's midpoint.
      const r = num();
      i += 3;
      const sweep = num();
      const to: Pt = [num(), num()];
      const cx = (cur[0] + to[0]) / 2;
      const cy = (cur[1] + to[1]) / 2;
      const a0 = Math.atan2(cur[1] - cy, cur[0] - cx);
      const span = sweep ? Math.PI : -Math.PI;
      const n = Math.ceil((Math.PI * r) / STEP);
      for (let k = 1; k <= n; k++) {
        const a = a0 + (span * k) / n;
        pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
      }
      cur = to;
    }
  }
  centerlines.set(tile, pts);
  return pts;
}

const smoothstep = (edge: number, x: number) => {
  const t = Math.min(1, Math.max(0, x / edge));
  return t * t * (3 - 2 * t);
};

const outlines = new Map<string, string>();

/** A tile's centreline turned by `rot` (degrees clockwise) and narrowed by `squeeze`, centred on the origin. */
export function strokeCenterline(tile: TileId, rot = 0, squeeze = 1): Pt[] {
  const t = (rot * Math.PI) / 180;
  const c = Math.cos(t);
  const s = Math.sin(t);
  return centerline(tile).map(([x, y]): Pt => [(x * c - y * s) * squeeze, x * s + y * c]);
}

const lerp = (a: Pt, b: Pt, k: number): Pt => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
const gap = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/**
 * The centreline a straight stroke is drawn along once its letter is formed (see Look), relative
 * to the stroke's own position: the part of it kept from one end.
 */
export function lookCenterline(p: Placement, look: Look): Pt[] {
  const own = strokeCenterline(p.tile, p.rot ?? 0);
  const [s, e] = [own[0], own[own.length - 1]];
  const k = look.len;
  const [a, b] = look.keep === 'end' ? [lerp(e, s, k), e] : [s, lerp(s, e, k)];
  const n = Math.max(1, Math.ceil(gap(a, b) / STEP));
  return Array.from({ length: n + 1 }, (_, i) => lerp(a, b, i / n));
}

/** Filled nib-and-ink outline around a centreline (see inkOutline). */
export function inkPath(pts: Pt[], seed = 0, minHalfWidth = 0): string {
  const n = pts.length;
  const along = [0];
  for (let k = 1; k < n; k++) along.push(along[k - 1] + gap(pts[k], pts[k - 1]));
  const total = along[n - 1];

  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let k = 0; k < n; k++) {
    const a = pts[Math.max(0, k - 1)];
    const b = pts[Math.min(n - 1, k + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const d = along[k];
    const wobble = WOBBLE * Math.sin(d * 2.3 + seed) + WOBBLE * 0.4 * Math.sin(d * 5.9 + seed * 1.7);
    const nib = THIN + SPAN * Math.abs(Math.sin(Math.atan2(dy, dx) + NIB));
    const pressure = 1 + PRESSURE * Math.sin(d * 2.7 + seed);
    const ends = 0.6 + 0.4 * smoothstep(0.08, Math.min(d, total - d));
    const half = Math.max(minHalfWidth, nib * pressure * ends);
    const x = pts[k][0] + nx * wobble;
    const y = pts[k][1] + ny * wobble;
    left.push([x + nx * half, y + ny * half]);
    right.push([x - nx * half, y - ny * half]);
  }
  const f = ([x, y]: Pt) => `${x.toFixed(3)} ${y.toFixed(3)}`;
  return `M${left.map(f).join(' L')} L${right.reverse().map(f).join(' L')} Z`;
}

/**
 * Filled outline of a stroke at rotation `rot` (degrees clockwise, like SVG rotate), centred on
 * the origin. `seed` varies the wobble; `minHalfWidth` keeps thin parts visible at small sizes;
 * `squeeze` narrows the stroke's path horizontally (the pen width stays the same). With a `look`,
 * the stroke is drawn as its formed letter shows it (`at` is its position, for the look's offset).
 */
export function inkOutline(tile: TileId, rot = 0, seed = 0, minHalfWidth = 0, squeeze = 1, look?: Look, at: Pt = [0, 0]): string {
  const key = `${tile}|${rot}|${seed}|${minHalfWidth.toFixed(3)}|${squeeze}${look ? `|${JSON.stringify(look)}@${at}` : ''}`;
  const hit = outlines.get(key);
  if (hit) return hit;
  const pts = look ? lookCenterline({ tile, x: at[0], y: at[1], rot }, look) : strokeCenterline(tile, rot, squeeze);
  const d = inkPath(pts, seed, minHalfWidth);
  outlines.set(key, d);
  return d;
}

/** `pts` resampled to `n` points evenly spaced along its length. */
function resample(pts: Pt[], n: number): Pt[] {
  const along = [0];
  for (let k = 1; k < pts.length; k++) along.push(along[k - 1] + gap(pts[k], pts[k - 1]));
  const total = along[along.length - 1] || 1;
  const out: Pt[] = [];
  let j = 0;
  for (let i = 0; i < n; i++) {
    const d = (total * i) / (n - 1);
    while (j < pts.length - 2 && along[j + 1] < d) j++;
    const span = along[j + 1] - along[j] || 1;
    out.push(lerp(pts[j], pts[Math.min(j + 1, pts.length - 1)], (d - along[j]) / span));
  }
  return out;
}

/** A stroke part-way (`t` from 0 to 1) between two centrelines, inked: U's stems drawing back to halfway. */
export function inkMorph(from: Pt[], to: Pt[], t: number, seed = 0, minHalfWidth = 0): string {
  const n = Math.max(from.length, to.length, 24);
  const a = resample(from, n);
  const b = resample(to, n);
  return inkPath(a.map((p, i) => lerp(p, b[i], t)), seed, minHalfWidth);
}

/**
 * Wobble seed for a placed stroke. It ignores horizontal position, so a letter looks the same
 * wherever it is drawn (like a font) while its different strokes still differ.
 */
export function inkSeed(p: Placement): number {
  const key = `${p.tile}${p.y}${p.rot ?? 0}`;
  let h = 7;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return h / 10;
}

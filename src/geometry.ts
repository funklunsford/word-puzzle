// Stroke collision detection: do two placed strokes cross or overlap?
//
// Strokes are sampled into points along their paths. Two strokes collide when they share ink
// anywhere other than at an end or joint of one of them. Touching end-to-middle (E's bars on its
// stem) or end-to-end (the two halves of S) is how strokes join, so it is allowed.

import { TILES, type Placement, type TileId } from './glyphs';

type Pt = [number, number];

interface Sampled {
  pts: Pt[];
  /** Ends of each path segment: the stroke's two ends plus any corners (chevron tip, bowl corners). */
  ends: Pt[];
}

const STEP = 0.025;
/** Centerlines closer than this share ink. */
const TOUCH = 0.08;
/** Ink within this distance of an end or corner counts as a join, not a collision. */
const JOIN = 0.2;

const tileCache = new Map<TileId, Sampled>();

/** Sample a tile's path (M / L / semicircular A commands) in its local coordinates. */
function sampleTile(tile: TileId): Sampled {
  const hit = tileCache.get(tile);
  if (hit) return hit;
  const tokens = TILES[tile].path.match(/[MLA]|-?\d*\.?\d+/g)!;
  const pts: Pt[] = [];
  const ends: Pt[] = [];
  let cur: Pt = [0, 0];
  let i = 0;
  const num = () => Number(tokens[i++]);
  while (i < tokens.length) {
    const cmd = tokens[i++];
    if (cmd === 'M') {
      cur = [num(), num()];
      ends.push(cur);
    } else if (cmd === 'L') {
      const to: Pt = [num(), num()];
      const n = Math.max(1, Math.ceil(Math.hypot(to[0] - cur[0], to[1] - cur[1]) / STEP));
      for (let k = 0; k <= n; k++) pts.push([cur[0] + ((to[0] - cur[0]) * k) / n, cur[1] + ((to[1] - cur[1]) * k) / n]);
      cur = to;
      ends.push(cur);
    } else if (cmd === 'A') {
      const r = num();
      i += 3; // ry, x-axis-rotation, large-arc flag
      const sweep = num();
      const to: Pt = [num(), num()];
      // Every arc in the tile set is a semicircle, so its center is the chord midpoint.
      const cx = (cur[0] + to[0]) / 2;
      const cy = (cur[1] + to[1]) / 2;
      const a0 = Math.atan2(cur[1] - cy, cur[0] - cx);
      const span = sweep ? Math.PI : -Math.PI;
      const n = Math.ceil((Math.PI * r) / STEP);
      for (let k = 0; k <= n; k++) {
        const a = a0 + (span * k) / n;
        pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
      }
      cur = to;
      ends.push(cur);
    }
  }
  const s = { pts, ends };
  tileCache.set(tile, s);
  return s;
}

const placedCache = new Map<string, Sampled & { box: [number, number, number, number] }>();

function samplePlacement(p: Placement) {
  const key = `${p.tile}@${p.x},${p.y},${p.rot ?? 0}`;
  const hit = placedCache.get(key);
  if (hit) return hit;
  const t = ((p.rot ?? 0) * Math.PI) / 180;
  const c = Math.cos(t);
  const s = Math.sin(t);
  // Same convention as SVG rotate(): clockwise on screen (y points down).
  const tf = ([x, y]: Pt): Pt => [x * c - y * s + p.x, x * s + y * c + p.y];
  const local = sampleTile(p.tile);
  const pts = local.pts.map(tf);
  const xs = pts.map((q) => q[0]);
  const ys = pts.map((q) => q[1]);
  const out = {
    pts,
    ends: local.ends.map(tf),
    box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] as [number, number, number, number],
  };
  placedCache.set(key, out);
  return out;
}

const near = (q: Pt, ends: Pt[]) => ends.some((e) => Math.hypot(q[0] - e[0], q[1] - e[1]) < JOIN);

/** True if the two strokes cross or overlap (share ink away from their ends and corners). */
export function collides(a: Placement, b: Placement): boolean {
  const A = samplePlacement(a);
  const B = samplePlacement(b);
  if (A.box[0] > B.box[2] + TOUCH || B.box[0] > A.box[2] + TOUCH || A.box[1] > B.box[3] + TOUCH || B.box[1] > A.box[3] + TOUCH) {
    return false;
  }
  for (const pa of A.pts) {
    if (pa[0] < B.box[0] - TOUCH || pa[0] > B.box[2] + TOUCH || pa[1] < B.box[1] - TOUCH || pa[1] > B.box[3] + TOUCH) continue;
    for (const pb of B.pts) {
      if (Math.abs(pa[0] - pb[0]) < TOUCH && Math.abs(pa[1] - pb[1]) < TOUCH && Math.hypot(pa[0] - pb[0], pa[1] - pb[1]) < TOUCH) {
        if (!near(pa, A.ends) && !near(pb, B.ends)) return true;
      }
    }
  }
  return false;
}

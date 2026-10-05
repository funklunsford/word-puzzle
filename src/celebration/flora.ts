// The flora celebration: the start word, drawn in vines, bursts into wild growth (curling tendrils,
// unfurling ferns, big blooms); then the wild growth is gathered into the goal word's strokes and
// shrinks away while a neat, trained garden grows along them: a leafy vine on each stroke, fern
// fronds on the bars, and a small flower at each stroke's tip in the game's colour for it.
//
// Everything is a function of time `t` (seconds), worked out afresh for each frame, so any moment
// can be drawn on its own (for stills and previews).

import type * as THREE_NS from 'three';
import type { TileId } from '../glyphs';
import type { Pt } from '../ink';
import { seededRandom } from '../maze';
import type { CelebrationTheme } from './themes';
import { wordStrokes } from './wordPoints';

type Three = typeof THREE_NS;

/** Points along each stem's ribbon. */
const K = 40;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
/** 0 before a, 1 after b, smooth between. */
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const mix = (a: number, b: number, k: number) => a + (b - a) * k;

/** A polyline with its running length, for walking along it. */
interface Line {
  pts: Pt[];
  cum: number[];
  length: number;
}
const toLine = (pts: Pt[]): Line => {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, cum, length: cum[cum.length - 1] };
};
/** The point and the unit tangent `d` along a line. */
function along(l: Line, d: number): { x: number; y: number; tx: number; ty: number } {
  const dd = Math.min(l.length, Math.max(0, d));
  let i = 1;
  while (i < l.cum.length - 1 && l.cum[i] < dd) i++;
  const [a, b] = [l.pts[i - 1], l.pts[i]];
  const seg = l.cum[i] - l.cum[i - 1] || 1;
  const f = (dd - l.cum[i - 1]) / seg;
  return { x: a[0] + (b[0] - a[0]) * f, y: a[1] + (b[1] - a[1]) * f, tx: (b[0] - a[0]) / seg, ty: (b[1] - a[1]) / seg };
}

interface Options {
  start: string;
  goal: string;
  theme: CelebrationTheme;
  small: boolean;
  /** A theme-aware colour from the page (CSS custom property), as sRGB 0–1. */
  cssColor: (name: string, fallback: string) => [number, number, number];
}

export function floraScene(THREE: Three, { start, goal, theme, small, cssColor }: Options) {
  const flora = theme.flora!;
  const { burst, calm, settled } = theme.timing;
  const random = seededRandom(23);
  const pick = <T,>(xs: T[]) => xs[Math.floor(random() * xs.length)];
  const color = (hex: string) => new THREE.Color(hex);

  // ---------- The wild growth, from the start word ----------
  const startLines = wordStrokes(start).map((s) => toLine(s.pts));
  const goalStrokes = wordStrokes(goal).map((s) => ({ tile: s.tile, line: toLine(s.pts) }));
  const goalPoints = goalStrokes.flatMap((s) => Array.from({ length: 24 }, (_, i) => along(s.line, (s.line.length * i) / 23)));
  const nWild = small ? 30 : 44;
  // Split the start word's strokes into nWild pieces, by length: at first the pieces draw the word.
  const total = startLines.reduce((t, l) => t + l.length, 0);
  const counts = startLines.map((l) => Math.max(1, Math.round((l.length / total) * nWild)));
  const wild = startLines.flatMap((l, li) =>
    Array.from({ length: counts[li] }, (_, k) => {
      const a = (l.length * k) / counts[li];
      const b = (l.length * (k + 1)) / counts[li];
      const piece = Array.from({ length: K }, (_, i) => along(l, mix(a, b, i / (K - 1))));
      const p0 = piece[0];
      // Where it's gathered to as it's tamed: the nearest point of the goal word.
      const near = goalPoints.reduce((m, q) => (Math.hypot(q.x - p0.x, q.y - p0.y) < Math.hypot(m.x - p0.x, m.y - p0.y) ? q : m));
      const fern = random() < 0.22;
      const outward = Math.atan2(p0.y + 0.3, p0.x) + (random() - 0.5) * 1.6;
      return {
        piece,
        gather: near,
        fern,
        flower: !fern && random() < 0.4,
        // Head mostly outward and a little upward, as plants do.
        h0: Math.atan2(Math.sin(outward) + 0.5, Math.cos(outward)),
        side: random() < 0.5 ? -1 : 1,
        reach: 1.1 + 2.4 * random(),
        coil: 4 + 7 * random(),
        bend: 0.4 + 1.2 * random(),
        phase: random() * 6.28,
        stem: color(pick(flora.wildStems)),
        leafColors: Array.from({ length: 4 }, () => color(pick(flora.wildLeaves))),
        leafSizes: Array.from({ length: 4 }, () => 0.16 + 0.24 * random()),
        leafAngles: Array.from({ length: 4 }, () => 0.5 + 0.8 * random()),
        bloom: 0.2 + 0.18 * random(),
        petals: color(pick(flora.wildFlowers)),
      };
    }),
  );

  // ---------- The trained garden, along the goal word ----------
  const tameStem = color(flora.tameStem);
  const tame = goalStrokes.map((s, j) => {
    const L = s.line.length;
    const bar = s.tile === 'H';
    // Leaves every 0.32 along a vine (alternating sides); pinnae every 0.11 along a bar (in pairs).
    const leaves = bar
      ? Array.from({ length: Math.max(2, Math.floor((L - 0.12) / 0.11)) }, (_, k) => 0.08 + k * 0.11).flatMap((d) => [
          { d, side: 1 },
          { d, side: -1 },
        ])
      : Array.from({ length: Math.max(1, Math.floor((L - 0.1) / 0.32)) }, (_, k) => ({ d: 0.2 + k * 0.32, side: k % 2 ? -1 : 1 }));
    // The flower sits at the stroke's top end (a bar's right end).
    const [a, b] = [s.line.pts[0], s.line.pts[s.line.pts.length - 1]];
    const tipAtEnd = bar ? b[0] >= a[0] : b[1] >= a[1];
    return {
      line: s.line,
      bar,
      delay: 0.07 * j,
      leaves,
      tipAtEnd,
      flower: new THREE.Color().setRGB(...cssColor(`--t-${s.tile as TileId}`, '#d6908f'), THREE.SRGBColorSpace),
      leafColors: leaves.map(() => color(pick(flora.tameLeaves))),
    };
  });

  // ---------- Meshes ----------
  const stems = nWild + tame.length;
  const ribbon = new THREE.BufferGeometry();
  const pos = new Float32Array(stems * K * 2 * 3);
  const col = new Float32Array(stems * K * 2 * 3);
  const index: number[] = [];
  for (let s = 0; s < stems; s++)
    for (let k = 0; k < K - 1; k++) {
      const v = (s * K + k) * 2;
      index.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
    }
  ribbon.setIndex(index);
  ribbon.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  ribbon.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const paint = (s: number, c: THREE_NS.Color) => {
    for (let v = s * K * 2; v < (s + 1) * K * 2; v++) col.set([c.r, c.g, c.b], v * 3);
  };
  wild.forEach((w, i) => paint(i, w.stem));
  tame.forEach((_, j) => paint(nWild + j, tameStem));
  /** A flat, unlit material (instance colours tint it), drawn in order rather than by depth. */
  const flat = () => new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, depthTest: false, depthWrite: false });
  const stemsMesh = new THREE.Mesh(ribbon, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, depthTest: false, depthWrite: false }));

  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, 0);
  leafShape.quadraticCurveTo(0.45, 0.36, 1, 0);
  leafShape.quadraticCurveTo(0.45, -0.36, 0, 0);
  const petalShape = new THREE.Shape();
  petalShape.moveTo(0.12, 0);
  petalShape.quadraticCurveTo(0.45, 0.5, 1, 0);
  petalShape.quadraticCurveTo(0.45, -0.5, 0.12, 0);
  const wildLeafCount = nWild * 4 + wild.filter((w) => w.fern).length * 20;
  const tameLeafCount = tame.reduce((t, s) => t + s.leaves.length, 0);
  const leaves = new THREE.InstancedMesh(new THREE.ShapeGeometry(leafShape, 6), flat(), wildLeafCount + tameLeafCount);
  const flowers = nWild + tame.length;
  const petals = new THREE.InstancedMesh(new THREE.ShapeGeometry(petalShape, 6), flat(), flowers * 5);
  const centres = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 14), flat(), flowers);
  const meshes = [stemsMesh, leaves, petals, centres];
  meshes.forEach((m, i) => {
    m.frustumCulled = false;
    m.renderOrder = i;
  });
  for (const m of [leaves, petals, centres]) m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  // Instance colours never change: set them once.
  let li = 0;
  for (const w of wild) {
    for (let k = 0; k < 4; k++) leaves.setColorAt(li++, w.leafColors[k]);
    if (w.fern) for (let k = 0; k < 20; k++) leaves.setColorAt(li++, color(flora.wildFern));
  }
  for (const s of tame) s.leafColors.forEach((c) => leaves.setColorAt(li++, c));
  const centre = [color(flora.wildCentre), color(flora.tameCentre)];
  wild.forEach((w, i) => {
    for (let k = 0; k < 5; k++) petals.setColorAt(i * 5 + k, w.petals);
    centres.setColorAt(i, centre[0]);
  });
  tame.forEach((s, j) => {
    for (let k = 0; k < 5; k++) petals.setColorAt((nWild + j) * 5 + k, s.flower);
    centres.setColorAt(nWild + j, centre[1]);
  });

  const m4 = new THREE.Matrix4();
  /** Place instance `i`: at (x, y), turned `angle`, scaled `size` (0 hides it). */
  const put = (mesh: THREE_NS.InstancedMesh, i: number, x: number, y: number, angle: number, size: number, stretch = 1) => {
    const c = Math.cos(angle) * size;
    const s = Math.sin(angle) * size;
    m4.set(c * stretch, -s, 0, x, s * stretch, c, 0, y, 0, 0, 1, 0, 0, 0, 0, 1);
    mesh.setMatrixAt(i, m4);
  };
  /** Write stem `s`'s ribbon from its centre points and half-widths. */
  const ribbonAt = (s: number, pts: { x: number; y: number }[], half: (u: number) => number) => {
    for (let k = 0; k < K; k++) {
      const a = pts[Math.max(0, k - 1)];
      const b = pts[Math.min(K - 1, k + 1)];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const n = Math.hypot(dx, dy) || 1;
      const w = half(k / (K - 1));
      const v = (s * K + k) * 2 * 3;
      pos[v] = pts[k].x - (dy / n) * w;
      pos[v + 1] = pts[k].y + (dx / n) * w;
      pos[v + 3] = pts[k].x + (dy / n) * w;
      pos[v + 4] = pts[k].y - (dx / n) * w;
    }
  };
  /** A point `u` (0–1) of the way along a list of points, with the direction there. */
  const onPath = (pts: { x: number; y: number }[], u: number) => {
    const f = clamp01(u) * (K - 1);
    const i = Math.min(K - 2, Math.floor(f));
    const r = f - i;
    const [a, b] = [pts[i], pts[i + 1]];
    return { x: a.x + (b.x - a.x) * r, y: a.y + (b.y - a.y) * r, angle: Math.atan2(b.y - a.y, b.x - a.x) };
  };

  const path = Array.from({ length: K }, () => ({ x: 0, y: 0 }));

  const update = (t: number) => {
    const peel = smooth(burst, burst + 0.6, t); // the start word's pieces peel off into tendrils
    const grow = smooth(burst, burst + 1.3, t);
    const retract = smooth(calm, calm + 1.1, t); // gathered into the goal word, and shrinking away
    const unfurl = smooth(burst + 0.2, calm, t);
    const bloom = smooth(burst + 0.6, burst + 1.4, t) * (1 - retract);
    const rest = smooth(settled - 0.4, settled + 0.6, t);
    let li = 0;

    wild.forEach((w, i) => {
      const len = w.reach * grow * (1 - retract) + 1e-4;
      const ax = mix(w.piece[0].x, w.gather.x, retract);
      const ay = mix(w.piece[0].y, w.gather.y, retract);
      // Walk the tendril out from its root: it bends, coils at the tip (a fern's tip unrolls), and sways.
      let h = w.h0;
      let x = ax;
      let y = ay;
      for (let k = 0; k < K; k++) {
        const s = k / (K - 1);
        const tx = mix(w.piece[k].x, x, peel);
        const ty = mix(w.piece[k].y, y, peel);
        path[k].x = tx;
        path[k].y = ty;
        const curl = w.fern ? w.side * (w.bend * 0.6 + 14 * s ** 4 * (1 - unfurl)) : w.side * (w.bend + w.coil * s ** 3);
        const sway = 0.5 * Math.sin(1.6 * t + 2.2 * s + w.phase) * s * (1 - retract);
        h += (curl + sway) / (K - 1);
        x += (Math.cos(h) * len) / (K - 1);
        y += (Math.sin(h) * len) / (K - 1);
      }
      const width = mix(0.068, 0.045, peel);
      ribbonAt(i, path, (u) => width * mix(1, 1 - 0.65 * u, peel));
      // Leaves along the vine: tiny buds while it's still the word, lush once it's wild.
      for (let k = 0; k < 4; k++) {
        const u = 0.22 + 0.2 * k;
        const p = onPath(path, u);
        const side = k % 2 ? -1 : 1;
        const size = mix(0.07, w.leafSizes[k] * grow, peel) * (1 - retract);
        put(leaves, li++, p.x, p.y, p.angle + side * w.leafAngles[k] + 0.15 * Math.sin(2 * t + w.phase + k), size);
      }
      if (w.fern) {
        for (let k = 0; k < 10; k++) {
          const u = 0.1 + 0.08 * k;
          const p = onPath(path, u);
          const size = (0.2 * (1 - u) + 0.05) * grow * (1 - retract) * smooth(0, 0.6, unfurl + 0.3 - u * 0.3);
          put(leaves, li++, p.x, p.y, p.angle + 1.0, size, 0.8);
          put(leaves, li++, p.x, p.y, p.angle - 1.0, size, 0.8);
        }
      }
      const tip = onPath(path, 1);
      const r = w.flower ? w.bloom * bloom : 0;
      for (let k = 0; k < 5; k++) put(petals, i * 5 + k, tip.x, tip.y, w.phase + (k * 2 * Math.PI) / 5 + 0.2 * t, r);
      put(centres, i, tip.x, tip.y, 0, r * 0.32);
    });

    tame.forEach((s, j) => {
      const g = smooth(calm + 0.15 + s.delay, calm + 1.1 + s.delay, t);
      const L = s.line.length;
      const drawn = g * L;
      for (let k = 0; k < K; k++) {
        const q = along(s.line, (drawn * k) / (K - 1));
        path[k].x = q.x;
        path[k].y = q.y;
      }
      // About the game's stroke weight; tapered at the growing tip and a little at real ends.
      ribbonAt(nWild + j, path, (u) => 0.058 * (g < 1 ? mix(1, 0.35, smooth(0.8, 1, u)) : 1) * mix(0.75, 1, smooth(0, 0.05, u * drawn)) * mix(0.75, 1, smooth(0, 0.05, (1 - u) * drawn)));
      for (const leaf of s.leaves) {
        const q = along(s.line, leaf.d);
        const open = smooth(leaf.d, leaf.d + 0.25, drawn);
        const angle = Math.atan2(q.ty, q.tx) + leaf.side * (s.bar ? 1.05 : 0.85) + 0.07 * rest * Math.sin(1.3 * t + leaf.d * 5);
        const size = s.bar ? 0.1 * (1 - 0.35 * Math.abs((2 * leaf.d) / L - 1)) : 0.18;
        put(leaves, li++, q.x, q.y, angle, size * open, s.bar ? 0.85 : 1);
      }
      const tip = along(s.line, s.tipAtEnd ? L : 0);
      const r = 0.15 * smooth(settled - 0.45, settled + 0.15, t) * g;
      for (let k = 0; k < 5; k++) put(petals, (nWild + j) * 5 + k, tip.x, tip.y, (k * 2 * Math.PI) / 5 + 0.1 * Math.sin(t), r);
      put(centres, nWild + j, tip.x, tip.y, 0, r * 0.34);
    });

    ribbon.attributes.position.needsUpdate = true;
    for (const m of [leaves, petals, centres]) m.instanceMatrix.needsUpdate = true;
  };

  update(0);
  for (const m of [leaves, petals, centres]) if (m.instanceColor) m.instanceColor.needsUpdate = true;

  return {
    objects: meshes,
    /** How far the growth reaches beyond the words (in word units), for framing. */
    margin: 1.2,
    update,
    dispose: () => {
      for (const m of meshes) {
        m.geometry.dispose();
        (m.material as THREE_NS.Material).dispose();
      }
    },
  };
}

// Daily #1, PINK → DUNE: "Windswept!"
//
// PINK is drawn in pink sand. A desert wind sweeps in from the left and strips the letters away,
// grain by grain, into a swirling cloud that turns the colour of sand as it flies. The grains
// come down, stroke by stroke, where the wind piles them: ridges that spell DUNE, each with a
// sunlit side and a shadowed one, like a real dune's crest.
//
// Everything is a function of time `t` (seconds), worked out afresh for each frame, so any moment
// can be drawn on its own (for stills and previews).

import type * as THREE_NS from 'three';
import { seededRandom } from '../../maze';
import { along, clamp01, mix, smooth, toLine, type Line } from '../../celebration/kit';
import type { CelebrationTheme, Scene, SceneOptions, Three } from '../../celebration/scene';
import { wordStrokes } from '../../celebration/wordPoints';

export const theme: CelebrationTheme = {
  title: 'Windswept!',
  stormBg: '#3a1c2a',
  timing: { burst: 0.5, calm: 2.2, settled: 3.9 },
};

const COLORS = {
  pinks: ['#ff6f9f', '#f78fb3', '#ec5f8f', '#ff9ec4', '#e8679a'],
  // Mid-tone ochres: at least 3:1 against both the light and the dark page.
  sands: ['#b97a3e', '#a96b35', '#c4884a', '#92582b', '#b5713a'],
  // A pink fleck or two stays in the sand.
  fleck: '#d0607e',
  lit: '#b97a3e',
  shade: '#8f5629',
  wind: '#ffe3ec',
};

/** Points along each ribbon, and half a stroke's width. */
const K = 32;
const HALF = 0.06;
/** Where the light comes from (up and to the left): the side of a ridge facing it is lit. */
const SUN = { x: -0.6, y: 0.8 };

const easeInOut = (p: number) => p * p * (3 - 2 * p);

export function scene(THREE: Three, { start, goal, theme, small }: SceneOptions): Scene {
  const { burst, calm, settled } = theme.timing;
  const random = seededRandom(61);
  const pick = <T,>(xs: T[]) => xs[Math.floor(random() * xs.length)];
  const color = (hex: string) => new THREE.Color(hex);

  const startLines = wordStrokes(start).map((s) => toLine(s.pts));
  const goalLines = wordStrokes(goal).map((s) => toLine(s.pts));
  /** Strokes further right go later: the wind sweeps from the left. */
  const delays = (lines: Line[], spread: number) => {
    const xs = lines.map((l) => Math.min(...l.pts.map((p) => p[0])));
    const [lo, hi] = [Math.min(...xs), Math.max(...xs)];
    return xs.map((x) => spread * ((x - lo) / (hi - lo || 1)));
  };
  const startDelay = delays(startLines, 0.35);
  const goalDelay = delays(goalLines, 0.35);
  /** When the wind has stripped a start stroke up to `u` (0–1 along it), and when a goal stroke has filled to `u`. */
  const strippedAt = (s: number, u: number) => burst + startDelay[s] + 0.6 * u;
  const filledAt = (g: number, u: number) => calm + goalDelay[g] + 1.0 * u;

  // ---------- Ribbons: PINK, worn away; DUNE, built up ----------
  const makeRibbons = (n: number) => {
    const verts = n * K * 4;
    const pos = new Float32Array(verts * 3);
    const col = new Float32Array(verts * 3);
    const index: number[] = [];
    for (let s = 0; s < n; s++)
      for (let k = 0; k < K - 1; k++) {
        const v = (s * K + k) * 4;
        // Two strips: the near half (left edge to centre) and the far half (centre to right edge).
        index.push(v, v + 1, v + 4, v + 1, v + 5, v + 4, v + 2, v + 3, v + 6, v + 3, v + 7, v + 6);
      }
    const geometry = new THREE.BufferGeometry();
    geometry.setIndex(index);
    geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, depthTest: false, depthWrite: false }));
    mesh.frustumCulled = false;
    return { mesh, pos, col };
  };
  const pinkRibbons = makeRibbons(startLines.length);
  const duneRibbons = makeRibbons(goalLines.length);
  const pinkColors = startLines.map(() => color(pick(COLORS.pinks)));
  const lit = color(COLORS.lit);
  const shade = color(COLORS.shade);

  const pts = Array.from({ length: K }, () => ({ x: 0, y: 0 }));
  /** Write ribbon `s` along `pts`: half-width `half(u)`, the side facing the sun in `a`, the other in `b`. */
  const writeRibbon = (r: { pos: Float32Array; col: Float32Array }, s: number, half: (u: number) => number, a: THREE_NS.Color, b: THREE_NS.Color) => {
    for (let k = 0; k < K; k++) {
      const p = pts[Math.max(0, k - 1)];
      const q = pts[Math.min(K - 1, k + 1)];
      const len = Math.hypot(q.x - p.x, q.y - p.y) || 1;
      let nx = -(q.y - p.y) / len;
      let ny = (q.x - p.x) / len;
      // The first two vertices are the sunlit side.
      if (nx * SUN.x + ny * SUN.y < 0) [nx, ny] = [-nx, -ny];
      const w = half(k / (K - 1));
      const { x, y } = pts[k];
      const v = (s * K + k) * 4;
      const set = (i: number, px: number, py: number, c: THREE_NS.Color) => {
        r.pos[(v + i) * 3] = px;
        r.pos[(v + i) * 3 + 1] = py;
        r.col.set([c.r, c.g, c.b], (v + i) * 3);
      };
      set(0, x + nx * w, y + ny * w, a);
      set(1, x, y, a);
      set(2, x, y, b);
      set(3, x - nx * w, y - ny * w, b);
    }
  };
  const span = (line: Line, from: number, to: number) => {
    for (let k = 0; k < K; k++) {
      const q = along(line, line.length * mix(from, to, k / (K - 1)));
      pts[k].x = q.x;
      pts[k].y = q.y;
    }
  };

  // ---------- Sand grains ----------
  const GRAINS = small ? 1500 : 2600;
  const byLength = (lines: Line[]) => {
    const total = lines.reduce((t, l) => t + l.length, 0);
    return () => {
      let r = random() * total;
      for (let i = 0; i < lines.length; i++) if ((r -= lines[i].length) <= 0) return i;
      return lines.length - 1;
    };
  };
  const startStroke = byLength(startLines);
  const goalStroke = byLength(goalLines);
  const across = (line: Line, u: number, spread: number) => {
    const q = along(line, line.length * u);
    const off = (random() - 0.5) * spread;
    return { x: q.x - q.ty * off, y: q.y + q.tx * off };
  };
  const grains = Array.from({ length: GRAINS }, () => {
    const s = startStroke();
    const uo = random();
    const g = goalStroke();
    const ut = random();
    const from = across(startLines[s], uo, 2 * HALF);
    const to = across(goalLines[g], ut, 1.7 * HALF);
    const lift = strippedAt(s, uo) + 0.05 * random();
    const land = Math.min(settled - 0.15, filledAt(g, ut) + 0.1 * random());
    const r1 = random();
    const r2 = random();
    return {
      from,
      to,
      lift,
      land,
      // Blown up and away to the right, then down onto its ridge from upwind.
      c1: { x: from.x + 1.6 + 1.6 * r1, y: from.y + 0.9 + 1.0 * r2 },
      c2: { x: to.x - 1.4 - 1.2 * r2, y: to.y + 1.1 + 0.9 * r1 },
      swirl: 0.25 + 0.45 * random(),
      rate: 5 + 6 * random(),
      phase: random() * 6.28,
      size: 0.028 + 0.03 * random(),
      pink: color(pick(COLORS.pinks)),
      sand: random() < 0.08 ? color(COLORS.fleck) : color(pick(COLORS.sands)),
    };
  });
  const grainMesh = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 6), new THREE.MeshBasicMaterial({ depthTest: false, depthWrite: false }), GRAINS);
  grainMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  grainMesh.setColorAt(0, new THREE.Color());
  grainMesh.instanceColor!.setUsage(THREE.DynamicDrawUsage);
  grainMesh.frustumCulled = false;

  // ---------- Wind: faint streaks racing across while the storm blows ----------
  const STREAKS = small ? 18 : 30;
  const reach = 7;
  const streaks = Array.from({ length: STREAKS }, () => ({
    y: (random() * 2 - 1) * 2.2,
    speed: 6 + 4 * random(),
    length: 0.6 + 0.8 * random(),
    phase: random() * 2 * reach,
  }));
  const streakMesh = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ color: COLORS.wind, transparent: true, opacity: 0.4, depthTest: false, depthWrite: false }),
    STREAKS,
  );
  streakMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  streakMesh.frustumCulled = false;

  const meshes = [streakMesh, pinkRibbons.mesh, duneRibbons.mesh, grainMesh];
  meshes.forEach((m, i) => (m.renderOrder = i));

  const m4 = new THREE.Matrix4();
  const tint = new THREE.Color();

  const update = (t: number) => {
    // PINK wears away from the left of each stroke as the wind strips it.
    let anyPink = false;
    startLines.forEach((line, s) => {
      const gone = clamp01((t - burst - startDelay[s]) / 0.6);
      if (gone < 1) anyPink = true;
      span(line, gone, 1);
      writeRibbon(pinkRibbons, s, () => HALF, pinkColors[s], pinkColors[s]);
    });
    pinkRibbons.mesh.visible = anyPink;

    // DUNE builds up along each stroke as its sand lands, tapering at the growing end.
    let anyDune = false;
    goalLines.forEach((line, g) => {
      const built = clamp01((t - calm - goalDelay[g]) / 1.0);
      if (built > 0) anyDune = true;
      span(line, 0, built);
      writeRibbon(duneRibbons, g, (u) => HALF * (built < 1 ? mix(1, 0.3, smooth(0.75, 1, u)) : 1), lit, shade);
    });
    duneRibbons.mesh.visible = anyDune;

    // Grains: hidden in PINK until the wind lifts them, then blown along a swirling arc onto DUNE.
    grains.forEach((gr, i) => {
      let x = gr.from.x;
      let y = gr.from.y;
      let size = 0;
      let k = 0;
      if (t >= gr.lift) {
        const p = clamp01((t - gr.lift) / (gr.land - gr.lift));
        const e = easeInOut(p);
        const a = 1 - e;
        x = a * a * a * gr.from.x + 3 * a * a * e * gr.c1.x + 3 * a * e * e * gr.c2.x + e * e * e * gr.to.x;
        y = a * a * a * gr.from.y + 3 * a * a * e * gr.c1.y + 3 * a * e * e * gr.c2.y + e * e * e * gr.to.y;
        const flutter = 4 * p * (1 - p) * gr.swirl;
        x += flutter * Math.cos(gr.rate * t + gr.phase);
        y += flutter * Math.sin(gr.rate * 0.8 * t + gr.phase);
        size = gr.size * (p < 1 ? 0.85 : 1);
        k = smooth(0.25, 0.9, p);
      }
      m4.makeScale(size, size, 1).setPosition(x, y, 0);
      grainMesh.setMatrixAt(i, m4);
      grainMesh.setColorAt(i, tint.copy(gr.pink).lerp(gr.sand, k));
    });

    // The wind, blowing hardest between the burst and the calm.
    const blow = smooth(burst, burst + 0.3, t) * (1 - smooth(calm, calm + 0.8, t));
    streaks.forEach((st, j) => {
      const run = (st.speed * t + st.phase) % (2 * reach);
      const edge = Math.sin((Math.PI * run) / (2 * reach));
      const len = st.length * blow * edge;
      if (len < 1e-3) m4.makeScale(0, 0, 0);
      else m4.makeScale(len, 0.022, 1).setPosition(run - reach, st.y, 0);
      streakMesh.setMatrixAt(j, m4);
    });

    for (const r of [pinkRibbons, duneRibbons]) {
      r.mesh.geometry.attributes.position.needsUpdate = true;
      r.mesh.geometry.attributes.color.needsUpdate = true;
    }
    grainMesh.instanceMatrix.needsUpdate = true;
    grainMesh.instanceColor!.needsUpdate = true;
    streakMesh.instanceMatrix.needsUpdate = true;
  };

  update(0);

  return {
    objects: meshes,
    /** How far the blown sand reaches beyond the words (in word units), for framing. */
    margin: 1.4,
    update,
    dispose: () => {
      for (const m of meshes) {
        m.geometry.dispose();
        (m.material as THREE_NS.Material).dispose();
      }
    },
  };
}

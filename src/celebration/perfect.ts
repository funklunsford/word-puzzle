// The Perfect encore, for a puzzle solved in the lowest possible strokes. The goal word turns to
// gold, its strokes scatter into a swirl, and they come together to spell PERFECT, with a shine
// across the word and sparkles around it. Then the strokes re-form, stroke by stroke, into the word
// in other languages, round and round until the player carries on.
//
// Like every celebration scene, it's a function of time: update(u) draws the moment `u` seconds
// into the encore, the same whatever was drawn before.

import type * as THREE_NS from 'three';
import type { Pt } from '../ink';
import { seededRandom } from '../maze';
import { along, clamp01, mix, smooth, toLine } from './kit';
import type { Scene, Three } from './scene';
import { wordStrokes, wordWidth } from './wordPoints';

/** "Perfect" in languages that spell it in plain A–Z, each named in its own language. */
export const PERFECT_WORDS = [
  { word: 'PERFECT', language: 'English' },
  { word: 'PARFAIT', language: 'Français' },
  { word: 'PERFECTO', language: 'Español' },
  { word: 'PERFETTO', language: 'Italiano' },
  { word: 'PERFEKT', language: 'Deutsch' },
  { word: 'PERFEITO', language: 'Português' },
  { word: 'SEMPURNA', language: 'Bahasa Indonesia' },
  { word: 'KAMILI', language: 'Kiswahili' },
  { word: 'PERPEKTO', language: 'Tagalog' },
  { word: 'FOIRFE', language: 'Gaeilge' },
];

/** Seconds into the encore when PERFECT has formed. Each word then shows for PERIOD, the last MORPH of it spent re-forming into the next. */
export const FORMED = 1.7;
export const PERIOD = 2.4;
const MORPH = 1.0;
/** The frame for players who ask for less motion: PERFECT, formed and still. */
export const PERFECT_STILL = FORMED + 1.2;
/** The widest word, so the framing never changes between languages. */
export const PERFECT_SPAN = Math.max(...PERFECT_WORDS.map((w) => wordWidth(w.word)));
/** How far the swirl and sparkles reach beyond the words (word units). */
const MARGIN = 0.9;

/** The word on show `u` seconds in (its index in PERFECT_WORDS), or -1 while PERFECT is still gathering. */
export function wordAt(u: number): number {
  if (u < FORMED - MORPH / 2) return -1;
  return Math.floor((u - FORMED + MORPH / 2) / PERIOD) % PERFECT_WORDS.length;
}

/** When word number `k` (counting from PERFECT, round and round) has formed. */
const lockOf = (k: number) => FORMED + k * PERIOD;

// ---------- Strokes as shapes ----------

/** Points along a stroke's centre line, and in each round end. */
const B = 22;
const CAP = 3;
const M = B + 2 * CAP;
/** Strokes that can be on screen at once (a word's, plus those leaving or arriving). */
const SLOTS = 48;
/** Half the pen width, in word units: bolder on a phone, where the words are drawn smaller. */
const PEN = { wide: 0.085, small: 0.105 };

/** A stroke: where its centre is, and its centre line (B points) around that centre. */
interface Shape {
  x: number;
  y: number;
  pts: Pt[];
}

function shapeOf(line: Pt[]): Shape {
  const l = toLine(line);
  const pts: Pt[] = Array.from({ length: B }, (_, i) => {
    const q = along(l, (l.length * i) / (B - 1));
    return [q.x, q.y];
  });
  const x = pts.reduce((t, p) => t + p[0], 0) / B;
  const y = pts.reduce((t, p) => t + p[1], 0) / B;
  return { x, y, pts: pts.map(([px, py]): Pt => [px - x, py - y]) };
}

const strokesOf = (word: string) => wordStrokes(word).map((s) => ({ tile: s.tile, shape: shapeOf(s.pts) }));
type Stroke = ReturnType<typeof strokesOf>[number];

/**
 * Turn `b`'s points to line up with `a`'s: the angle that best turns `a` onto `b`, and `b` in the
 * order (as drawn, or reversed) that fits best. Morphing then turns the stroke rather than folding it.
 */
function align(a: Pt[], b: Pt[]): { pts: Pt[]; angle: number } {
  let best = { pts: b, angle: 0, err: Infinity };
  for (const pts of [b, [...b].reverse()]) {
    let dot = 0;
    let cross = 0;
    for (let i = 0; i < B; i++) {
      dot += a[i][0] * pts[i][0] + a[i][1] * pts[i][1];
      cross += a[i][0] * pts[i][1] - a[i][1] * pts[i][0];
    }
    const angle = Math.atan2(cross, dot);
    const [c, s] = [Math.cos(angle), Math.sin(angle)];
    let err = 0;
    for (let i = 0; i < B; i++) err += (a[i][0] * c - a[i][1] * s - pts[i][0]) ** 2 + (a[i][0] * s + a[i][1] * c - pts[i][1]) ** 2;
    if (err < best.err) best = { pts, angle, err };
  }
  return best;
}

/**
 * Pair the strokes of one word with the next's: each kind of stroke with the same kind, in order
 * from left to right, choosing which to leave out (when one word has more) to keep the moves short.
 */
function pairUp(from: Stroke[], to: Stroke[]): [Stroke | null, Stroke | null][] {
  const pairs: [Stroke | null, Stroke | null][] = [];
  const tiles = [...new Set([...from, ...to].map((s) => s.tile))];
  const cost = (a: Stroke, b: Stroke) => Math.abs(a.shape.x - b.shape.x) + 0.5 * Math.abs(a.shape.y - b.shape.y);
  for (const tile of tiles) {
    const a = from.filter((s) => s.tile === tile).sort((p, q) => p.shape.x - q.shape.x);
    const b = to.filter((s) => s.tile === tile).sort((p, q) => p.shape.x - q.shape.x);
    const flip = a.length > b.length;
    const [short, long] = flip ? [b, a] : [a, b];
    // dp[i][j]: the cheapest way to pair the first i short strokes with i of the first j long ones.
    const dp = Array.from({ length: short.length + 1 }, (_, i) => Array.from({ length: long.length + 1 }, (_, j) => (i === 0 ? 0 : j < i ? Infinity : 0)));
    for (let i = 1; i <= short.length; i++)
      for (let j = i; j <= long.length; j++) dp[i][j] = Math.min(j > i ? dp[i][j - 1] : Infinity, dp[i - 1][j - 1] + cost(short[i - 1], long[j - 1]));
    const used = new Set<number>();
    for (let i = short.length, j = long.length; i > 0; j--) {
      if (j > i && dp[i][j] === dp[i][j - 1]) continue;
      used.add(j - 1);
      pairs.push(flip ? [long[j - 1], short[i - 1]] : [short[i - 1], long[j - 1]]);
      i--;
    }
    long.forEach((s, j) => !used.has(j) && pairs.push(flip ? [s, null] : [null, s]));
  }
  return pairs;
}

/** One stroke's journey in a change of word: from a stroke of the old word, to one of the new, or both. */
interface Track {
  from: Shape | null;
  to: Shape | null;
  /** `to`'s points, lined up with `from`'s, and the turn between them. */
  toPts: Pt[];
  turn: number;
  /** When it sets off (seconds into the change), how far its path bows, and how much it spins. */
  delay: number;
  bow: number;
  spin: number;
  /** Where a stroke that arrives comes from, or one that leaves goes. */
  away: { x: number; y: number };
  /** In the opening gather: its place in the swirl. */
  swirl: { angle: number; rx: number; ry: number };
}

const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2);

/** A point along a bowed path from a to b. */
function bowed(a: { x: number; y: number }, b: { x: number; y: number }, bow: number, e: number) {
  const mx = (a.x + b.x) / 2 - (b.y - a.y) * bow * 0.25;
  const my = (a.y + b.y) / 2 + (b.x - a.x) * bow * 0.25;
  const k = 1 - e;
  return { x: k * k * a.x + 2 * k * e * mx + e * e * b.x, y: k * k * a.y + 2 * k * e * my + e * e * b.y };
}

// ---------- The scene ----------

const COLORS = {
  deep: '#8a5a0c',
  gold: '#e0a83a',
  light: '#ffe6a0',
  shine: '#fffbf0',
  sparkles: ['#fff6dc', '#ffe08a', '#ffd06b', '#fff0c4'],
};

// The swirl spins this fast (radians a second) while the strokes gather.
const SWIRL_SPIN = 0.9;
// The gather: scatter out from the goal word, then each stroke flies in.
const SCATTER = [0.2, 0.75] as const;
const GATHER_IN = 0.8;
const FLY = 0.6;
/** How long a change of word takes for one stroke, after its delay. */
const HOP = MORPH - 0.3;

export function perfectScene(THREE: Three, { goal, small }: { goal: string; small: boolean }): Scene & { margin: number } {
  const random = seededRandom(31);
  const HALF = small ? PEN.small : PEN.wide;
  const n = PERFECT_WORDS.length;
  const words = PERFECT_WORDS.map((w) => strokesOf(w.word));
  const half = PERFECT_SPAN / 2;

  /** Build the tracks for a change from one word's strokes to another's. */
  const tracksFor = (from: Stroke[], to: Stroke[], gather: boolean): Track[] =>
    pairUp(from, to).map(([a, b], i) => {
      const lined = a && b ? align(a.shape.pts, b.shape.pts) : { pts: b?.shape.pts ?? [], angle: 0 };
      const at = (b ?? a)!.shape;
      // Left to right: strokes set off in a wave across the word.
      const delay = 0.3 * clamp01((at.x + half) / PERFECT_SPAN);
      const out = Math.atan2(at.y * 2.5, at.x) + (random() - 0.5) * 1.4;
      const reach = 2.2 + 1.6 * random();
      return {
        from: a?.shape ?? null,
        to: b?.shape ?? null,
        toPts: lined.pts,
        turn: lined.angle,
        delay,
        bow: (i % 2 ? 1 : -1) * (0.6 + 0.8 * random()),
        spin: (random() - 0.5) * (gather ? 5 : 2.4),
        away: { x: at.x + Math.cos(out) * reach, y: at.y + Math.sin(out) * reach * 0.6 },
        swirl: { angle: random() * Math.PI * 2, rx: (0.5 + 0.45 * random()) * half * 0.85, ry: 1.2 + 0.8 * random() },
      };
    });
  const gather = tracksFor(strokesOf(goal), words[0], true);
  // Into word j (1..n): from word j-1; j = n comes back round to PERFECT.
  const changes = Array.from({ length: n + 1 }, (_, j) => (j === 0 ? gather : tracksFor(words[j - 1], words[j % n], false)));

  // ---------- Stroke ribbons ----------
  const verts = SLOTS * M * 2;
  const pos = new Float32Array(verts * 3);
  const alpha = new Float32Array(verts);
  const across = new Float32Array(verts).map((_, v) => (v % 2 ? 1 : -1));
  const index: number[] = [];
  for (let s = 0; s < SLOTS; s++)
    for (let k = 0; k < M - 1; k++) {
      const v = (s * M + k) * 2;
      index.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
    }
  const ribbons = new THREE.BufferGeometry();
  ribbons.setIndex(index);
  ribbons.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  ribbons.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
  ribbons.setAttribute('aAcross', new THREE.BufferAttribute(across, 1));
  const gold = new THREE.ShaderMaterial({
    uniforms: {
      uDeep: { value: new THREE.Color(COLORS.deep) },
      uGold: { value: new THREE.Color(COLORS.gold) },
      uLight: { value: new THREE.Color(COLORS.light) },
      uShine: { value: new THREE.Color(COLORS.shine) },
      uSweep: { value: -1e4 },
    },
    vertexShader: /* glsl */ `
      attribute float aAlpha;
      attribute float aAcross;
      varying float vAlpha;
      varying float vAcross;
      varying vec2 vAt;
      void main() {
        vAlpha = aAlpha;
        vAcross = aAcross;
        vAt = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uDeep;
      uniform vec3 uGold;
      uniform vec3 uLight;
      uniform vec3 uShine;
      uniform float uSweep;
      varying float vAlpha;
      varying float vAcross;
      varying vec2 vAt;
      void main() {
        // A gold rod: deep at its edges, bright along its middle, brighter towards the top.
        float c = 1.0 - abs(vAcross);
        vec3 col = mix(uDeep, uGold, smoothstep(0.0, 0.6, c));
        col = mix(col, uLight, smoothstep(0.45, 1.0, c) * (0.5 + 0.2 * clamp(vAt.y, -1.0, 1.0)));
        // The shine: a slanted band of light that sweeps across a word as it forms.
        float band = exp(-pow((vAt.x + 0.5 * vAt.y - uSweep) / 0.5, 2.0));
        col = mix(col, uShine, band * (0.45 + 0.55 * c));
        gl_FragColor = vec4(col, vAlpha);
        #include <colorspace_fragment>
      }`,
    transparent: true,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false,
  });
  const strokes = new THREE.Mesh(ribbons, gold);

  // ---------- Sparkles: four-pointed stars, added light ----------
  const AMBIENT = small ? 16 : 26;
  const BURST = small ? 22 : 36;
  const GLINTS = 3;
  const TRAIL = 2;
  const sparkleCount = AMBIENT + BURST + GLINTS + SLOTS * TRAIL;
  const star = new THREE.PlaneGeometry(2, 2);
  const starMaterial = new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vColor;
      void main() {
        vUv = position.xy;
        vColor = instanceColor;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vColor;
      void main() {
        float r = length(vUv);
        float rays = max(0.0, 1.0 - abs(vUv.x * vUv.y) * 22.0) * max(0.0, 1.0 - r);
        float glow = exp(-r * r * 14.0);
        gl_FragColor = vec4(vColor * clamp(rays * rays + glow, 0.0, 1.0), 1.0);
        #include <colorspace_fragment>
      }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
  });
  const sparkles = new THREE.InstancedMesh(star, starMaterial, sparkleCount);
  sparkles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  sparkles.setColorAt(0, new THREE.Color());
  sparkles.instanceColor!.setUsage(THREE.DynamicDrawUsage);
  const meshes = [strokes, sparkles];
  meshes.forEach((m, i) => {
    m.frustumCulled = false;
    m.renderOrder = i;
  });

  const sparkleColors = COLORS.sparkles.map((c) => new THREE.Color(c));
  const ambient = Array.from({ length: AMBIENT }, () => {
    const around = random() < 0.7;
    const x = (random() * 2 - 1) * (half + 0.6);
    const y = around ? (random() < 0.5 ? -1 : 1) * (1.25 + random() * 0.9) : (random() * 2 - 1) * 1.1;
    return { x, y, size: 0.1 + 0.18 * random(), rate: 1.4 + 1.6 * random(), phase: random() * 6.28, color: sparkleColors[Math.floor(random() * 4)] };
  });
  // Bursts as each word forms: sparkles fly off points along its strokes.
  const bursts = words.map((ws) =>
    Array.from({ length: BURST }, (_, j) => {
      const s = ws[j % ws.length].shape;
      const p = s.pts[Math.floor(random() * B)];
      const out = Math.atan2((s.y + p[1]) * 2, s.x + p[0]) + (random() - 0.5) * 1.6;
      const speed = 0.7 + 1.5 * random();
      return { x: s.x + p[0], y: s.y + p[1], dx: Math.cos(out) * speed, dy: Math.sin(out) * speed * 0.7, size: 0.1 + 0.16 * random(), life: 0.6 + 0.5 * random(), color: sparkleColors[Math.floor(random() * 4)] };
    }),
  );
  // Glints where the shine passes the top of a stroke.
  const glints = words.map((ws) =>
    [...ws]
      .map((st) => st.shape)
      .sort((a, b) => b.y + Math.max(...b.pts.map((p) => p[1])) - (a.y + Math.max(...a.pts.map((p) => p[1]))))
      .filter((_, i) => i % 3 === 0)
      .slice(0, GLINTS)
      .map((s) => {
        const top = s.pts.reduce((m, p) => (p[1] > m[1] ? p : m));
        return { x: s.x + top[0], y: s.y + top[1] };
      }),
  );

  // ---------- Drawing ----------
  const m4 = new THREE.Matrix4();
  const tint = new THREE.Color();
  let next = 0;
  const sparkle = (x: number, y: number, size: number, angle: number, glow: number, color: THREE_NS.Color) => {
    if (next >= sparkleCount || glow <= 0.002 || size <= 0) return;
    const c = Math.cos(angle) * size;
    const s = Math.sin(angle) * size;
    m4.set(c, -s, 0, x, s, c, 0, y, 0, 0, 1, 0, 0, 0, 0, 1);
    sparkles.setMatrixAt(next, m4);
    sparkles.setColorAt(next++, tint.copy(color).multiplyScalar(clamp01(glow)));
  };

  const line = Array.from({ length: M }, () => ({ x: 0, y: 0, w: 0 }));
  /** Write slot `slot`'s ribbon: a stroke's centre-line points (already placed), with round ends. */
  const ribbon = (slot: number, body: { x: number; y: number }[], a: number) => {
    const [p0, p1, q1, q0] = [body[0], body[1], body[B - 2], body[B - 1]];
    const n0 = Math.hypot(p1.x - p0.x, p1.y - p0.y) || 1;
    const n1 = Math.hypot(q0.x - q1.x, q0.y - q1.y) || 1;
    const set = (k: number, x: number, y: number, w: number) => {
      line[k].x = x;
      line[k].y = y;
      line[k].w = w;
    };
    for (let j = 0; j < CAP; j++) {
      const d = HALF * (1 - j / CAP);
      set(j, p0.x - ((p1.x - p0.x) / n0) * d, p0.y - ((p1.y - p0.y) / n0) * d, HALF * Math.sqrt(1 - (d / HALF) ** 2));
      const e = HALF * ((j + 1) / CAP);
      set(CAP + B + j, q0.x + ((q0.x - q1.x) / n1) * e, q0.y + ((q0.y - q1.y) / n1) * e, HALF * Math.sqrt(Math.max(0, 1 - (e / HALF) ** 2)));
    }
    for (let i = 0; i < B; i++) set(CAP + i, body[i].x, body[i].y, HALF);
    for (let k = 0; k < M; k++) {
      const a0 = line[Math.max(0, k - 1)];
      const b0 = line[Math.min(M - 1, k + 1)];
      const dx = b0.x - a0.x;
      const dy = b0.y - a0.y;
      const len = Math.hypot(dx, dy) || 1;
      const v = (slot * M + k) * 2;
      const { x, y, w } = line[k];
      pos[v * 3] = x - (dy / len) * w;
      pos[v * 3 + 1] = y + (dx / len) * w;
      pos[v * 3 + 3] = x + (dy / len) * w;
      pos[v * 3 + 4] = y - (dx / len) * w;
      alpha[v] = a;
      alpha[v + 1] = a;
    }
  };

  /** Where a track's stroke is `local` seconds into its change: centre, turn, morph, size and opacity. */
  const pose = (tr: Track, local: number, isGather: boolean) => {
    if (isGather) {
      const swirlAt = (time: number) => {
        const a = tr.swirl.angle + SWIRL_SPIN * time;
        return { x: tr.swirl.rx * Math.cos(a), y: tr.swirl.ry * Math.sin(a) };
      };
      const setOff = GATHER_IN + tr.delay;
      const landed = setOff + FLY;
      const out = easeInOut(clamp01((local - SCATTER[0]) / (SCATTER[1] - SCATTER[0])));
      const pIn = clamp01((local - setOff) / FLY);
      const inE = easeInOut(pIn);
      let at: { x: number; y: number };
      if (local < setOff) {
        const s = swirlAt(local);
        at = tr.from ? { x: mix(tr.from.x, s.x, out), y: mix(tr.from.y, s.y, out) } : s;
      } else at = tr.to ? bowed(swirlAt(setOff), tr.to, tr.bow, inE) : swirlAt(local);
      // Spins out into the swirl and back to true as it lands.
      const turnBy = tr.spin * Math.sin(Math.PI * clamp01((local - SCATTER[0]) / (landed - SCATTER[0])));
      const fadeIn = tr.from ? smooth(0, 0.25, local) : smooth(0.35, 0.75, local);
      const fadeOut = tr.to ? 1 : 1 - smooth(setOff, setOff + 0.45, local);
      const size = tr.from ? (tr.to ? 1 : mix(1, 0.3, smooth(setOff, setOff + 0.45, local))) : mix(0.25, 1, smooth(0.35, 0.8, local));
      return { at, turnBy, morph: tr.from && tr.to ? inE : tr.to ? 1 : 0, size, alpha: fadeIn * fadeOut, landed };
    }
    const p = clamp01((local - tr.delay) / HOP);
    const e = easeInOut(p);
    const landed = tr.delay + HOP;
    if (tr.from && tr.to) return { at: bowed(tr.from, tr.to, tr.bow, e), turnBy: 0, morph: e, size: 1, alpha: 1, landed };
    if (tr.from) return { at: bowed(tr.from, tr.away, tr.bow, e), turnBy: tr.spin * e, morph: 0, size: mix(1, 0.35, e), alpha: 1 - smooth(0.15, 0.85, p), landed: Infinity };
    return { at: bowed(tr.away, tr.to!, tr.bow, e), turnBy: tr.spin * (1 - e), morph: 1, size: mix(0.35, 1, e), alpha: smooth(0, 0.5, p), landed };
  };

  const body = Array.from({ length: B }, () => ({ x: 0, y: 0 }));
  const drawTrack = (slot: number, tr: Track, local: number, isGather: boolean) => {
    const q = pose(tr, local, isGather);
    // A little pop as it lands.
    const since = local - q.landed;
    const pop = since > 0 && since < 0.3 ? 1 + 0.1 * Math.sin((Math.PI * since) / 0.3) : 1;
    const size = q.size * pop;
    // Turn `from` part of the way to `to`, and `to` the rest, then blend: the stroke turns as it morphs.
    const a = tr.from?.pts;
    const b = tr.toPts;
    const [ca, sa] = [Math.cos(tr.turn * q.morph + q.turnBy), Math.sin(tr.turn * q.morph + q.turnBy)];
    const [cb, sb] = [Math.cos(-tr.turn * (1 - q.morph) + q.turnBy), Math.sin(-tr.turn * (1 - q.morph) + q.turnBy)];
    for (let i = 0; i < B; i++) {
      let x = 0;
      let y = 0;
      if (a && q.morph < 1) {
        x += (1 - q.morph) * (a[i][0] * ca - a[i][1] * sa);
        y += (1 - q.morph) * (a[i][0] * sa + a[i][1] * ca);
      }
      if (b.length && q.morph > 0) {
        x += q.morph * (b[i][0] * cb - b[i][1] * sb);
        y += q.morph * (b[i][0] * sb + b[i][1] * cb);
      }
      body[i].x = q.at.x + x * size;
      body[i].y = q.at.y + y * size;
    }
    ribbon(slot, body, q.alpha);
    // Sparkles trail a stroke in flight, brighter the faster it goes.
    for (let k = 1; k <= TRAIL; k++) {
      const back = pose(tr, local - 0.05 * k, isGather).at;
      const speed = Math.hypot(q.at.x - back.x, q.at.y - back.y) / (0.05 * k);
      sparkle(back.x, back.y, 0.16 - 0.04 * k, local * 3 + slot, (speed / 9) * q.alpha * (1 - 0.3 * k), sparkleColors[(slot + k) % 4]);
    }
  };

  const update = (u: number) => {
    next = 0;
    // The change under way: the gather into PERFECT, or into word k (round and round).
    let k = u < FORMED ? 0 : Math.floor((u - FORMED) / PERIOD);
    if (u >= lockOf(k + 1) - MORPH) k++;
    const isGather = k === 0;
    const local = isGather ? u : u - (lockOf(k) - MORPH);
    const tracks = changes[isGather ? 0 : ((k - 1) % n) + 1];
    tracks.slice(0, SLOTS).forEach((tr, slot) => drawTrack(slot, tr, local, isGather));
    // Empty the slots not used this frame.
    const used = Math.min(tracks.length, SLOTS) * M * 2;
    alpha.fill(0, used);
    pos.fill(0, used * 3);

    // The latest word to have formed, and how long ago.
    const formed = u < FORMED ? -1 : Math.floor((u - FORMED) / PERIOD);
    const age = formed < 0 ? -1 : u - lockOf(formed);
    const word = formed < 0 ? -1 : formed % n;
    // The shine: across the goal as it turns to gold, then across each word as it forms.
    const sweep = (span: number, t: number) => mix(-span / 2 - 1.5, span / 2 + 1.5, t);
    let shine = -1e4;
    if (u < 0.55) shine = sweep(wordWidth(goal), clamp01((u - 0.05) / 0.5));
    if (age >= 0.05 && age < 0.8) shine = sweep(wordWidth(PERFECT_WORDS[word].word), (age - 0.05) / 0.75);
    gold.uniforms.uSweep.value = shine;

    // Sparkles: a burst as the word forms, glints as the shine passes, and a quiet twinkle all round.
    if (word >= 0) {
      for (const b of bursts[word]) {
        const life = clamp01(age / b.life);
        if (life >= 1) continue;
        const go = 1 - (1 - life) ** 3;
        sparkle(b.x + b.dx * go, b.y + b.dy * go, b.size * (1 - life) ** 1.2 * smooth(0, 0.06, age), age * 2, 1.1 * (1 - life), b.color);
      }
      const span = wordWidth(PERFECT_WORDS[word].word);
      for (const g of glints[word]) {
        const when = 0.05 + (0.75 * (g.x + 0.5 * g.y + span / 2 + 1.5)) / (span + 3);
        const t = (age - when) / 0.4;
        if (t > 0 && t < 1) sparkle(g.x, g.y, 0.55 * Math.sin(Math.PI * t), t * 1.2, 1.2, sparkleColors[0]);
      }
    }
    const calm = smooth(FORMED - 0.4, FORMED + 0.4, u);
    for (const a of ambient) {
      const twinkle = Math.max(0, Math.sin(a.rate * u + a.phase)) ** 6;
      sparkle(a.x, a.y, a.size * (0.4 + 0.6 * twinkle), 0.3 * u + a.phase, calm * (0.25 + 0.75 * twinkle), a.color);
    }
    // Hide the sparkles not used this frame.
    m4.makeScale(0, 0, 0);
    tint.setRGB(0, 0, 0);
    for (let i = next; i < sparkleCount; i++) {
      sparkles.setMatrixAt(i, m4);
      sparkles.setColorAt(i, tint);
    }

    ribbons.attributes.position.needsUpdate = true;
    ribbons.attributes.aAlpha.needsUpdate = true;
    sparkles.instanceMatrix.needsUpdate = true;
    sparkles.instanceColor!.needsUpdate = true;
  };

  update(0);

  return {
    objects: meshes,
    margin: MARGIN,
    update,
    dispose: () => {
      for (const m of meshes) {
        m.geometry.dispose();
        (m.material as THREE_NS.Material).dispose();
      }
    },
  };
}

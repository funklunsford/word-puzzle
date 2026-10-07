// The Perfect burst, for a puzzle solved in the lowest possible strokes: bubbles fizz out of the
// word's own strokes, each in its stroke's colour. They pop out with a springy wobble, float up
// swaying, and pop, with sparkles twinkling round the word. It plays first, and the day's own
// celebration follows as it falls away.
//
// It's drawn over the whole screen, so its coordinates are the screen's: y from -1 (bottom) to 1
// (top), x from -aspect to aspect. The word sits where the day's scene draws it, centred, at `scale`
// screen units per word unit. Like every celebration scene it's a function of time: update(t) draws
// the moment `t` seconds in, the same whatever came before.

import type * as THREE_NS from 'three';
import type { TileId } from '../glyphs';
import { seededRandom } from '../maze';
import { along, clamp01, smooth, toLine } from './kit';
import type { Three } from './scene';
import { wordStrokes } from './wordPoints';

/** Seconds: the bubbles have all popped by `length`; the day's celebration starts at `handoff`. */
export const CONFETTI = { length: 3.2, handoff: 1.7 };

/** How quickly a bubble's burst slows, and how far it is from the word's edge to the screen's (as a share). */
const DRAG = 3.2;
const EDGE = 0.97;

export interface ConfettiScene {
  objects: THREE_NS.Object3D[];
  /** Draw the moment `t`: `aspect` is the screen's width over its height, `scale` its units per word unit. */
  update(t: number, aspect: number, scale: number): void;
  dispose(): void;
}

interface Options {
  small: boolean;
  cssColor: (name: string, fallback: string) => [number, number, number];
  /** The word the bubbles come from: the one on screen as they burst. */
  word: string;
  /** Draw the word too (when there's no day's scene to draw it). */
  showWord?: boolean;
}

export function confettiScene(THREE: Three, { small, cssColor, word, showWord = false }: Options): ConfettiScene {
  const random = seededRandom(83);
  const tileColor = (t: TileId) => new THREE.Color().setRGB(...cssColor(`--t-${t}`, '#e0a83a'), THREE.SRGBColorSpace);
  const hsl = { h: 0, s: 0, l: 0 };
  /** A stroke's colour as a bubble: the same hue, brighter and sweeter, so it shows on any stage. */
  const candy = (c: THREE_NS.Color) => (c.getHSL(hsl), c.setHSL(hsl.h, Math.max(hsl.s, 0.6), 0.64));
  const extras = ['#ffd23f', '#ff7eb0', '#7fdcff'].map((c) => new THREE.Color(c));

  // Where bubbles come from: anywhere along the word's strokes, as much from a long stroke as its length.
  const strokes = wordStrokes(word).map((s) => ({ tile: s.tile, line: toLine(s.pts) }));
  const total = strokes.reduce((a, s) => a + s.line.length, 0);
  const pick = () => {
    let d = random() * total;
    const s = strokes.find((st) => (d -= st.line.length) < 0) ?? strokes[strokes.length - 1];
    return { tile: s.tile, ...along(s.line, s.line.length + d) };
  };

  // ---------- Bubbles: a burst as it starts, then a fizz ----------
  const BUBBLES = small ? 80 : 130;
  const bubbles = Array.from({ length: BUBBLES }, (_, i) => {
    const burst = i < BUBBLES * 0.55;
    const from = pick();
    // Out from the stroke (either side), leaning upwards: bubbles rise.
    const side = random() < 0.5 ? 1 : -1;
    let [dx, dy] = [-from.ty * side, from.tx * side];
    dy += 0.35;
    const n = Math.hypot(dx, dy) || 1;
    [dx, dy] = [dx / n, dy / n];
    const born = burst ? 0.03 + 0.2 * random() : 0.3 + 1.0 * random();
    const life = Math.min(1.0 + 1.0 * random(), CONFETTI.length - 0.15 - born);
    const pastel = random() < 0.8;
    return {
      x: from.x,
      y: from.y,
      dx,
      dy,
      born,
      life,
      speed: burst ? 1.1 + 1.3 * random() : 0.3 + 0.6 * random(),
      rise: 0.16 + 0.24 * random(),
      r: (burst ? 0.024 : 0.018) + 0.04 * random() ** 1.5,
      sway: 0.01 + 0.02 * random(),
      swayRate: 4 + 4 * random(),
      phase: random() * 6.28,
      color: pastel ? candy(tileColor(from.tile)) : extras[Math.floor(random() * extras.length)].clone(),
    };
  });
  const bubbleGeometry = new THREE.PlaneGeometry(2, 2);
  const popAttr = new THREE.InstancedBufferAttribute(new Float32Array(BUBBLES), 1).setUsage(THREE.DynamicDrawUsage);
  bubbleGeometry.setAttribute('aPop', popAttr);
  const bubble = new THREE.InstancedMesh(
    bubbleGeometry,
    new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `
        attribute float aPop;
        varying vec2 vUv;
        varying vec3 vColor;
        varying float vPop;
        void main() {
          vUv = position.xy;
          vColor = instanceColor;
          vPop = aPop;
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        }`,
      // A soap bubble: a clear tinted body, a bright rim, and a highlight up and to the left. Popping,
      // its rim thins and it fades.
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vColor;
        varying float vPop;
        void main() {
          float r = length(vUv);
          float edge = 1.0 - smoothstep(0.95, 1.0, r);
          if (edge <= 0.0) discard;
          float rim = smoothstep(0.66 + 0.26 * vPop, 0.93, r) * edge;
          vec2 h = vUv - vec2(-0.36, 0.38);
          float shine = exp(-dot(h, h) * 22.0) + 0.5 * exp(-dot(vUv - vec2(0.4, -0.42), vUv - vec2(0.4, -0.42)) * 70.0);
          vec3 color = mix(vColor, vec3(1.0), 0.12 * rim + shine);
          float alpha = (0.3 * edge + 0.75 * rim + 0.9 * shine) * (1.0 - vPop);
          gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
          #include <colorspace_fragment>
        }`,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    }),
    BUBBLES,
  );
  bubbles.forEach((b, i) => bubble.setColorAt(i, b.color));
  bubble.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  // ---------- Sparkles: four-pointed stars, twinkling round the word ----------
  const SPARKLES = small ? 18 : 30;
  const sparkles = Array.from({ length: SPARKLES }, () => {
    const from = pick();
    const a = random() * 6.28;
    const d = 0.3 + 0.9 * random();
    return {
      x: from.x + Math.cos(a) * d,
      y: from.y + Math.sin(a) * d,
      at: 0.1 + 2.3 * random(),
      life: 0.35 + 0.4 * random(),
      size: 0.03 + 0.04 * random(),
      turn: random() * 6.28,
      color: new THREE.Color(random() < 0.5 ? '#fff6dc' : '#ffe08a'),
    };
  });
  const star = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
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
    }),
    SPARKLES,
  );
  sparkles.forEach((s, i) => star.setColorAt(i, s.color));
  star.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  // ---------- The word itself, when nothing else draws it: a ribbon per stroke ----------
  const meshes: THREE_NS.Mesh[] = [];
  if (showWord) {
    const positions: number[] = [];
    const colors: number[] = [];
    const index: number[] = [];
    const HALF = 0.06;
    for (const { tile, line } of strokes) {
      const c = tileColor(tile);
      const pts = line.pts;
      const base = positions.length / 3;
      pts.forEach((p, i) => {
        const [a, b] = [pts[Math.max(0, i - 1)], pts[Math.min(pts.length - 1, i + 1)]];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        const [nx, ny] = [-(b[1] - a[1]) / len, (b[0] - a[0]) / len];
        positions.push(p[0] + nx * HALF, p[1] + ny * HALF, 0, p[0] - nx * HALF, p[1] - ny * HALF, 0);
        colors.push(c.r, c.g, c.b, c.r, c.g, c.b);
        if (i) index.push(base + 2 * i - 2, base + 2 * i - 1, base + 2 * i, base + 2 * i - 1, base + 2 * i + 1, base + 2 * i);
      });
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(index);
    meshes.push(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, depthTest: false, depthWrite: false })));
  }
  const wordMesh = meshes[0];
  meshes.push(bubble, star);
  meshes.forEach((m, i) => {
    m.frustumCulled = false;
    m.renderOrder = i;
  });

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const axis = new THREE.Vector3(0, 0, 1);
  const pos = new THREE.Vector3();
  const size = new THREE.Vector3();
  const hide = new THREE.Matrix4().makeScale(0, 0, 0);
  const none = new THREE.Quaternion();

  const update = (t: number, aspect: number, scale: number) => {
    wordMesh?.scale.set(scale, scale, 1);
    // Bubbles past the screen's sides are held at its edge (softly), so they stay on a phone. On a
    // wider screen (a bigger word) they're bigger and fly further, up to 1.6 times a phone's.
    const edge = aspect * EDGE;
    const big = Math.max(1, 1.6 * Math.min(1, aspect));
    const keep = (x: number) => edge * Math.tanh(x / edge);
    bubbles.forEach((b, i) => {
      const s = t - b.born;
      if (s <= 0 || s >= b.life) {
        bubble.setMatrixAt(i, hide);
        popAttr.setX(i, 1);
        return;
      }
      // Burst out, slowed by the water; buoyed up more and more; swaying as it rises.
      const k = (1 - Math.exp(-DRAG * s)) / DRAG;
      const lift = big * b.rise * (s - (1 - Math.exp(-3 * s)) / 3);
      const x = keep(b.x * scale + big * (b.dx * b.speed * k * Math.min(1, aspect) + b.sway * Math.sin(b.swayRate * s + b.phase) * clamp01(s / 0.4)));
      const y = b.y * scale + big * b.dy * b.speed * k + lift;
      // It pops out with a spring (overshooting, then settling), wobbling like jelly; then pops.
      const spring = 1 - Math.exp(-7 * s) * Math.cos(13 * s);
      const jelly = 0.1 * Math.sin(10 * s + b.phase) * Math.exp(-2.5 * s);
      const pop = smooth(b.life - 0.14, b.life, s);
      const r = big * b.r * spring * (1 + 0.4 * pop);
      bubble.setMatrixAt(i, m4.compose(pos.set(x, y, 0), none, size.set(r * (1 + jelly), r * (1 - jelly), 1)));
      popAttr.setX(i, pop);
    });
    sparkles.forEach((sp, i) => {
      const life = (t - sp.at) / sp.life;
      if (life <= 0 || life >= 1) {
        star.setMatrixAt(i, hide);
        return;
      }
      const r = sp.size * Math.sin(Math.PI * life);
      q.setFromAxisAngle(axis, sp.turn + life);
      star.setMatrixAt(i, m4.compose(pos.set(keep(sp.x * scale), sp.y * scale, 0), q, size.set(r, r, 1)));
    });
    bubble.instanceMatrix.needsUpdate = true;
    popAttr.needsUpdate = true;
    star.instanceMatrix.needsUpdate = true;
  };

  update(0, 1, 0.1);
  for (const m of [bubble, star]) if (m.instanceColor) m.instanceColor.needsUpdate = true;

  return {
    objects: meshes,
    update,
    dispose: () => {
      for (const m of meshes) {
        m.geometry.dispose();
        (m.material as THREE_NS.Material).dispose();
      }
    },
  };
}

// The Perfect burst, for a puzzle solved in the lowest possible strokes: confetti pops out of the
// word on the board (the strokes the player just drew), in the strokes' colours, with a ring of light
// as it bursts. Each piece is a scrap of paper turning in 3D: it narrows as it turns edge-on, and
// catches the light as it flips (a glint, and a darker back). Nearer pieces are bigger and fly faster,
// so the burst has depth. It flutters down as sparkles twinkle, and the day's own celebration fades in.
//
// It's drawn over the whole screen on a clear canvas (the page shows through), so its coordinates
// are the screen's: y from -1 (bottom) to 1 (top), x from -aspect to aspect. Like every celebration
// scene it's a function of time: update(t) draws the moment `t` seconds in, the same whatever came before.

import type * as THREE_NS from 'three';
import { seededRandom } from '../maze';
import { clamp01, smooth } from './kit';
import type { Three } from './scene';

/** Seconds: the confetti has all fallen away by `length`; the day's celebration has faded in by `handoff`. */
export const CONFETTI = { length: 3.2, handoff: 1.7 };

/** The air's drag on a piece, gravity, and how close to the screen's sides pieces may go (as a share). */
const DRAG = 3.0;
const GRAVITY = 2.4;
const EDGE = 0.97;

export interface ConfettiScene {
  objects: THREE_NS.Object3D[];
  /** Draw the moment `t`: `aspect` is the screen's width over its height. */
  update(t: number, aspect: number): void;
  dispose(): void;
}

/** A point on a stroke of the word on screen (in the screen's units, as above), and the stroke's colour (sRGB, 0 to 1). */
export interface BurstSource {
  x: number;
  y: number;
  color: [number, number, number];
}

interface Options {
  small: boolean;
  /** Where the confetti comes from: points along the word's strokes. */
  sources: BurstSource[];
}

export function confettiScene(THREE: Three, { small, sources }: Options): ConfettiScene {
  const random = seededRandom(83);
  const hsl = { h: 0, s: 0, l: 0 };
  /** A stroke's colour as paper: the same hue, a little brighter, so it pops. */
  const paper = (c: THREE_NS.Color) => (c.getHSL(hsl, THREE.SRGBColorSpace), c.setHSL(hsl.h, Math.max(hsl.s, 0.6), Math.min(0.64, Math.max(hsl.l, 0.55)), THREE.SRGBColorSpace));
  const extras = ['#ffc21a', '#ff5e8a', '#ffffff', '#4fc3ff'].map((c) => new THREE.Color(c));
  const from = sources.length ? sources : [{ x: 0, y: 0, color: [0.9, 0.6, 0.2] as [number, number, number] }];
  const pick = () => from[Math.floor(random() * from.length)];
  // The word's middle and half-width, for the ring.
  const xs = from.map((q) => q.x);
  const ys = from.map((q) => q.y);
  const mid = { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
  const half = Math.max(0.12, (Math.max(...xs) - Math.min(...xs)) / 2);

  // ---------- Confetti: paper rectangles and dots, turning in 3D ----------
  const PIECES = small ? 150 : 240;
  const pieces = Array.from({ length: PIECES }, (_, i) => {
    const at = pick();
    const first = i < PIECES * 0.7; // the pop itself; the rest follow a moment later
    // Out of the word, mostly upwards (it falls back down), some to the sides.
    const angle = random() < 0.85 ? Math.PI / 2 + (random() - 0.5) * 2.9 : random() * 6.28;
    const speed = first ? 2.6 + 2.8 * random() : 1.4 + 1.6 * random();
    const depth = random() * 2 - 1; // -1 far, 1 near
    const near = 1 + 0.35 * depth;
    const [ax, ay, az] = [random() - 0.5, random() - 0.5, random() - 0.5];
    const an = Math.hypot(ax, ay, az) || 1;
    const dot = random() < 0.18;
    const w = dot ? 0.018 + 0.01 * random() : 0.026 + 0.026 * random();
    return {
      x: at.x,
      y: at.y,
      z: depth,
      near,
      born: first ? 0.06 * random() : 0.12 + 0.3 * random(),
      vx: Math.cos(angle) * speed * near,
      vy: Math.sin(angle) * speed * near,
      axis: new THREE.Vector3(ax / an, ay / an, az / an),
      spin: 5 + 9 * random(),
      phase: random() * 6.28,
      sway: 0.03 + 0.06 * random(),
      swayRate: 4 + 4 * random(),
      w,
      h: dot ? w : w * (0.4 + 0.3 * random()),
      dot,
      color: random() < 0.72 ? paper(new THREE.Color().setRGB(...at.color, THREE.SRGBColorSpace)) : extras[Math.floor(random() * extras.length)].clone(),
    };
  });
  const pieceGeometry = new THREE.PlaneGeometry(1, 1);
  pieceGeometry.setAttribute('aDot', new THREE.InstancedBufferAttribute(new Float32Array(pieces.map((p) => (p.dot ? 1 : 0))), 1));
  const confetti = new THREE.InstancedMesh(
    pieceGeometry,
    new THREE.ShaderMaterial({
      // Paper lit from above and in front: brightest face-on, a darker back, and a glint as it turns
      // through the light. (Dots are squares cut round.)
      vertexShader: /* glsl */ `
        attribute float aDot;
        varying vec2 vUv;
        varying vec3 vColor;
        varying float vLight;
        varying float vGlint;
        varying float vBack;
        varying float vDot;
        void main() {
          vUv = position.xy;
          vColor = instanceColor;
          vDot = aDot;
          vec3 n = normalize(mat3(instanceMatrix) * vec3(0.0, 0.0, 1.0));
          float d = dot(n, normalize(vec3(-0.35, 0.6, 0.72)));
          vLight = 0.62 + 0.38 * abs(d);
          vGlint = pow(abs(d), 30.0);
          vBack = step(d, 0.0);
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vColor;
        varying float vLight;
        varying float vGlint;
        varying float vBack;
        varying float vDot;
        void main() {
          if (vDot > 0.5 && length(vUv) > 0.5) discard;
          vec3 color = vColor * vLight * (1.0 - 0.18 * vBack) + vec3(0.7 * vGlint);
          gl_FragColor = vec4(color, 1.0);
          #include <colorspace_fragment>
        }`,
      side: THREE.DoubleSide,
    }),
    PIECES,
  );
  pieces.forEach((p, i) => confetti.setColorAt(i, p.color));
  confetti.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  // ---------- The pop: a ring of light bursting out round the word ----------
  const ring = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      uniforms: { uLife: { value: 0 } },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = position.xy;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uLife;
        varying vec2 vUv;
        void main() {
          float r = length(vUv);
          float width = mix(0.22, 0.04, uLife);
          float band = 1.0 - smoothstep(0.0, width, abs(r - (1.0 - width)));
          float glow = (1.0 - smoothstep(0.0, 0.9, r)) * 0.35 * (1.0 - uLife);
          gl_FragColor = vec4(vec3(1.0, 0.8, 0.3), clamp(band + glow, 0.0, 1.0) * (1.0 - uLife));
          #include <colorspace_fragment>
        }`,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    }),
  );

  // ---------- Sparkles: four-pointed stars, twinkling round the word and above it ----------
  const SPARKLES = small ? 18 : 30;
  const sparkles = Array.from({ length: SPARKLES }, () => {
    const at = pick();
    const a = random() * 6.28;
    const d = 0.05 + 0.3 * random();
    return {
      x: at.x + Math.cos(a) * d,
      y: at.y + Math.sin(a) * d + 0.2 * random(),
      at: 0.05 + 2.2 * random(),
      life: 0.35 + 0.4 * random(),
      size: 0.03 + 0.04 * random(),
      turn: random() * 6.28,
      color: new THREE.Color(random() < 0.5 ? '#fff6dc' : '#ffd36a'),
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
      // (Its light is its opacity, so it lays over the page; a clear canvas shows where it's dark.)
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vColor;
        void main() {
          float r = length(vUv);
          float rays = max(0.0, 1.0 - abs(vUv.x * vUv.y) * 22.0) * max(0.0, 1.0 - r);
          float glow = exp(-r * r * 14.0);
          gl_FragColor = vec4(vColor, clamp(rays * rays + glow, 0.0, 1.0));
          #include <colorspace_fragment>
        }`,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    }),
    SPARKLES,
  );
  sparkles.forEach((s, i) => star.setColorAt(i, s.color));
  star.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  const meshes = [confetti, ring, star];
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
  const RING = 0.4; // seconds

  const update = (t: number, aspect: number) => {
    // Pieces past the screen's sides are held at its edge (softly), so they stay on a phone. On a
    // wider screen they're bigger and fly further, up to 1.6 times a phone's.
    const edge = aspect * EDGE;
    const keep = (x: number) => edge * Math.tanh(x / edge);
    const big = Math.max(1, 1.6 * Math.min(1, aspect));
    const out = 1 - smooth(CONFETTI.length - 0.6, CONFETTI.length, t);
    pieces.forEach((p, i) => {
      const s = t - p.born;
      if (s <= 0 || out <= 0) {
        confetti.setMatrixAt(i, hide);
        return;
      }
      // Popped out fast, slowed by the air, then falling at its drifting speed, fluttering side to side.
      const k = (1 - Math.exp(-DRAG * s)) / DRAG;
      const fall = (GRAVITY / DRAG) * p.near;
      const x = keep(p.x + big * (p.vx * k + p.sway * Math.sin(p.swayRate * s + p.phase) * clamp01(s / 0.5)));
      const y = p.y + big * ((p.vy + fall) * k - fall * s);
      // It turns about its own axis, fastest as it pops; it springs to full size as it appears.
      q.setFromAxisAngle(p.axis, p.phase + p.spin * s + 5 * k * DRAG);
      const pop = Math.min(1.15, 1 - Math.exp(-14 * s) * Math.cos(16 * s)) * out;
      const scale = big * p.near * pop;
      confetti.setMatrixAt(i, m4.compose(pos.set(x, y, p.z), q, size.set(p.w * scale, p.h * scale, 1)));
    });
    // The ring: out from the word's middle, wider than tall like the word, thinning as it fades.
    const life = t / RING;
    ring.visible = life > 0 && life < 1;
    const grow = 1 - (1 - clamp01(life)) ** 3;
    ring.position.set(mid.x, mid.y, 2);
    ring.scale.set(0.05 + (half * 1.35 + 0.08) * grow, 0.05 + (half * 0.55 + 0.12) * grow, 1);
    (ring.material as THREE_NS.ShaderMaterial).uniforms.uLife.value = clamp01(life);
    sparkles.forEach((sp, i) => {
      const l = (t - sp.at) / sp.life;
      if (l <= 0 || l >= 1) {
        star.setMatrixAt(i, hide);
        return;
      }
      const r = big * sp.size * Math.sin(Math.PI * l);
      q.setFromAxisAngle(axis, sp.turn + l);
      star.setMatrixAt(i, m4.compose(pos.set(keep(sp.x), sp.y, 3), q, size.set(r, r, 1)));
    });
    confetti.instanceMatrix.needsUpdate = true;
    star.instanceMatrix.needsUpdate = true;
  };

  update(0, 1);
  for (const m of [confetti, star]) if (m.instanceColor) m.instanceColor.needsUpdate = true;

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

// The Perfect burst, for a puzzle solved in the lowest possible strokes: confetti fired from both
// bottom corners, tumbling and drifting down, with sparkles twinkling over it. It plays first, and
// the day's own celebration follows as it falls away.
//
// It's drawn over the whole screen, not around the words, so its coordinates are the screen's:
// y from -1 (bottom) to 1 (top), x from -aspect to aspect. Like every celebration scene it's a
// function of time: update(t) draws the moment `t` seconds in, the same whatever came before.

import type * as THREE_NS from 'three';
import { TILE_IDS } from '../glyphs';
import { seededRandom } from '../maze';
import { clamp01, smooth } from './kit';
import type { Three } from './scene';

/** Seconds: the confetti has all fallen away by `length`; the day's celebration starts at `handoff`. */
export const CONFETTI = { length: 3.2, handoff: 1.7 };

const GRAVITY = 2.2;
const DRAG = 1.6;

export interface ConfettiScene {
  objects: THREE_NS.Object3D[];
  update(t: number, aspect: number): void;
  dispose(): void;
}

export function confettiScene(
  THREE: Three,
  { small, cssColor }: { small: boolean; cssColor: (name: string, fallback: string) => [number, number, number] },
): ConfettiScene {
  const random = seededRandom(83);
  const palette = [
    ...TILE_IDS.map((t) => new THREE.Color().setRGB(...cssColor(`--t-${t}`, '#e0a83a'), THREE.SRGBColorSpace)),
    new THREE.Color('#ffd23f'),
    new THREE.Color('#ff5e8a'),
    new THREE.Color('#ffffff'),
  ];

  // ---------- Confetti: little paper rectangles ----------
  const PIECES = small ? 140 : 240;
  const pieces = Array.from({ length: PIECES }, (_, i) => {
    const side = i % 2 ? 1 : -1; // which corner fires it
    const angle = (Math.PI / 180) * (58 + 26 * random()); // from the floor, leaning inwards
    const speed = 3.4 + 1.4 * random();
    return {
      side,
      delay: 0.25 * random(),
      vx: -side * Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      sway: 0.04 + 0.08 * random(),
      swayRate: 5 + 5 * random(),
      spin: (random() - 0.5) * 14,
      flip: 6 + 8 * random(),
      phase: random() * 6.28,
      w: 0.03 + 0.025 * random(),
      h: 0.016 + 0.012 * random(),
      color: palette[Math.floor(random() * palette.length)],
    };
  });
  const confetti = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, depthTest: false, depthWrite: false }),
    PIECES,
  );
  pieces.forEach((p, i) => confetti.setColorAt(i, p.color));
  confetti.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  // ---------- Sparkles: four-pointed stars, twinkling over the confetti ----------
  const SPARKLES = small ? 26 : 44;
  const sparkles = Array.from({ length: SPARKLES }, () => ({
    x: random() * 2 - 1, // as a share of the half-width
    y: random() * 1.5 - 0.6,
    at: 0.15 + 1.9 * random(),
    life: 0.35 + 0.4 * random(),
    size: 0.03 + 0.05 * random(),
    turn: random() * 6.28,
    color: new THREE.Color(random() < 0.5 ? '#fff6dc' : '#ffe08a'),
  }));
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

  const meshes = [confetti, star];
  meshes.forEach((m, i) => {
    m.frustumCulled = false;
    m.renderOrder = i;
  });

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const axis = new THREE.Vector3(0, 0, 1);
  const pos = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const hide = new THREE.Matrix4().makeScale(0, 0, 0);

  const update = (t: number, aspect: number) => {
    const out = 1 - smooth(CONFETTI.length - 0.5, CONFETTI.length, t);
    pieces.forEach((p, i) => {
      const s = t - p.delay;
      if (s <= 0 || out <= 0) {
        confetti.setMatrixAt(i, hide);
        return;
      }
      // Fired up and inwards, slowed by the air, pulled down to drift at its falling speed.
      const k = (1 - Math.exp(-DRAG * s)) / DRAG;
      // (Narrow screens fire it less far across, so it stays on them.)
      const x = p.side * aspect * 0.96 + p.vx * k * Math.min(1, aspect) + p.sway * Math.sin(p.swayRate * s + p.phase) * clamp01(s / 0.6);
      const y = -1.04 + (p.vy + GRAVITY / DRAG) * k - (GRAVITY / DRAG) * s;
      // Tumbling: it turns, and flips over (seen edge-on, it narrows).
      const flip = Math.max(0.12, Math.abs(Math.cos(p.flip * s + p.phase)));
      q.setFromAxisAngle(axis, p.phase + p.spin * s);
      confetti.setMatrixAt(i, m4.compose(pos.set(x, y, 0), q, scale.set(p.w * out, p.h * flip * out, 1)));
    });
    sparkles.forEach((sp, i) => {
      const life = (t - sp.at) / sp.life;
      if (life <= 0 || life >= 1) {
        star.setMatrixAt(i, hide);
        return;
      }
      const size = sp.size * Math.sin(Math.PI * life);
      q.setFromAxisAngle(axis, sp.turn + life);
      star.setMatrixAt(i, m4.compose(pos.set(sp.x * aspect * 0.9, sp.y, 0), q, scale.set(size, size, 1)));
    });
    confetti.instanceMatrix.needsUpdate = true;
    star.instanceMatrix.needsUpdate = true;
  };

  update(0, 1);
  for (const m of meshes) if (m.instanceColor) m.instanceColor.needsUpdate = true;

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

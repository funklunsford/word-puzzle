// The contract every celebration scene keeps (see scene.ts and docs/daily-celebration-prompt.md):
// each day's scene in src/daily/days, and the Perfect confetti. Three.js builds and updates scenes
// without a screen, so frames can be compared, measured and checked here.

import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { DailyPuzzle } from '../daily/daily';
import type { Pt } from '../ink';
import { CONFETTI, confettiScene, type BubbleSource } from './confetti';
import { plainScene } from './plain';
import type { CelebrationModule, Scene } from './scene';
import { wordStrokes } from './wordPoints';

const modules = import.meta.glob<CelebrationModule>('../daily/days/*.ts', { eager: true });
const sources = import.meta.glob<string>('../daily/days/*.ts', { eager: true, query: '?raw', import: 'default' });
const puzzles = import.meta.glob<DailyPuzzle>('../daily/days/*.json', { eager: true, import: 'default' });
const dateOf = (path: string) => path.slice(path.lastIndexOf('/') + 1).replace(/\.\w+$/, '');

/** A stand-in for the page's colours: fixed, different for each name. */
const cssColor = (name: string): [number, number, number] => {
  let h = 7;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 1009;
  return [(h % 10) / 10, ((h >> 2) % 10) / 10, ((h >> 4) % 10) / 10];
};

const BUDGET = { meshes: 6, vertices: 20_000, instances: 5_000 };

/** Everything that decides what a frame looks like, as one string. */
function snapshot(scene: Scene): string {
  const parts: string[] = [];
  const add = (x: unknown) => parts.push(typeof x === 'number' ? x.toFixed(5) : String(x));
  for (const root of scene.objects)
    root.traverse((o) => {
      add(o.visible);
      o.position.toArray().forEach(add);
      o.quaternion.toArray().forEach(add);
      o.scale.toArray().forEach(add);
      const m = o as THREE.Mesh | THREE.InstancedMesh;
      if (m.geometry) for (const a of Object.values(m.geometry.attributes)) for (const v of (a as THREE.BufferAttribute).array) add(v);
      if (m instanceof THREE.InstancedMesh) {
        add(m.count);
        for (const v of m.instanceMatrix.array) add(v);
        if (m.instanceColor) for (const v of m.instanceColor.array) add(v);
      }
      for (const mat of [m.material ?? []].flat() as THREE.Material[]) {
        add(mat.opacity);
        add(mat.visible);
        const c = (mat as THREE.MeshBasicMaterial).color;
        if (c) add(c.getHexString());
        for (const u of Object.values((mat as THREE.ShaderMaterial).uniforms ?? {})) {
          const v = u.value;
          if (typeof v === 'number') add(v);
          else if (v?.toArray) v.toArray().forEach(add);
        }
      }
    });
  return parts.join(',');
}

/** The scene's size: meshes, vertices and instances. */
function measure(scene: Scene) {
  let meshes = 0;
  let vertices = 0;
  let instances = 0;
  for (const root of scene.objects)
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.geometry) return;
      meshes++;
      vertices += m.geometry.attributes.position.count;
      if (m instanceof THREE.InstancedMesh) instances += m.count;
    });
  return { meshes, vertices, instances };
}

/** Each drawn triangle in word units (instances placed), skipping hidden ones; and lone points. */
function drawn(scene: Scene) {
  const tris: [Pt, Pt, Pt][] = [];
  const dots: Pt[] = [];
  const v = new THREE.Vector3();
  const im = new THREE.Matrix4();
  const world = new THREE.Matrix4();
  for (const root of scene.objects) {
    root.updateMatrixWorld(true);
    root.traverse((o) => {
      if (!o.visible) return;
      const m = o as THREE.Mesh;
      if (!m.geometry) return;
      const mats = [m.material].flat() as THREE.Material[];
      if (mats.every((mat) => !mat.visible || (mat.transparent && mat.opacity < 0.05))) return;
      const pos = m.geometry.attributes.position;
      const alpha = m.geometry.attributes.aAlpha as THREE.BufferAttribute | undefined;
      const at = (i: number, mat: THREE.Matrix4): Pt => {
        v.fromBufferAttribute(pos, i).applyMatrix4(mat);
        return [v.x, v.y];
      };
      const copies = m instanceof THREE.InstancedMesh ? m.count : 1;
      for (let c = 0; c < copies; c++) {
        world.copy(m.matrixWorld);
        if (m instanceof THREE.InstancedMesh) {
          m.getMatrixAt(c, im);
          if (Math.abs(im.determinant()) < 1e-10) continue;
          world.multiply(im);
        }
        if (!(m instanceof THREE.Mesh)) {
          for (let i = 0; i < pos.count; i++) dots.push(at(i, world));
          continue;
        }
        const index = m.geometry.index;
        const n = index ? index.count : pos.count;
        for (let i = 0; i + 2 < n; i += 3) {
          const [a, b, d] = [0, 1, 2].map((k) => (index ? index.getX(i + k) : i + k));
          if (alpha && alpha.getX(a) + alpha.getX(b) + alpha.getX(d) < 0.15) continue;
          tris.push([at(a, world), at(b, world), at(d, world)]);
        }
      }
    });
  }
  return { tris, dots };
}

const inside = ([x, y]: Pt, [a, b, c]: [Pt, Pt, Pt]) => {
  const area = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
  if (Math.abs(area) < 1e-9) return false;
  const s = ((b[0] - x) * (c[1] - y) - (c[0] - x) * (b[1] - y)) / area;
  const t = ((c[0] - x) * (a[1] - y) - (a[0] - x) * (c[1] - y)) / area;
  return s >= -1e-6 && t >= -1e-6 && 1 - s - t >= -1e-6;
};

/** Points every 0.1 units along a word's strokes. */
function along(word: string): Pt[] {
  return wordStrokes(word).flatMap(({ pts }) =>
    pts.slice(1).flatMap((b, i) => {
      const a = pts[i];
      const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.1));
      return Array.from({ length: n }, (_, k): Pt => [a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
    }),
  );
}

/** The share of a word's strokes that the frame draws over. */
function coverage(scene: Scene, word: string) {
  const { tris, dots } = drawn(scene);
  const pts = along(word);
  const covered = pts.filter((p) => tris.some((t) => inside(p, t)) || dots.some((d) => Math.hypot(d[0] - p[0], d[1] - p[1]) < 0.06));
  return covered.length / pts.length;
}

/** The share of what's drawn that lies near a word's strokes. */
function nearWord(scene: Scene, word: string, within: number) {
  const pts = along(word);
  const { tris, dots } = drawn(scene);
  const all = [...tris.flat(), ...dots];
  const near = all.filter((p) => pts.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < within));
  return near.length / all.length;
}

/** How far anything drawn moves between two moments (the same vertex, then and now). */
function drift(scene: Scene, t0: number, t1: number) {
  scene.update(t0);
  const a = drawn(scene);
  scene.update(t1);
  const b = drawn(scene);
  let most = 0;
  a.tris.forEach((tri, i) => tri.forEach((p, k) => b.tris[i] && (most = Math.max(most, Math.hypot(p[0] - b.tris[i][k][0], p[1] - b.tris[i][k][1])))));
  return most;
}

/** Every geometry and material in a scene gets disposed. */
function disposesAll(scene: Scene) {
  const things = new Set<{ dispose: () => void }>();
  for (const root of scene.objects)
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) things.add(m.geometry);
      for (const mat of [m.material ?? []].flat()) things.add(mat as THREE.Material);
    });
  const freed = new Set<unknown>();
  for (const t of things) {
    const own = t.dispose.bind(t);
    t.dispose = () => {
      freed.add(t);
      own();
    };
  }
  scene.dispose();
  return [...things].every((t) => freed.has(t));
}

const days = Object.keys(modules).map((path) => ({ date: dateOf(path), path, module: modules[path] }));

describe('daily celebrations', () => {
  it('every day with a puzzle has a celebration, and every celebration a puzzle', () => {
    expect(days.map((d) => d.date).sort()).toEqual(Object.keys(puzzles).map(dateOf).sort());
  });

  for (const { date, path, module } of days) {
    const { puzzle } = puzzles[path.replace(/\.ts$/, '.json')];
    const { start, goal } = puzzle;
    const { theme } = module;
    const { burst, calm, settled } = theme.timing;
    const make = (small = false) => module.scene(THREE, { start, goal, theme, small, cssColor });

    describe(`${date}: ${start} → ${goal}`, () => {
      it('has a short title, a colour to open on, and beats in order', () => {
        expect(theme.title.length).toBeGreaterThan(0);
        expect(theme.title.length).toBeLessThanOrEqual(12);
        expect(theme.stormBg).toMatch(/^#[0-9a-f]{6}$/i);
        expect(0 < burst && burst < calm && calm < settled && settled <= 6).toBe(true);
      });

      it('draws the same frame for the same moment, in any order and from a fresh start', () => {
        const times = [0, 0.2, burst + 0.1, (burst + calm) / 2, calm + 0.3, settled, settled + 0.8, settled + 4];
        const a = make();
        const first = times.map((t) => (a.update(t), snapshot(a)));
        const again = [...times].reverse().map((t) => (a.update(t), snapshot(a))).reverse();
        const b = make();
        const fresh = times.map((t) => (b.update(t), snapshot(b)));
        times.forEach((t, i) => {
          expect(again[i], `t = ${t}, played backwards`).toBe(first[i]);
          expect(fresh[i], `t = ${t}, a second copy`).toBe(first[i]);
        });
      });

      it(`shows ${start} at the start and ends on ${goal}, with little else`, () => {
        const s = make();
        s.update(Math.min(0.2, burst / 2));
        expect(coverage(s, start)).toBeGreaterThan(0.9);
        s.update(settled + 0.8);
        expect(coverage(s, goal)).toBeGreaterThan(0.9);
        expect(nearWord(s, goal, 0.6)).toBeGreaterThan(0.9);
      });

      it('holds still once settled, apart from gentle idle motion', () => {
        expect(drift(make(), settled + 0.8, settled + 3)).toBeLessThan(0.04);
      });

      it('keeps to the budget, and draws less on a phone', () => {
        const big = measure(make());
        const small = measure(make(true));
        expect(big.meshes).toBeLessThanOrEqual(BUDGET.meshes);
        expect(big.vertices).toBeLessThanOrEqual(BUDGET.vertices);
        expect(big.instances).toBeLessThanOrEqual(BUDGET.instances);
        expect(small.vertices + small.instances).toBeLessThanOrEqual(0.85 * (big.vertices + big.instances));
      });

      it('frees everything it made', () => {
        expect(disposesAll(make())).toBe(true);
      });

      it('is self-contained: no randomness, clocks, network or page', () => {
        const src = sources[path];
        for (const banned of ['Math.random', 'Date.now', 'performance.now', 'fetch(', 'XMLHttpRequest', 'document.', 'window.', 'localStorage', 'import(', 'Loader', 'http:', 'https:'])
          expect(src.includes(banned), banned).toBe(false);
        const imports = [...src.matchAll(/from '([^']+)'/g)].map((m) => m[1]);
        for (const from of imports) expect(['three', '../../celebration/kit', '../../celebration/scene', '../../celebration/wordPoints', '../../maze', '../../glyphs', '../../ink'], from).toContain(from);
      });
    });
  }
});

describe('the Perfect bubbles', () => {
  /** A word on the board, as the bubbles are told of it: points along four letters' strokes, a little above the middle. */
  const sources = (aspect: number): BubbleSource[] =>
    Array.from({ length: 80 }, (_, i) => ({ x: (((i % 40) / 39) * 1.2 - 0.6) * Math.min(aspect, 1), y: 0.25 + (i < 40 ? 0 : 0.18), color: [((i * 37) % 10) / 10, 0.5, 0.4] }));
  const make = (aspect: number, small = false, light = true) => confettiScene(THREE, { small, light, sources: sources(aspect) });
  const asScene = (c: ReturnType<typeof make>, aspect: number): Scene => ({ objects: c.objects, margin: 0, update: (t) => c.update(t, aspect), dispose: c.dispose });
  /** How far the bubbles have come from the word, the middle one of them (their centres, roughly). */
  const reach = (s: Scene, aspect: number) => {
    const from = sources(aspect);
    const centres = drawn(s).tris.map((tri): Pt => [(tri[0][0] + tri[1][0] + tri[2][0]) / 3, (tri[0][1] + tri[1][1] + tri[2][1]) / 3]);
    const d = centres.map(([x, y]) => Math.min(...from.map((q) => Math.hypot(x - q.x, y - q.y)))).sort((a, b) => a - b);
    return d[Math.floor(d.length / 2)] ?? 0;
  };

  it('draws the same frame for the same moment, in any order and from a fresh start', () => {
    const times = [0, 0.1, 0.6, 1.3, CONFETTI.handoff, 2.5, CONFETTI.length + 1];
    for (const aspect of [1.6, 0.46]) {
      const a = asScene(make(aspect), aspect);
      const first = times.map((t) => (a.update(t), snapshot(a)));
      const again = [...times].reverse().map((t) => (a.update(t), snapshot(a))).reverse();
      const b = asScene(make(aspect), aspect);
      times.forEach((t, i) => {
        expect(again[i], `t = ${t}, played backwards`).toBe(first[i]);
        expect((b.update(t), snapshot(b)), `t = ${t}, a second copy`).toBe(first[i]);
      });
    }
  });

  it('bursts out of the word, floats away from it on screen, and is gone by its end', () => {
    for (const aspect of [1.6, 0.46]) {
      const s = asScene(make(aspect), aspect);
      s.update(0.12);
      expect(drawn(s).tris.length).toBeGreaterThan(40);
      expect(reach(s, aspect)).toBeLessThan(0.1);
      s.update(1.2);
      const { tris } = drawn(s);
      expect(tris.length).toBeGreaterThan(40);
      expect(reach(s, aspect)).toBeGreaterThan(0.2);
      const xs = tris.flat().map((p) => p[0]);
      expect(xs.filter((x) => Math.abs(x) <= aspect + 0.05).length / xs.length).toBeGreaterThan(0.95);
      s.update(CONFETTI.length);
      expect(drawn(s).tris.length).toBe(0);
    }
  });

  it('keeps to the budget, draws less on a phone, and frees everything it made', () => {
    const big = measure(asScene(make(1.6), 1.6));
    const small = measure(asScene(make(0.46, true), 0.46));
    expect(big.meshes).toBeLessThanOrEqual(BUDGET.meshes);
    expect(big.vertices).toBeLessThanOrEqual(BUDGET.vertices);
    expect(big.instances).toBeLessThanOrEqual(BUDGET.instances);
    expect(small.instances).toBeLessThan(0.7 * big.instances);
    expect(disposesAll(asScene(make(1.6), 1.6))).toBe(true);
  });
});

describe('the plain celebration (a puzzle with no scene of the day)', () => {
  it('shows the goal word, still, and frees what it made', () => {
    const s = plainScene(THREE, { word: 'TAME', cssColor });
    for (const t of [0, 3, 10]) {
      s.update();
      expect(coverage(s, 'TAME'), `t = ${t}`).toBeGreaterThan(0.9);
    }
    expect(disposesAll(s)).toBe(true);
  });
});

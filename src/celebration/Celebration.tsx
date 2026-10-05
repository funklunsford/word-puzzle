import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { seededRandom } from '../maze';
import type { CelebrationTheme } from './themes';
import { samplePoints, wordWidth } from './wordPoints';

interface Props {
  start: string;
  goal: string;
  theme: CelebrationTheme;
  /** The player's strokes, and the lowest possible. */
  strokes: number;
  best: number;
  /** Show one moment (seconds) and hold it, instead of playing: for previews and stills. */
  freezeAt?: number;
  onClose: () => void;
}

// Every particle's path is a function of time (in the vertex shader), so any moment can be drawn
// on its own: the start word holds, bursts into wild swirls, calms, and settles into the goal word.
const PATH = /* glsl */ `
  uniform float uBurst;
  uniform float uCalm;
  uniform float uSettled;
  attribute vec2 aStart;
  attribute vec2 aEnd;
  attribute vec4 aSeed;
  vec2 pathAt(float t) {
    float burst = smoothstep(uBurst, uBurst + 0.6, t);
    float settle = smoothstep(uCalm - 0.2, uSettled, t);
    settle = settle * settle * (3.0 - 2.0 * settle);
    // Wild: each particle is caught in one of four roaming whirlpools, turning opposite ways, so
    // the ink streams round in swirls instead of drifting as dust.
    float k = floor(aSeed.x * 4.0);
    float side = mod(k, 2.0) * 2.0 - 1.0;
    vec2 centre = vec2(
      2.6 * sin(0.9 * t + 1.7 * k) + 0.6 * sin(2.3 * t + k),
      1.3 * cos(0.7 * t + 2.1 * k) + 0.4 * cos(1.9 * t + 0.5 * k)
    );
    float r = 0.25 + 2.1 * pow(aSeed.z, 0.8);
    float spin = side * (2.2 + 2.8 * aSeed.w) / sqrt(r);
    float a = 6.283 * aSeed.y + spin * max(0.0, t - uBurst);
    vec2 whirl = centre + r * vec2(cos(a), sin(a)) * (1.0 + 0.12 * sin(5.0 * t + 9.0 * aSeed.w));
    vec2 wild = mix(aStart, whirl, burst);
    // Tamed: a slow orbit that unwinds onto the goal word's strokes.
    float ang = (1.0 - settle) * (2.0 + 2.5 * aSeed.w) * side;
    vec2 calm = mat2(cos(ang), sin(ang), -sin(ang), cos(ang)) * aEnd;
    vec2 p = mix(wild, calm, settle);
    // Once settled, the ink breathes a little.
    float rest = smoothstep(uSettled - 0.4, uSettled + 0.4, t);
    p += rest * 0.012 * vec2(sin(t * 1.7 + 10.0 * aSeed.x), cos(t * 1.3 + 10.0 * aSeed.y));
    return p;
  }
`;

const VERTEX = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  attribute vec3 aWild;
  attribute vec3 aCalm;
  attribute float aLag;
  varying vec3 vColor;
  varying float vAlpha;
  ${PATH}
  void main() {
    // Streaks trail a moment behind their heads; the trail shortens as the ink calms.
    float lag = aLag * mix(0.075, 0.0, smoothstep(uCalm, uSettled, uTime));
    vec2 p = pathAt(max(0.0, uTime - lag));
    vColor = mix(aWild, aCalm, smoothstep(uCalm - 0.6, uSettled - 0.3, uTime));
    vAlpha = 1.0 - 0.9 * aLag;
    gl_PointSize = uSize * (1.0 + 0.35 * smoothstep(uSettled - 0.5, uSettled + 0.3, uTime));
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 0.0, 1.0);
  }
`;

const DOTS = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    gl_FragColor = vec4(vColor, vAlpha * smoothstep(0.5, 0.2, d));
  }
`;

const LINES = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() { gl_FragColor = vec4(vColor, vAlpha * 0.75); }
`;

/** The page's colour for a CSS custom property (theme-aware), as r, g, b in 0–1. */
function cssColor(name: string, fallback: string): [number, number, number] {
  const probe = document.createElement('i');
  probe.style.color = getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  document.body.appendChild(probe);
  const m = getComputedStyle(probe).color.match(/[\d.]+/g)!.map(Number);
  probe.remove();
  return [m[0] / 255, m[1] / 255, m[2] / 255];
}

/**
 * The win celebration: the start word bursts into wild ink and is tamed into the goal word (drawn
 * live with three.js, loaded only when it plays). Tap, click or Escape to carry on.
 */
export function Celebration({ start, goal, theme, strokes, best, freezeAt, onClose }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [settled, setSettled] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const still = freezeAt ?? (reduce ? theme.timing.settled + 0.6 : undefined);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    (async () => {
      const THREE = await import('three');
      const el = host.current;
      if (disposed || !el) return;
      const small = Math.min(window.innerWidth, window.innerHeight) < 600;
      const n = small ? 2600 : 5200;
      const dpr = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2);

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setPixelRatio(dpr);
      el.appendChild(renderer.domElement);
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);

      // Particles: from the start word's strokes to the goal word's, paired at random.
      const random = seededRandom(17);
      const from = samplePoints(start, n, 0.08, random);
      const to = samplePoints(goal, n, 0.08, random);
      const order = Array.from({ length: n }, (_, i) => i).sort(() => random() - 0.5);
      // The shaders write colours straight out, so they get sRGB values (as the page has them).
      const srgb = { r: 0, g: 0, b: 0 };
      const wild = theme.wild.map((c) => new THREE.Color(c).getRGB(srgb, THREE.SRGBColorSpace) && { ...srgb });
      const calmOf = new Map<string, [number, number, number]>();
      const seeds = new Float32Array(n * 4).map(() => random());
      const head = { aStart: new Float32Array(n * 2), aEnd: new Float32Array(n * 2), aWild: new Float32Array(n * 3), aCalm: new Float32Array(n * 3) };
      for (let i = 0; i < n; i++) {
        const j = order[i];
        head.aStart.set([from.xy[i * 2], from.xy[i * 2 + 1]], i * 2);
        head.aEnd.set([to.xy[j * 2], to.xy[j * 2 + 1]], i * 2);
        const w = wild[Math.floor(random() * wild.length)];
        head.aWild.set([w.r, w.g, w.b], i * 3);
        const tile = to.tiles[j];
        if (!calmOf.has(tile)) calmOf.set(tile, cssColor(`--t-${tile}`, '#8fa6bf'));
        head.aCalm.set(calmOf.get(tile)!, i * 3);
      }
      const uniforms = {
        uTime: { value: 0 },
        uSize: { value: (small ? 2.6 : 3.2) * dpr },
        uBurst: { value: theme.timing.burst },
        uCalm: { value: theme.timing.calm },
        uSettled: { value: theme.timing.settled },
      };
      const attrs = (copies: number) => {
        const g = new THREE.BufferGeometry();
        const rep = (src: Float32Array, size: number) => {
          const out = new Float32Array(src.length * copies);
          for (let i = 0; i < n; i++) for (let c = 0; c < copies; c++) out.set(src.subarray(i * size, i * size + size), (i * copies + c) * size);
          return new THREE.BufferAttribute(out, size);
        };
        g.setAttribute('aStart', rep(head.aStart, 2));
        g.setAttribute('aEnd', rep(head.aEnd, 2));
        g.setAttribute('aSeed', rep(seeds, 4));
        g.setAttribute('aWild', rep(head.aWild, 3));
        g.setAttribute('aCalm', rep(head.aCalm, 3));
        g.setAttribute('aLag', new THREE.BufferAttribute(Float32Array.from({ length: n * copies }, (_, k) => k % copies), 1));
        g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * copies * 3), 3));
        return g;
      };
      const material = (fragmentShader: string) =>
        new THREE.ShaderMaterial({ uniforms, vertexShader: VERTEX, fragmentShader, transparent: true, depthTest: false });
      const dots = new THREE.Points(attrs(1), material(DOTS));
      const streaks = new THREE.LineSegments(attrs(2), material(LINES));
      for (const obj of [streaks, dots]) {
        obj.frustumCulled = false;
        scene.add(obj);
      }

      // Fit the words to the screen: the wider of the two takes 70% of the width (or the height allows).
      const fit = () => {
        const w = el.clientWidth;
        const h = el.clientHeight;
        renderer.setSize(w, h);
        const span = Math.max(wordWidth(start), wordWidth(goal)) / 0.7;
        const unitsPerPx = Math.max(span / w, 5.5 / h);
        camera.left = (-w / 2) * unitsPerPx;
        camera.right = (w / 2) * unitsPerPx;
        camera.top = (h / 2) * unitsPerPx;
        camera.bottom = (-h / 2) * unitsPerPx;
        camera.updateProjectionMatrix();
      };
      fit();
      window.addEventListener('resize', fit);

      // The background starts stormy and calms to the page's own.
      const storm = new THREE.Color(theme.stormBg);
      const page = new THREE.Color().setRGB(...cssColor('--bg', '#17161c'), THREE.SRGBColorSpace);
      const bg = new THREE.Color();
      let raf = 0;
      const t0 = performance.now();
      const draw = (now: number) => {
        const t = still ?? (now - t0) / 1000;
        uniforms.uTime.value = t;
        const k = Math.min(1, Math.max(0, (t - theme.timing.calm + 0.4) / (theme.timing.settled - theme.timing.calm + 0.4)));
        renderer.setClearColor(bg.copy(storm).lerp(page, k * k * (3 - 2 * k)));
        renderer.render(scene, camera);
        if (t >= theme.timing.settled - 0.2) setSettled(true);
        if (still === undefined) raf = requestAnimationFrame(draw);
      };
      raf = requestAnimationFrame(draw);
      cleanup = () => {
        cancelAnimationFrame(raf);
        window.removeEventListener('resize', fit);
        for (const obj of [streaks, dots]) (obj.geometry.dispose(), (obj.material as InstanceType<typeof THREE.ShaderMaterial>).dispose());
        renderer.dispose();
        renderer.domElement.remove();
      };
    })();
    return () => {
      disposed = true;
      cleanup();
    };
  }, [start, goal, theme, still]);

  const leave = () => {
    if (leaving) return;
    setLeaving(true);
    window.setTimeout(onClose, 350);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') && leave();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className={`celebration${leaving ? ' leaving' : ''}`} ref={host} onClick={leave} role="dialog" aria-modal="true" aria-label={`${theme.title} You reached ${goal}`}>
      <div className={`celebration-text${settled ? ' shown' : ''}`}>
        <p className="celebration-title">{theme.title}</p>
        <p className="celebration-line">
          {start} → {goal} in {strokes} {strokes === 1 ? 'stroke' : 'strokes'}
          {strokes <= best ? ' · the lowest possible!' : ` · lowest possible ${best}`}
        </p>
        <p className="celebration-hint">Tap anywhere to carry on</p>
      </div>
    </div>
  );
}

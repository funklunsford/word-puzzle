import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import type * as THREE_NS from 'three';
import { mix, smooth } from './kit';
import type { CelebrationModule } from './scene';
import { wordWidth } from './wordPoints';

interface Props {
  start: string;
  goal: string;
  /** The day's celebration, if the puzzle has one (loaded when it plays). */
  load?: () => Promise<CelebrationModule>;
  /** Solved in the lowest possible strokes: the Perfect encore follows the day's scene (or plays alone). */
  perfect: boolean;
  /** The player's strokes, and the lowest possible. */
  strokes: number;
  best: number;
  /** Hints used on the way, if any. */
  hints?: number;
  /** Show one moment and hold it, instead of playing (for previews and stills): seconds from the start, or into the encore. */
  freezeAt?: number;
  freezeEncoreAt?: number;
  onClose: () => void;
}

/** The encore starts this long after the day's scene has settled: time to read its title. */
const HOLD = 1.2;
/** The encore plays on a dark stage, so the gold and the sparkles shine in light mode too. */
const STAGE = '#141019';

/** The page's colour for a CSS custom property (theme-aware), as r, g, b in 0–1 (sRGB). */
function cssColor(name: string, fallback: string): [number, number, number] {
  const probe = document.createElement('i');
  probe.style.color = getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  document.body.appendChild(probe);
  const m = getComputedStyle(probe).color.match(/[\d.]+/g)!.map(Number);
  probe.remove();
  return [m[0] / 255, m[1] / 255, m[2] / 255];
}

/**
 * The win celebration, drawn live with three.js (loaded only when it plays): the day's own scene,
 * the start word becoming the goal word, and, for a solve in the lowest possible strokes, the
 * Perfect encore (see perfect.ts). A tap skips ahead to the encore, or carries on; so do Enter and
 * Space. Escape always carries on.
 */
export function Celebration({ start, goal, load, perfect, strokes, best, hints = 0, freezeAt, freezeEncoreAt, onClose }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const captionRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [title, setTitle] = useState<string | null>(null);
  const [shown, setShown] = useState(false);
  const [encore, setEncore] = useState(false);
  const [caption, setCaption] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  /** Moves the show on to the encore, if it's still to come; false when there's nothing left but to close. */
  const skip = useRef<() => boolean>(() => false);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    (async () => {
      const [THREE, P, day] = await Promise.all([import('three'), import('./perfect'), load ? load().catch(() => null) : null]);
      const el = host.current;
      if (disposed || !el) return;
      setTitle(day?.theme.title ?? null);
      const small = Math.min(window.innerWidth, window.innerHeight) < 600;
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2));
      el.prepend(renderer.domElement);
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);

      // The acts: the day's scene, then (or only) the encore from P0. The day's scene fades under
      // a veil of the background as the encore's gold strokes take its place.
      const art = day?.scene(THREE, { start, goal, theme: day.theme, small, cssColor });
      const encoreArt = perfect ? P.perfectScene(THREE, { goal, small }) : null;
      const timing = day?.theme.timing;
      const P0 = !encoreArt ? Infinity : timing ? timing.settled + HOLD : 0;
      const layer = (order: number, objects: THREE_NS.Object3D[]) => {
        const g = new THREE.Group();
        g.renderOrder = order;
        for (const o of objects) g.add(o);
        scene.add(g);
        return g;
      };
      const veil = new THREE.Mesh(
        new THREE.PlaneGeometry(2, 2),
        new THREE.ShaderMaterial({
          uniforms: { uColor: { value: new THREE.Color() }, uOpacity: { value: 0 } },
          vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
          fragmentShader: 'uniform vec3 uColor; uniform float uOpacity; void main() { gl_FragColor = vec4(uColor, uOpacity);\n#include <colorspace_fragment>\n}',
          transparent: true,
          depthTest: false,
          depthWrite: false,
        }),
      );
      veil.frustumCulled = false;
      const dayLayer = layer(0, art?.objects ?? []);
      layer(1, [veil]);
      const encoreLayer = layer(2, encoreArt?.objects ?? []);

      // Framing: the wider word takes 70% of the width (88% on a phone, which has height to spare),
      // or as much as the height allows. The encore eases out to its widest word as it gathers.
      const daySpan = day ? Math.max(wordWidth(start), wordWidth(goal)) : wordWidth(goal);
      const dayMargin = art?.margin ?? 0.4;
      let w = 0;
      let h = 0;
      const resize = () => {
        w = el.clientWidth;
        h = el.clientHeight;
        renderer.setSize(w, h);
        dirty = true;
      };
      const frame = (span: number, margin: number) => {
        const unitsPerPx = Math.max(span / (w < 600 ? 0.88 : 0.7) / w, (2 + 2 * margin + 2.2) / h);
        camera.left = (-w / 2) * unitsPerPx;
        camera.right = (w / 2) * unitsPerPx;
        camera.top = (h / 2) * unitsPerPx;
        camera.bottom = (-h / 2) * unitsPerPx;
        camera.updateProjectionMatrix();
        // The language's name sits just under the word.
        if (captionRef.current) captionRef.current.style.top = `${h / 2 + 1.3 / unitsPerPx}px`;
      };

      // The clock: playing from t0, or held at one moment (previews, stills, reduced motion).
      const still = freezeEncoreAt !== undefined ? P0 + freezeEncoreAt : (freezeAt ?? (reduce ? (timing ? timing.settled + 0.8 : P0 + P.PERFECT_STILL) : undefined));
      const clock = { live: still === undefined, t: still ?? 0, t0: performance.now() };
      let dirty = true;
      const now = () => (clock.live ? (performance.now() - clock.t0) / 1000 : clock.t);
      skip.current = () => {
        if (now() >= P0) return false;
        if (clock.live) clock.t0 = performance.now() - P0 * 1000;
        else clock.t = P0 + P.PERFECT_STILL;
        dirty = true;
        return true;
      };
      resize();
      window.addEventListener('resize', resize);

      // The background starts as the day's own, calms to the page's, and dims to the stage for the encore.
      const storm = new THREE.Color(day?.theme.stormBg ?? '#000');
      const page = new THREE.Color().setRGB(...cssColor('--bg', '#17161c'), THREE.SRGBColorSpace);
      const stage = new THREE.Color(STAGE);
      const bg = new THREE.Color();
      const said = { shown: false, encore: false, caption: null as string | null };
      const say = <K extends keyof typeof said>(key: K, value: (typeof said)[K], set: (v: (typeof said)[K]) => void) => {
        if (said[key] !== value) set((said[key] = value));
      };
      let raf = 0;
      const draw = () => {
        raf = requestAnimationFrame(draw);
        if (!clock.live && !dirty) return;
        dirty = false;
        const t = now();
        const u = t - P0;
        const veiled = smooth(0, 0.35, u);
        dayLayer.visible = !!art && veiled < 1;
        if (art && dayLayer.visible) art.update(t);
        encoreLayer.visible = u >= 0;
        if (encoreArt && u >= 0) encoreArt.update(u);

        bg.copy(page);
        if (timing) bg.copy(storm).lerp(page, smooth(timing.calm, timing.settled, t));
        if (u > 0) bg.lerp(stage, smooth(0, 0.6, u));
        renderer.setClearColor(bg);
        veil.visible = veiled > 0 && dayLayer.visible;
        veil.material.uniforms.uColor.value.copy(bg);
        veil.material.uniforms.uOpacity.value = veiled;

        const zoom = encoreArt ? smooth(0.15, 0.9, u) : 0;
        frame(mix(daySpan, P.PERFECT_SPAN, zoom), mix(dayMargin, encoreArt?.margin ?? 0, zoom));
        renderer.render(scene, camera);

        // The words: the day's title once its scene settles, the language under each "perfect".
        say('shown', (!!timing && t >= timing.settled - 0.2) || u >= P.FORMED - 0.3, setShown);
        say('encore', u >= 0, setEncore);
        const k = P.wordAt(u);
        say('caption', k >= 0 ? P.PERFECT_WORDS[k].language : null, setCaption);
      };
      raf = requestAnimationFrame(draw);
      cleanup = () => {
        cancelAnimationFrame(raf);
        window.removeEventListener('resize', resize);
        art?.dispose();
        encoreArt?.dispose();
        veil.geometry.dispose();
        veil.material.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    })().catch(() => !disposed && onClose());
    return () => {
      disposed = true;
      cleanup();
    };
  }, [start, goal, load, perfect, freezeAt, freezeEncoreAt, reduce]);

  const leave = () => {
    if (leaving) return;
    setLeaving(true);
    window.setTimeout(onClose, 350);
  };
  const carryOn = () => skip.current() || leave();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') leave();
      else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        carryOn();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const label = perfect ? `Perfect! You reached ${goal} in the lowest possible strokes.` : `${title ?? 'Solved!'} You reached ${goal}.`;
  return (
    <div className={`celebration${encore ? ' stage' : ''}${leaving ? ' leaving' : ''}`} ref={host} onClick={carryOn} role="dialog" aria-modal="true" aria-label={label}>
      <div className="celebration-caption" ref={captionRef} aria-hidden="true">
        {caption && (
          <span key={caption} className="celebration-language">
            {caption}
          </span>
        )}
      </div>
      <div className={`celebration-text${shown ? ' shown' : ''}`}>
        {title && <p className={`celebration-title${encore ? ' gone' : ''}`}>{title}</p>}
        <p className="celebration-line">
          {start} → {goal} in {strokes} {strokes === 1 ? 'stroke' : 'strokes'}
          {strokes <= best ? ' · the lowest possible!' : ` · lowest possible ${best}`}
          {hints > 0 && ` · ${hints} ${hints === 1 ? 'hint' : 'hints'}`}
        </p>
        <p className="celebration-hint">Tap anywhere to carry on</p>
      </div>
    </div>
  );
}

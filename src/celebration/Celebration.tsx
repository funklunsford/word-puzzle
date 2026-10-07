import { useEffect, useRef, useState } from 'react';
import { useReduceMotion } from '../prefs';
import { smooth } from './kit';
import type { CelebrationModule } from './scene';
import { wordWidth } from './wordPoints';

interface Props {
  start: string;
  goal: string;
  /** The day's celebration, if the puzzle has one (loaded when it plays). */
  load?: () => Promise<CelebrationModule>;
  /** Solved in the lowest possible strokes: confetti and sparkles burst first, then the day's celebration. */
  perfect: boolean;
  /** The player's strokes, and the lowest possible. */
  strokes: number;
  best: number;
  /** Hints used on the way, if any. */
  hints?: number;
  /** Show one moment (seconds from the start) and hold it, instead of playing: for previews and stills. */
  freezeAt?: number;
  onClose: () => void;
}

/** The confetti plays on a dark stage when there's no day's scene (and so no opening colour of its own). */
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
 * The win celebration, drawn live with three.js (loaded only when it plays). For a solve in the
 * lowest possible strokes, confetti and sparkles burst first (see confetti.ts); then the day's own
 * scene shows the start word becoming the goal word. A tap skips the confetti, or carries on; so do
 * Enter and Space. Escape always carries on.
 */
export function Celebration({ start, goal, load, perfect, strokes, best, hints = 0, freezeAt, onClose }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const reduce = useReduceMotion();
  const [title, setTitle] = useState<string | null>(null);
  const [shown, setShown] = useState(false);
  const [leaving, setLeaving] = useState(false);
  /** Skips the confetti, if it's still playing; false when there's nothing left but to close. */
  const skip = useRef<() => boolean>(() => false);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    (async () => {
      const [THREE, C, day] = await Promise.all([import('three'), import('./confetti'), load ? load().catch(() => null) : null]);
      const el = host.current;
      if (disposed || !el) return;
      setTitle(day?.theme.title ?? (perfect ? 'Perfect!' : null));
      const small = Math.min(window.innerWidth, window.innerHeight) < 600;
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2));
      el.prepend(renderer.domElement);

      // Two layers: the day's scene, framed on its words, and the confetti over the whole screen.
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);
      const art = day?.scene(THREE, { start, goal, theme: day.theme, small, cssColor });
      for (const o of art?.objects ?? []) scene.add(o);
      const party = perfect ? C.confettiScene(THREE, { small, cssColor }) : null;
      const partyScene = new THREE.Scene();
      const partyCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);
      for (const o of party?.objects ?? []) partyScene.add(o);

      // The timeline: the confetti from 0, and the day's scene from D0 (as the confetti falls away).
      const timing = day?.theme.timing;
      const D0 = party ? C.CONFETTI.handoff : 0;
      const end = timing ? D0 + timing.settled : C.CONFETTI.length - 0.6;

      // Framing: the wider word takes 70% of the width (88% on a phone, which has height to spare),
      // or as much as the height allows.
      const span = Math.max(wordWidth(start), wordWidth(goal));
      const margin = art?.margin ?? 0.4;
      let w = 0;
      let h = 0;
      let dirty = true;
      const resize = () => {
        w = el.clientWidth;
        h = el.clientHeight;
        renderer.setSize(w, h);
        const unitsPerPx = Math.max(span / (w < 600 ? 0.88 : 0.7) / w, (2 + 2 * margin + 2.2) / h);
        camera.left = (-w / 2) * unitsPerPx;
        camera.right = (w / 2) * unitsPerPx;
        camera.top = (h / 2) * unitsPerPx;
        camera.bottom = (-h / 2) * unitsPerPx;
        camera.updateProjectionMatrix();
        partyCamera.left = -w / h;
        partyCamera.right = w / h;
        partyCamera.updateProjectionMatrix();
        dirty = true;
      };

      // The clock: playing from t0, or held at one moment (previews, stills; reduced motion holds the finished frame).
      const still = freezeAt ?? (reduce ? (timing ? D0 + timing.settled + 0.8 : end) : undefined);
      const clock = { live: still === undefined, t: still ?? 0, t0: performance.now() };
      const now = () => (clock.live ? (performance.now() - clock.t0) / 1000 : clock.t);
      skip.current = () => {
        if (!party || !art || now() >= D0) return false;
        if (clock.live) clock.t0 = performance.now() - D0 * 1000;
        else clock.t = D0;
        dirty = true;
        return true;
      };
      resize();
      window.addEventListener('resize', resize);

      // The background: the day's opening colour (or the dark stage), calming to the page's own.
      const page = new THREE.Color().setRGB(...cssColor('--bg', '#17161c'), THREE.SRGBColorSpace);
      const storm = new THREE.Color(day?.theme.stormBg ?? STAGE);
      const calm = timing ? D0 + timing.calm : end - 1;
      const bg = new THREE.Color();
      let shownNow = false;
      let raf = 0;
      const draw = () => {
        raf = requestAnimationFrame(draw);
        if (!clock.live && !dirty) return;
        dirty = false;
        const t = now();
        art?.update(Math.max(0, t - D0));
        renderer.setClearColor(bg.copy(storm).lerp(page, smooth(calm, end, t)));
        renderer.render(scene, camera);
        if (party && t < C.CONFETTI.length) {
          party.update(t, w / h);
          renderer.autoClear = false;
          renderer.render(partyScene, partyCamera);
          renderer.autoClear = true;
        }
        const show = t >= end - 0.2;
        if (show !== shownNow) setShown((shownNow = show));
      };
      raf = requestAnimationFrame(draw);
      cleanup = () => {
        cancelAnimationFrame(raf);
        window.removeEventListener('resize', resize);
        art?.dispose();
        party?.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    })().catch(() => !disposed && onClose());
    return () => {
      disposed = true;
      cleanup();
    };
  }, [start, goal, load, perfect, freezeAt, reduce]);

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
    <div className={`celebration${leaving ? ' leaving' : ''}`} ref={host} onClick={carryOn} role="dialog" aria-modal="true" aria-label={label}>
      <div className={`celebration-text${shown ? ' shown' : ''}`}>
        {title && <p className="celebration-title">{title}</p>}
        <p className="celebration-line">
          <span className="nowrap">
            {start} → {goal} in {strokes} {strokes === 1 ? 'stroke' : 'strokes'}
          </span>
          <span className="nowrap">{strokes <= best ? ' · the lowest possible!' : ` · lowest possible ${best}`}</span>
          {hints > 0 && <span className="nowrap">{` · ${hints} ${hints === 1 ? 'hint' : 'hints'}`}</span>}
        </p>
        <p className="celebration-hint">Tap anywhere to carry on</p>
      </div>
    </div>
  );
}

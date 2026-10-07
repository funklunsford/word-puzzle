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
  /** Solved in the lowest possible strokes: bubbles and sparkles burst out of the word first, then the day's celebration. */
  perfect: boolean;
  /** Where the word's strokes are on screen, for the bubbles to come out of (asked as they start; see inkSources). */
  from?: () => Source[];
  /** The player's strokes, and the lowest possible. */
  strokes: number;
  best: number;
  /** Hints used on the way, if any. */
  hints?: number;
  /** Show one moment (seconds from the start) and hold it, instead of playing: for previews and stills. */
  freezeAt?: number;
  onClose: () => void;
}

/** A point on a stroke on screen (px), with the stroke's colour (sRGB, 0 to 1). */
export interface Source {
  x: number;
  y: number;
  color: [number, number, number];
}

/** Points along the inked strokes inside `el` (as many from a stroke as its length), on screen and in view. */
export function inkSources(el: Element | null | undefined, count = 160): Source[] {
  const paths = [...(el?.querySelectorAll<SVGPathElement>('path.ink') ?? [])];
  const lengths = paths.map((p) => p.getTotalLength());
  const total = lengths.reduce((a, b) => a + b, 0);
  if (!total) return [];
  const out: Source[] = [];
  paths.forEach((p, i) => {
    const m = p.getScreenCTM();
    const rgb = getComputedStyle(p).fill.match(/[\d.]+/g)?.map(Number);
    if (!m || !rgb || rgb.length < 3) return;
    const n = Math.max(1, Math.round((count * lengths[i]) / total));
    for (let k = 0; k < n; k++) {
      const q = p.getPointAtLength(((k + 0.5) / n) * lengths[i]).matrixTransform(m);
      if (q.x >= 0 && q.y >= 0 && q.x <= window.innerWidth && q.y <= window.innerHeight) out.push({ x: q.x, y: q.y, color: [rgb[0] / 255, rgb[1] / 255, rgb[2] / 255] });
    }
  });
  return out;
}

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
 * lowest possible strokes, bubbles and sparkles burst out of the word first (see confetti.ts); then the
 * day's own scene shows the start word becoming the goal word. A tap skips the bubbles, or carries on; so do
 * Enter and Space. Escape always carries on.
 */
export function Celebration({ start, goal, load, perfect, from, strokes, best, hints = 0, freezeAt, onClose }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const reduce = useReduceMotion();
  const [title, setTitle] = useState<string | null>(null);
  const [shown, setShown] = useState(false);
  const [leaving, setLeaving] = useState(false);
  /** Skips the bubbles, if they're still playing; false when there's nothing left but to close. */
  const skip = useRef<() => boolean>(() => false);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    (async () => {
      const [THREE, C, P, day] = await Promise.all([import('three'), import('./confetti'), import('./plain'), load ? load().catch(() => null) : null]);
      const el = host.current;
      if (disposed || !el) return;
      setTitle(day?.theme.title ?? (perfect ? 'Perfect!' : null));
      const small = Math.min(window.innerWidth, window.innerHeight) < 600;
      const ratio = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2);

      // Two layers, each on its own canvas. The stage: the day's scene, framed on its words (or, with
      // none, the goal word still). Over it, for a Perfect solve, the bubbles: on a clear canvas, so
      // they burst out of the word on the board, and the stage fades in as they pop away.
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setPixelRatio(ratio);
      el.prepend(renderer.domElement);
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);
      const art = day?.scene(THREE, { start, goal, theme: day.theme, small, cssColor }) ?? P.plainScene(THREE, { word: goal, cssColor });
      for (const o of art.objects) scene.add(o);

      const page = new THREE.Color().setRGB(...cssColor('--bg', '#17161c'), THREE.SRGBColorSpace);
      const rect = el.getBoundingClientRect();
      const toScreen = (q: Source) => ({ x: (q.x - rect.left - rect.width / 2) / (rect.height / 2), y: (rect.top + rect.height / 2 - q.y) / (rect.height / 2), color: q.color });
      const party = perfect ? C.confettiScene(THREE, { small, sources: (from?.() ?? []).map(toScreen), light: page.getHSL({ h: 0, s: 0, l: 0 }).l > 0.5 }) : null;
      const partyRenderer = party ? new THREE.WebGLRenderer({ antialias: true, alpha: true }) : null;
      const partyScene = new THREE.Scene();
      const partyCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);
      for (const o of party?.objects ?? []) partyScene.add(o);
      if (partyRenderer) {
        partyRenderer.setPixelRatio(ratio);
        partyRenderer.setClearColor(0x000000, 0);
        partyRenderer.domElement.className = 'party';
        renderer.domElement.after(partyRenderer.domElement);
      }

      // The timeline: the bubbles from 0, and the day's scene from D0 (fading in as the bubbles pop away).
      const timing = day?.theme.timing;
      const D0 = party ? C.CONFETTI.handoff : 0;
      const end = timing ? D0 + timing.settled : C.CONFETTI.length - 0.6;

      // Framing: the wider word takes 70% of the width (88% on a phone, which has height to spare),
      // or as much as the height allows.
      const span = Math.max(wordWidth(start), wordWidth(goal));
      const margin = art.margin ?? 0.4;
      let w = 0;
      let h = 0;
      let dirty = true;
      const resize = () => {
        w = el.clientWidth;
        h = el.clientHeight;
        renderer.setSize(w, h);
        partyRenderer?.setSize(w, h);
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
        if (!party || now() >= D0) return false;
        if (clock.live) clock.t0 = performance.now() - D0 * 1000;
        else clock.t = D0;
        dirty = true;
        return true;
      };
      resize();
      window.addEventListener('resize', resize);

      // The background: the day's opening colour, calming to the page's own (with no day's scene, the page's own).
      const storm = day ? new THREE.Color(day.theme.stormBg) : page.clone();
      const calm = timing ? D0 + timing.calm : end - 1;
      const bg = new THREE.Color();
      let shownNow = false;
      let raf = 0;
      const draw = () => {
        raf = requestAnimationFrame(draw);
        if (!clock.live && !dirty) return;
        dirty = false;
        const t = now();
        // The stage, faded in over the board as the bubbles give way to it.
        renderer.domElement.style.opacity = String(party ? smooth(D0 - 0.45, D0, t) : 1);
        art.update(Math.max(0, t - D0));
        renderer.setClearColor(bg.copy(storm).lerp(page, smooth(calm, end, t)));
        renderer.render(scene, camera);
        if (party && partyRenderer) {
          party.update(t, w / h);
          partyRenderer.render(partyScene, partyCamera);
        }
        const show = t >= end - 0.2;
        if (show !== shownNow) setShown((shownNow = show));
      };
      raf = requestAnimationFrame(draw);
      cleanup = () => {
        cancelAnimationFrame(raf);
        window.removeEventListener('resize', resize);
        art.dispose();
        party?.dispose();
        for (const r of [renderer, partyRenderer]) {
          if (!r) continue;
          r.dispose();
          r.forceContextLoss();
          r.domElement.remove();
        }
      };
    })().catch(() => !disposed && onClose());
    return () => {
      disposed = true;
      cleanup();
    };
  }, [start, goal, load, perfect, from, freezeAt, reduce]);

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

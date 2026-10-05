import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { floraScene } from './flora';
import type { CelebrationTheme } from './themes';
import { wordWidth } from './wordPoints';

interface Props {
  start: string;
  goal: string;
  theme: CelebrationTheme;
  /** The player's strokes, and the lowest possible. */
  strokes: number;
  best: number;
  /** Hints used on the way, if any. */
  hints?: number;
  /** Show one moment (seconds) and hold it, instead of playing: for previews and stills. */
  freezeAt?: number;
  onClose: () => void;
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
 * The win celebration, drawn live with three.js (loaded only when it plays): the start word runs
 * wild and is tamed into the goal word (see flora.ts). Tap, click or Escape to carry on.
 */
export function Celebration({ start, goal, theme, strokes, best, hints = 0, freezeAt, onClose }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [settled, setSettled] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const still = freezeAt ?? (reduce ? theme.timing.settled + 0.8 : undefined);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    (async () => {
      const THREE = await import('three');
      const el = host.current;
      if (disposed || !el) return;
      const small = Math.min(window.innerWidth, window.innerHeight) < 600;
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2));
      el.appendChild(renderer.domElement);
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);
      const art = floraScene(THREE, { start, goal, theme, small, cssColor });
      for (const obj of art.objects) scene.add(obj);

      // Fit the words to the screen: the wider of the two takes 70% of the width (88% on a phone,
      // which has height to spare), or as much as the height allows.
      const fit = () => {
        const w = el.clientWidth;
        const h = el.clientHeight;
        renderer.setSize(w, h);
        const span = Math.max(wordWidth(start), wordWidth(goal)) / (w < 600 ? 0.88 : 0.7);
        const unitsPerPx = Math.max(span / w, (2 + 2 * art.margin + 2.2) / h);
        camera.left = (-w / 2) * unitsPerPx;
        camera.right = (w / 2) * unitsPerPx;
        camera.top = (h / 2) * unitsPerPx;
        camera.bottom = (-h / 2) * unitsPerPx;
        camera.updateProjectionMatrix();
      };
      fit();
      window.addEventListener('resize', fit);

      // The background starts wild and calms to the page's own.
      const wildBg = new THREE.Color(theme.stormBg);
      const page = new THREE.Color().setRGB(...cssColor('--bg', '#17161c'), THREE.SRGBColorSpace);
      const bg = new THREE.Color();
      const { calm, settled } = theme.timing;
      let raf = 0;
      const t0 = performance.now();
      const draw = (now: number) => {
        const t = still ?? (now - t0) / 1000;
        art.update(t);
        const k = Math.min(1, Math.max(0, (t - calm) / (settled - calm)));
        renderer.setClearColor(bg.copy(wildBg).lerp(page, k * k * (3 - 2 * k)));
        renderer.render(scene, camera);
        if (t >= settled - 0.2) setSettled(true);
        if (still === undefined) raf = requestAnimationFrame(draw);
      };
      raf = requestAnimationFrame(draw);
      cleanup = () => {
        cancelAnimationFrame(raf);
        window.removeEventListener('resize', fit);
        art.dispose();
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
          {hints > 0 && ` · ${hints} ${hints === 1 ? 'hint' : 'hints'}`}
        </p>
        <p className="celebration-hint">Tap anywhere to carry on</p>
      </div>
    </div>
  );
}

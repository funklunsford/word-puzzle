import { useEffect, useRef } from 'react';
import { useReduceMotion } from '../prefs';

interface Props {
  /** Where the word's strokes are on screen, for the confetti to pop out of (asked as it starts; see inkSources). */
  from?: () => Source[];
  /** Show one moment (seconds from the start) and hold it, instead of playing: for previews and stills. */
  freezeAt?: number;
  /** Called once the confetti has fallen away (at once, with less motion). */
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

/**
 * The win celebration, for a solve in the lowest possible strokes (an Ace): confetti and sparkles pop
 * out of the word on the board and fall away (see confetti.ts), drawn live with three.js (loaded only
 * when it plays) on a clear canvas over the page. The page shows through and stays in play, and the
 * celebration closes once the confetti has fallen. With less motion it doesn't play.
 */
export function Celebration({ from, freezeAt, onClose }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const reduce = useReduceMotion();
  // The latest onClose, so a new one from the page doesn't restart the confetti.
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    if (reduce && freezeAt === undefined) {
      close.current();
      return;
    }
    let disposed = false;
    let cleanup = () => {};
    (async () => {
      const [THREE, C] = await Promise.all([import('three'), import('./confetti')]);
      const el = host.current;
      if (disposed || !el) return;
      const small = Math.min(window.innerWidth, window.innerHeight) < 600;

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2));
      renderer.setClearColor(0x000000, 0);
      el.append(renderer.domElement);
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);
      const rect = el.getBoundingClientRect();
      const toScreen = (q: Source) => ({ x: (q.x - rect.left - rect.width / 2) / (rect.height / 2), y: (rect.top + rect.height / 2 - q.y) / (rect.height / 2), color: q.color });
      const party = C.confettiScene(THREE, { small, sources: (from?.() ?? []).map(toScreen) });
      for (const o of party.objects) scene.add(o);

      let w = 0;
      let h = 0;
      let dirty = true;
      const resize = () => {
        w = el.clientWidth;
        h = el.clientHeight;
        renderer.setSize(w, h);
        camera.left = -w / h;
        camera.right = w / h;
        camera.updateProjectionMatrix();
        dirty = true;
      };
      resize();
      window.addEventListener('resize', resize);

      // The clock: playing from t0, or held at one moment (previews, stills).
      const t0 = performance.now();
      const now = () => freezeAt ?? (performance.now() - t0) / 1000;
      let raf = 0;
      const draw = () => {
        const t = now();
        if (freezeAt === undefined && t >= C.CONFETTI.length) return close.current();
        raf = requestAnimationFrame(draw);
        if (freezeAt !== undefined && !dirty) return;
        dirty = false;
        party.update(t, w / h);
        renderer.render(scene, camera);
      };
      raf = requestAnimationFrame(draw);
      cleanup = () => {
        cancelAnimationFrame(raf);
        window.removeEventListener('resize', resize);
        party.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
        renderer.domElement.remove();
      };
    })().catch(() => !disposed && close.current());
    return () => {
      disposed = true;
      cleanup();
    };
  }, [from, freezeAt, reduce]);

  return <div className="celebration" ref={host} aria-hidden="true" />;
}

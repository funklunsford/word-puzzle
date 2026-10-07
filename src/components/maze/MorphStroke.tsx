import { useEffect, useMemo, useRef } from 'react';
import { animate, motion, useMotionValue } from 'motion/react';
import { useReduceMotion } from '../../prefs';
import type { TileId } from '../../glyphs';
import { inkMorph, inkPath, strokeCenterline, type Pt } from '../../ink';

const SETTLE = { type: 'spring', bounce: 0, duration: 0.35 } as const;

interface Props {
  tile: TileId;
  /** Degrees clockwise. */
  rot: number;
  x?: number;
  y?: number;
  seed: number;
  minHalfWidth: number;
  squeeze?: number;
  fill?: string;
  /** The centreline its formed letter draws it along (relative to x, y; see lookCenterline), or none to draw it as itself. */
  look?: Pt[] | null;
  /**
   * The shape it's in when it appears: its own ('own': it was just dropped in), or a look (it was
   * lifted out of a formed letter). By default it appears as it should look, without easing.
   */
  from?: 'own' | Pt[];
}

/**
 * A stroke in ink that eases between its own shape and the look its formed letter gives it: U's
 * stems draw back to their top halves and its bar bends into the cup as the U forms, and
 * straighten again when it breaks.
 */
export function MorphStroke({ tile, rot, x = 0, y = 0, seed, minHalfWidth, squeeze = 1, fill, look, from }: Props) {
  const reduce = useReduceMotion();
  const own = useMemo(() => strokeCenterline(tile, rot, squeeze), [tile, rot, squeeze]);
  // The look it eases towards or back from (kept after the letter breaks, to ease back out of it).
  const shape = useRef<Pt[] | null>(look ?? (Array.isArray(from) ? from : null));
  if (look) shape.current = look;
  const t = useMotionValue(from === 'own' ? 0 : Array.isArray(from) ? 1 : look ? 1 : 0);

  const draw = (v: number) => {
    const s = shape.current;
    if (!s || v <= 0) return inkPath(own, seed, minHalfWidth);
    if (v >= 1) return inkPath(s, seed, minHalfWidth);
    return inkMorph(own, s, v, seed, minHalfWidth);
  };
  const d = useMotionValue(draw(t.get()));
  // Redraw as it eases, and whenever its shape or size changes (subscribed afresh each render so
  // `draw` sees the latest shape).
  useEffect(() => t.on('change', (v) => d.set(draw(v))));
  useEffect(() => d.set(draw(t.get())));

  const target = look ? 1 : 0;
  useEffect(() => {
    // A motion value eased by hand isn't covered by MotionConfig's reduced motion, so check here.
    if (reduce) {
      t.set(target);
      return;
    }
    const c = animate(t, target, SETTLE);
    return () => c.stop();
  }, [target, reduce, t]);

  return <motion.path className="ink" d={d} fill={fill ?? `var(--t-${tile})`} transform={x || y ? `translate(${x} ${y})` : undefined} />;
}

/** An invisible hit area along a centreline (relative to x, y), for a stroke drawn as its look. */
export const centerlinePath = (pts: Pt[]) =>
  `M${pts.filter((_, i) => i % 3 === 0 || i === pts.length - 1).map(([px, py]) => `${px.toFixed(3)} ${py.toFixed(3)}`).join(' L')}`;

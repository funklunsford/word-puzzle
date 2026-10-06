import { motion, useReducedMotion } from 'motion/react';
import { TileStroke, minHalfWidthAt } from '../Glyph';

// The demo's loop, in fractions of its length: the bar waits in the tray, is carried into the
// letter (I becomes L), stays a moment, and is back in the tray for the next go.
const LOOP = 4.2;
const T = [0, 0.14, 0.42, 0.5, 0.8, 0.86, 1];
const loop = { duration: LOOP, times: T, repeat: Infinity, ease: 'easeInOut' as const };

// Positions in letter units: the letter box on the left (an I, whose bar is at x = 1), a tray tile
// on the right with the bar in it.
const TRAY = { x: 4.9, y: 1.3 };
const FOOT = { x: 1.5, y: 2 }; // where the bar goes to make L

/**
 * A tiny, looping how-to: a bar is dragged from the tray into an I, which becomes L. A fingertip
 * carries it on a touch screen (the stroke rides above the finger), a cursor with a mouse. With
 * reduced motion it shows the result.
 */
export function HowToDemo({ touch }: { touch: boolean }) {
  const reduce = useReducedMotion();
  const pen = minHalfWidthAt(26);
  // The carried bar: hidden in the tray, carried over, settled into the L, then gone again.
  const carried = {
    x: [TRAY.x, TRAY.x, FOOT.x, FOOT.x, FOOT.x, FOOT.x, TRAY.x],
    y: [TRAY.y, TRAY.y, FOOT.y, FOOT.y, FOOT.y, FOOT.y, TRAY.y],
    opacity: [0, 1, 1, 1, 1, 0, 0],
    scale: [1, 1.12, 1.12, 1, 1, 1, 1],
  };
  // The pointer rides with the bar, then drifts back to the tray.
  const lift = touch ? 0.95 : 0.25;
  const pointer = {
    x: [TRAY.x, TRAY.x, FOOT.x, FOOT.x, TRAY.x, TRAY.x, TRAY.x],
    y: [TRAY.y + lift, TRAY.y + lift, FOOT.y + lift, FOOT.y + lift, TRAY.y + lift, TRAY.y + lift, TRAY.y + lift],
    opacity: [1, 1, 1, 0.9, 0.6, 1, 1],
  };
  const showL = [0, 0, 0, 1, 1, 0, 0];
  const showI = showL.map((v) => 1 - v);

  return (
    <svg className="how-demo" viewBox="-0.2 -0.75 6.6 4.05" role="img" aria-label="Demo: drag the bar from the tray into the I, and it becomes L">
      {/* The letter box, its stem (the I), and its label */}
      <rect className="how-demo-box" x={0} y={-0.55} width={3} height={3.1} rx={0.35} />
      <TileStroke tile="LV" x={1} y={1} minHalfWidth={pen} />
      {reduce ? (
        <TileStroke tile="H" x={FOOT.x} y={FOOT.y} minHalfWidth={pen} />
      ) : (
        <motion.g initial={false} animate={carried} transition={loop}>
          <TileStroke tile="H" x={0} y={0} minHalfWidth={pen} />
        </motion.g>
      )}
      <motion.text className="how-demo-label" x={1.5} y={3.05} initial={false} animate={{ opacity: reduce ? 0 : showI }} transition={loop}>
        I
      </motion.text>
      <motion.text className="how-demo-label" x={1.5} y={3.05} initial={false} animate={{ opacity: reduce ? 1 : showL }} transition={loop}>
        L
      </motion.text>
      {/* The tray tile, with the bar waiting in it */}
      <rect className="how-demo-tile" x={TRAY.x - 0.85} y={TRAY.y - 0.85} width={1.7} height={1.7} rx={0.35} />
      <motion.g initial={false} animate={{ opacity: reduce ? 1 : [1, 0, 0, 0, 0, 0.6, 1] }} transition={loop}>
        <TileStroke tile="H" x={TRAY.x} y={TRAY.y} minHalfWidth={pen} />
      </motion.g>
      {/* A fingertip or a cursor */}
      {!reduce && (
        <motion.g className="how-demo-pointer" initial={false} animate={pointer} transition={loop}>
          {touch ? (
            <circle r={0.32} />
          ) : (
            <path d="M0 0 L0 0.78 L0.2 0.6 L0.36 0.92 L0.48 0.86 L0.32 0.55 L0.58 0.55 Z" />
          )}
        </motion.g>
      )}
    </svg>
  );
}

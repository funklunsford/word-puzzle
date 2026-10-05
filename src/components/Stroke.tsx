import { useLayoutEffect, useRef } from 'react';
import { animate, motion, useMotionValue } from 'motion/react';
import { TILES, type Placement, type TileId } from '../glyphs';
import { TileStroke } from './Glyph';

/** Board tiles are drawn in a 2.4-unit-wide viewBox; strokes use the same box so scales line up. */
export const TILE_BOX = 2.4;

const SNAP = { type: 'spring', stiffness: 520, damping: 26, mass: 0.7 } as const;
const RETURN = { type: 'spring', stiffness: 260, damping: 30 } as const;

interface Props {
  part: Placement;
  /** Position of the stroke's center within the word layer, in px. */
  cx: number;
  cy: number;
  unit: number;
  delay: number;
  tileEl: (tile: TileId) => Element | null;
}

/** One stroke of a letter in the word line. Springs in from its board tile and back out again. */
export function Stroke({ part, cx, cy, unit, delay, tileEl }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const rot = part.rot ?? 0;
  // Start (and end) at the tile's board orientation so the stroke visibly turns into place.
  const boardRot = TILES[part.tile].display ?? 0;
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const scale = useMotionValue(1);
  const rotate = useMotionValue(rot);

  // Offset from this stroke's resting place to the center of its board tile.
  const toTile = () => {
    const src = tileEl(part.tile)?.getBoundingClientRect();
    const me = ref.current?.getBoundingClientRect();
    if (!src || !me) return null;
    return {
      x: src.left + src.width / 2 - (me.left + me.width / 2 - x.get()),
      y: src.top + src.height / 2 - (me.top + me.height / 2 - y.get()),
      scale: src.width / TILE_BOX / unit,
    };
  };

  useLayoutEffect(() => {
    const from = toTile();
    if (!from) return;
    x.set(from.x);
    y.set(from.y);
    scale.set(from.scale);
    rotate.set(boardRot);
    const opts = { ...SNAP, delay };
    const anims = [animate(x, 0, opts), animate(y, 0, opts), animate(scale, 1, opts), animate(rotate, rot, opts)];
    return () => anims.forEach((a) => a.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const size = TILE_BOX * unit;
  return (
    <motion.div
      ref={ref}
      className="word-stroke"
      style={{ left: cx - size / 2, top: cy - size / 2, width: size, height: size, x, y, scale, rotate }}
      variants={{
        gone: () => {
          const to = toTile();
          return to
            ? { ...to, rotate: boardRot, opacity: 0, transition: { ...RETURN, delay, opacity: { delay: delay + 0.25 } } }
            : { opacity: 0 };
        },
      }}
      exit="gone"
    >
      <svg viewBox={`${-TILE_BOX / 2} ${-TILE_BOX / 2} ${TILE_BOX} ${TILE_BOX}`} width={size} height={size}>
        <TileStroke tile={part.tile} />
      </svg>
    </motion.div>
  );
}

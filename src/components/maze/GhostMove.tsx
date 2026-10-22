import { useId } from 'react';
import { motion } from 'motion/react';
import { TILES, TRAY_TURN, type Placement, type TileId } from '../../glyphs';
import { inkSeed, strokeCenterline } from '../../ink';
import { slotKey } from '../../strokes';
import type { WordMove } from '../../tutorial';
import { TileStroke, minHalfWidthAt } from '../Glyph';
import { across, centerOffset, fingerLift, pointing, trayCentring } from './WordEditor';

/** Where an editor's letters and tray strokes are, in px from the corner of the box the ghost is drawn in. */
export interface Geo {
  /** Each cell's letter (0, 0), before the cell centres its letter. */
  cells: { ox: number; oy: number }[];
  /** Px per letter unit. */
  k: number;
  /** Each tray stroke's centre, and its size against the letters' (the tray draws them smaller). */
  tray: Partial<Record<TileId, { x: number; y: number; scale: number }>>;
  w: number;
  h: number;
}

/** Measure an editor's cells and tray inside `el` (the box the ghost is drawn in; a scaling card's scale is undone). */
export function measureGeo(el: HTMLElement, tray: readonly TileId[]): Geo | null {
  const r = el.getBoundingClientRect();
  const svgs = [...el.querySelectorAll<SVGSVGElement>('.cell svg')];
  if (!svgs.length || !el.offsetWidth) return null;
  const scale = r.width / el.offsetWidth;
  let k = 0;
  const cells = svgs.map((svg) => {
    const s = svg.getBoundingClientRect();
    const vb = svg.viewBox.baseVal;
    k = s.width / scale / vb.width;
    return { ox: (s.left - r.left) / scale - vb.x * k, oy: (s.top - r.top) / scale - vb.y * k };
  });
  const homes: Geo['tray'] = {};
  for (const t of tray) {
    const b = el.querySelector(`[data-tile="${t}"] svg`)?.getBoundingClientRect();
    if (!b) continue;
    // Where the tile's stroke is drawn (centred by eye, see trayCentring), in a 2.4-unit box.
    const [ox, oy] = trayCentring(t, TRAY_TURN[t]);
    const unit = b.width / scale / 2.4;
    homes[t] = { x: (b.left - r.left) / scale + b.width / scale / 2 + ox * unit, y: (b.top - r.top) / scale + b.height / scale / 2 + oy * unit, scale: unit / k };
  }
  return { cells, k, tray: homes, w: el.offsetWidth, h: el.offsetHeight };
}

/** A point on a stroke to press: the middle of a bar, partway along a chevron's arm. */
export function grabPoint(p: Placement) {
  const pts = strokeCenterline(p.tile, p.rot ?? 0);
  const [x, y] = pts[Math.round((pts.length - 1) * (p.tile === 'BV' ? 0.3 : 0.5))];
  return { x: p.x + x, y: p.y + y };
}

const CURSOR = 'M0 0 L0 0.78 L0.2 0.6 L0.36 0.92 L0.48 0.86 L0.32 0.55 L0.58 0.55 Z';

/**
 * A stroke that comes off, marked with a ✕ as well as its red: red alone is too weak a mark (some
 * strokes are a deep red already, and red-green colour blindness can't tell them apart). At (x, y),
 * sized by the letters' unit `k` (px).
 */
export function RemoveMark({ x, y, k }: { x: number; y: number; k: number }) {
  const r = Math.max(6.5, 0.34 * k);
  const a = 0.4 * r;
  return (
    <g className="mark-remove" transform={`translate(${x} ${y})`}>
      <circle r={r} />
      <path d={`M${-a} ${-a}L${a} ${a}M${a} ${-a}L${-a} ${a}`} />
    </g>
  );
}

/**
 * A stroke that goes on, outlined: a ring round its line (in units, at `k` px a unit), open in the
 * middle so the stroke shows through. The same mark for How to play's step and the coach's still ghost.
 */
export function AddMark({ p, k }: { p: Placement; k: number }) {
  // (React's ids carry characters a url(#…) reference may not take.)
  const id = `add${useId().replace(/[^\w-]/g, '')}`;
  const hole = 0.46;
  const ring = Math.max(1.6 / k, 0.08);
  const path = TILES[p.tile].path;
  const at = `translate(${p.x} ${p.y})${p.rot ? ` rotate(${p.rot})` : ''}`;
  return (
    <g className="mark-add" transform={at}>
      <mask id={id} maskUnits="userSpaceOnUse" x={-3} y={-3} width={6} height={6}>
        <path d={path} stroke="white" strokeWidth={hole + 2 * ring} fill="none" strokeLinecap="round" />
        <path d={path} stroke="black" strokeWidth={hole} fill="none" strokeLinecap="round" />
      </mask>
      <path d={path} className="mark-add-ring" strokeWidth={hole + 2 * ring} mask={`url(#${id})`} />
    </g>
  );
}

const wrap = (deg: number) => ((((deg + 180) % 360) + 360) % 360) - 180;

/**
 * The ghost: a fingertip or cursor doing a move over an editor, with a faint copy of the stroke (red
 * for one being removed), on a loop. A turn turns the stroke itself (the editor hides its ink
 * meanwhile: see its `ghosted`). `cells` are the letters before the move. With reduced motion
 * (`still`) it doesn't move: the stroke's new spot is outlined, or the stroke to remove crossed out
 * (a turn shows only the pointer, at the end of its swipe).
 */
export function GhostMove({ move, cells, geo, touch, still, maxDrawn }: { move: WordMove; cells: Placement[][]; geo: Geo; touch: boolean; still: boolean; maxDrawn: number | null }) {
  const { k } = geo;
  const plan = move.ghost;
  const pen = minHalfWidthAt(k);
  /** A point in a letter's own units, on the page: where the letter draws it (centred, squeezed). */
  const at = (cell: number, x: number, y: number, shape = cells[cell]) => {
    const c = geo.cells[cell] ?? geo.cells[0];
    return { x: c.ox + (across(cells[cell], shape, maxDrawn).x(x) + centerOffset(cells[cell])) * k, y: c.oy + y * k };
  };
  const lift = touch ? fingerLift(k) : 0;

  // Each move as keyframes: when (fractions of the loop), and where the pointer and the copy are.
  let times: number[];
  let duration: number;
  let pointer: { x: number[]; y: number[]; opacity: number[]; scale: number[] };
  let ring: number[] = [];
  let copy: { tile: TileId; rot: number; seed: number; fill?: string; x: number[]; y: number[]; opacity: number[]; scale: number[]; rotate: number[] };
  /** A turn: where the pointer presses the stroke, and where a mouse's swipe ends. */
  let press: { x: number; y: number } | null = null;
  let swipeTo: { x: number; y: number } | null = null;
  /** With reduced motion, the mark: the spot outlined (a carry), or the stroke crossed out. */
  let mark: { kind: 'add'; spot: { x: number; y: number } } | { kind: 'remove'; spot: { x: number; y: number }; x: number; y: number } | null = null;
  const hold = (n: number, v: number) => Array<number>(n).fill(v);

  if (plan.kind === 'carry') {
    const fromCell = move.from ?? move.cell;
    const fromTray = plan.from === 'tray';
    const source = fromTray ? null : (plan.from as Placement);
    // Where it lands: drawn as the letter will be with it there.
    const base = cells[move.cell].filter((q) => !(source && fromCell === move.cell && slotKey(q) === slotKey(source)));
    const to = at(move.cell, plan.to.x, plan.to.y, [...base, plan.to]);
    const home = fromTray ? geo.tray[plan.tile] : undefined;
    const src = source ? at(fromCell, source.x, source.y) : (home ?? to);
    const grab = source
      ? (() => {
          const g = grabPoint(source);
          const p = at(fromCell, g.x, g.y);
          return { x: p.x - src.x, y: p.y - src.y };
        })()
      : { x: 0, y: 0 };
    // A finger holds the stroke above it; a cursor keeps the point it grabbed.
    const hand = (c: { x: number; y: number }) => (touch ? { x: c.x, y: c.y + lift } : { x: c.x + grab.x, y: c.y + grab.y });
    const p0 = { x: src.x + grab.x, y: src.y + grab.y };
    const p1 = hand(to);
    const held = touch ? { x: p0.x, y: p0.y - lift } : src;
    times = [0, 0.08, 0.2, 0.3, 0.66, 0.74, 0.9, 1];
    duration = 2.6;
    pointer = {
      x: [p0.x, p0.x, p0.x, p0.x, p1.x, p1.x, p1.x, p1.x],
      y: [p0.y, p0.y, p0.y, p0.y, p1.y, p1.y, p1.y, p1.y],
      opacity: [0, 1, 1, 1, 1, 1, 0, 0],
      scale: [1, 1, 0.85, 0.85, 0.85, 1, 1, 1],
    };
    ring = [0, 0, 0.7, 0, 0, 0, 0, 0];
    const rot = plan.to.rot ?? 0;
    // From the tray it starts the size and way round it sits there, grows as it's lifted, and turns
    // to fit its spot on the way (a bar stands up to be G's chin), as the editor turns a held stroke.
    const s = home?.scale ?? 1;
    const r0 = wrap((source ? (source.rot ?? 0) : TRAY_TURN[plan.tile]) - rot);
    copy = {
      tile: plan.tile,
      rot,
      seed: inkSeed(plan.to),
      x: [src.x, src.x, src.x, held.x, to.x, to.x, to.x, to.x],
      y: [src.y, src.y, src.y, held.y, to.y, to.y, to.y, to.y],
      opacity: [0, 0, 0.75, 0.75, 0.75, 0.75, 0, 0],
      scale: fromTray ? [s, s, s * 1.08, 1.08, 1.08, 1, 1, 1] : [1, 1, 1.08, 1.08, 1.08, 1, 1, 1],
      rotate: [r0, r0, r0, r0, 0, 0, 0, 0],
    };
    mark = { kind: 'add', spot: to };
  } else if (plan.kind === 'turn') {
    // The stroke itself turns: the editor hides its ink while the ghost draws it here, at full
    // strength (a faint copy turning over on top of it drew a V and an A over each other). Then it
    // fades, comes back unturned, and rests there until the next go.
    const spot = at(move.cell, plan.at.x, plan.at.y);
    const g = grabPoint(plan.at);
    const p = at(move.cell, g.x, g.y);
    const rot = plan.at.rot ?? 0;
    press = p;
    if (touch) {
      // Two taps, and it turns over.
      times = [0, 0.1, 0.2, 0.28, 0.36, 0.44, 0.58, 0.8, 0.88, 0.9, 1];
      duration = 2.6;
      pointer = { x: hold(11, p.x), y: hold(11, p.y), opacity: [0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0], scale: [1, 1, 0.85, 1, 0.85, 1, 1, 1, 1, 1, 1] };
      ring = [0, 0, 0.7, 0, 0.7, 0, 0, 0, 0, 0, 0];
      copy = {
        tile: plan.at.tile,
        rot,
        seed: inkSeed(plan.at),
        x: hold(11, spot.x),
        y: hold(11, spot.y),
        opacity: [1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1],
        scale: hold(11, 1),
        rotate: [0, 0, 0, 0, 0, 0, 180, 180, 180, 0, 0],
      };
    } else {
      // Press it, swipe a little the way it will point (up for a V, right for a C), and let go: it
      // lifts, turns over on its spot as the swipe goes, and settles there. The swipe takes about a
      // second, slow enough to follow the stroke turning.
      times = [0, 0.08, 0.16, 0.46, 0.52, 0.68, 0.82, 0.88, 0.9, 1];
      duration = 3.6;
      const [dx, dy] = pointing(plan.at.tile, rot + 180);
      const to = { x: p.x + dx * 0.8 * k, y: p.y + dy * 0.8 * k };
      swipeTo = to;
      pointer = {
        x: [p.x, p.x, p.x, to.x, to.x, to.x, to.x, to.x, p.x, p.x],
        y: [p.y, p.y, p.y, to.y, to.y, to.y, to.y, to.y, p.y, p.y],
        opacity: [0, 1, 1, 1, 1, 1, 0, 0, 0, 0],
        scale: [1, 1, 0.85, 0.85, 1, 1, 1, 1, 1, 1],
      };
      copy = {
        tile: plan.at.tile,
        rot,
        seed: inkSeed(plan.at),
        x: hold(10, spot.x),
        y: hold(10, spot.y),
        opacity: [1, 1, 1, 1, 1, 1, 1, 0, 0, 1],
        scale: [1, 1, 1.08, 1.08, 1, 1, 1, 1, 1, 1],
        rotate: [0, 0, 0, 180, 180, 180, 180, 180, 0, 0],
      };
    }
  } else {
    // Point at the stroke, tap or click (with a mouse it reddens first, as hovering does), and it goes.
    const spot = at(move.cell, plan.at.x, plan.at.y);
    const g = grabPoint(plan.at);
    const p = at(move.cell, g.x, g.y);
    const near = { x: p.x + 0.9 * k, y: p.y + 1 * k };
    times = [0, 0.1, 0.32, 0.42, 0.62, 0.8, 1];
    duration = 2.2;
    pointer = { x: [near.x, near.x, p.x, p.x, p.x, p.x, p.x], y: [near.y, near.y, p.y, p.y, p.y, p.y, p.y], opacity: [0, 1, 1, 1, 1, 0, 0], scale: [1, 1, 1, 0.85, 1, 1, 1] };
    ring = [0, 0, 0, 0.7, 0, 0, 0];
    copy = {
      tile: plan.at.tile,
      rot: plan.at.rot ?? 0,
      seed: inkSeed(plan.at),
      fill: 'var(--remove)',
      x: hold(7, spot.x),
      y: [spot.y, spot.y, spot.y, spot.y, spot.y + 0.35 * k, spot.y + 0.35 * k, spot.y + 0.35 * k],
      opacity: touch ? [0, 0, 0, 0.85, 0, 0, 0] : [0, 0, 0.85, 0.85, 0, 0, 0],
      scale: [1, 1, 1, 1, 0.8, 0.8, 0.8],
      rotate: hold(7, 0),
    };
    mark = { kind: 'remove', spot, ...p };
  }

  const stroke = (fill?: string) => (
    <g transform={`scale(${k})`}>
      <TileStroke tile={copy.tile} rot={copy.rot} seed={copy.seed} minHalfWidth={pen} fill={fill} />
    </g>
  );

  if (still && press) {
    // A turn holding still: no copy (turned over where it sits, it would lie on top of the stroke),
    // just the finger tapping it, or the cursor at the end of its swipe with the swipe drawn.
    const end = swipeTo ?? press;
    return (
      <svg className="ghost-hand" width={geo.w} height={geo.h} viewBox={`0 0 ${geo.w} ${geo.h}`} aria-hidden="true">
        {swipeTo && <line className="ghost-trail" x1={press.x} y1={press.y} x2={swipeTo.x} y2={swipeTo.y} />}
        <g transform={`translate(${end.x} ${end.y})`}>
          {touch ? (
            <>
              <circle className="ghost-ring" r={0.75 * k} opacity={0.7} />
              <circle className="ghost-finger" r={0.5 * k} />
            </>
          ) : (
            <path className="ghost-cursor" d={CURSOR} transform={`scale(${0.95 * k})`} />
          )}
        </g>
      </svg>
    );
  }
  if (still && mark) {
    // Where the move leaves the stroke, outlined; or the stroke that comes off, red and crossed out.
    return (
      <svg className="ghost-hand" width={geo.w} height={geo.h} viewBox={`0 0 ${geo.w} ${geo.h}`} aria-hidden="true">
        <g transform={`translate(${mark.spot.x} ${mark.spot.y})`}>
          {mark.kind === 'add' ? (
            <>
              <g opacity={0.55}>{stroke()}</g>
              <g transform={`scale(${k})`}>
                <AddMark p={{ tile: copy.tile, x: 0, y: 0, rot: copy.rot }} k={k} />
              </g>
            </>
          ) : (
            stroke('var(--remove)')
          )}
        </g>
        {mark.kind === 'remove' && <RemoveMark x={mark.x} y={mark.y} k={k} />}
      </svg>
    );
  }

  const loop = { duration, times, repeat: Infinity, repeatDelay: 0.8, ease: 'easeInOut' as const };
  return (
    <svg className="ghost-hand" width={geo.w} height={geo.h} viewBox={`0 0 ${geo.w} ${geo.h}`} aria-hidden="true">
      <motion.g initial={false} animate={{ x: copy.x, y: copy.y, opacity: copy.opacity, scale: copy.scale }} transition={loop}>
        <motion.g initial={false} animate={{ rotate: copy.rotate }} transition={loop}>
          {stroke(copy.fill)}
        </motion.g>
      </motion.g>
      <motion.g initial={false} animate={{ x: pointer.x, y: pointer.y, opacity: pointer.opacity }} transition={loop}>
        {ring.length > 0 && (
          <motion.circle className="ghost-ring" r={0.75 * k} initial={false} animate={{ opacity: ring, scale: ring.map((o) => (o ? 1.3 : 0.6)) }} transition={loop} />
        )}
        <motion.g initial={false} animate={{ scale: pointer.scale }} transition={loop}>
          {touch ? <circle className="ghost-finger" r={0.5 * k} /> : <path className="ghost-cursor" d={CURSOR} transform={`scale(${0.95 * k})`} />}
        </motion.g>
      </motion.g>
    </svg>
  );
}

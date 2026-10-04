import { useEffect, useMemo, useRef, useState } from 'react';
import { animate, motion, useMotionValue, useReducedMotion } from 'motion/react';
import { LETTERS, TILES, TILE_IDS, xExtent, type Placement, type TileId } from '../../glyphs';
import { inkSeed, lookCenterline, type Pt } from '../../ink';
import { EMPTY_CELL_X, formedLooks, recognize, slotKey, slotsFor, type Slot } from '../../strokes';
import { TileStroke, minHalfWidthAt } from '../Glyph';
import { MorphStroke, centerlinePath } from './MorphStroke';

const CELL_W = 4;
const CELL_TOP = -0.7;
const CELL_H = 3.6;
/** A press that moves less than this many pixels is a tap (remove), not a drag. */
const TAP_SLOP = 6;
/** Tray tiles draw their 2.4-unit box in about 40 px. */
const TRAY_PX_PER_UNIT = 40 / 2.4;

// Springs, in Apple's terms (damping ratio → Motion's bounce, response → duration).
/** Things moving on their own: critically damped, no overshoot. */
const SETTLE = { type: 'spring', bounce: 0, duration: 0.35 } as const;
/** The held stroke gliding onto a spot or back to the cursor: quick, no overshoot. */
const GLIDE = { type: 'spring', bounce: 0, duration: 0.18 } as const;
/** A released stroke springing into its slot: a little give, because the drag carried momentum. */
const LAND = { type: 'spring', bounce: 0.2, duration: 0.4 } as const;
/** How much a stroke grows when it's picked up. */
const LIFT = 1.08;

// Twisting, only when starting a new letter in an empty cell (units, in the cell's coordinates).
// Bring the cursor within ARM of the spot the stroke is locked onto, then circle the cursor around
// the spot to turn it; straight moves don't turn it. Moving further than RELEASE from the spot lets
// the stroke lock onto a different spot.
const ARM = 0.45;
const RELEASE = 1.6;

const norm = (deg: number) => ((deg % 360) + 360) % 360;
/** Shortest signed angle from one direction to another, in degrees. */
const wrap = (deg: number) => norm(deg + 180) - 180;
/** The quarter turn nearest to `turn` (unwrapped, so turn − quarter is the leftover twist). */
const quarter = (turn: number) => Math.round(turn / 90) * 90;

type Source = { kind: 'tray' } | { kind: 'cell'; cell: number; index: number };

/** The spot a rotatable stroke is locked onto while it's held over a cell. */
interface Aim {
  cell: number;
  x: number;
  y: number;
  /** The cursor has been brought onto the spot, so circling it now twists the stroke. */
  armed: boolean;
  /** Cursor's last angle around the spot (degrees), or null when it's too close to measure. */
  angle: number | null;
}

interface Drag {
  tile: TileId;
  source: Source;
  /** Where the press started, to tell a tap from a drag. */
  startX: number;
  startY: number;
  /** Set once the pointer has moved TAP_SLOP away: only then is the press a drag. */
  moved: boolean;
  /** Orientation of the held stroke in degrees (continuous while it's being twisted). */
  turn: number;
  /** Valid drop slots per cell (every orientation that fits), computed when the drag starts. */
  slots: Slot[][];
  aim: Aim | null;
  /** Where a release would place the stroke, if its current orientation fits there. */
  target: { cell: number; slot: Slot } | null;
  /** The cell under the pointer: the only one that previews (and accepts) a drop. */
  overCell: number | null;
  /** The look it had in a formed letter when picked up (U's cup), so it eases back to itself as it lifts. */
  look0: Pt[] | null;
}

/** A released stroke's starting pose relative to its slot (cell units), so it springs in from there. */
interface Landing {
  x: number;
  y: number;
  scale: number;
  rotate: number;
  vx: number;
  vy: number;
}

interface Props {
  cells: Placement[][];
  unit: number;
  disabled: boolean;
  /** The current room; when it changes (a door opened) the word briefly glows. */
  room: string;
  onEdit: (next: Placement[][]) => void;
  onHoverTile: (tile: TileId | null) => void;
}

/** The centrelines a cell's strokes are drawn along: their formed letter's looks, or null where a stroke is drawn as itself. */
function lookPoints(content: Placement[]): (Pt[] | null)[] {
  const looks = formedLooks(content);
  return content.map((p, i) => (looks?.[i] ? lookCenterline(p, looks[i]!) : null));
}

/** Offset that centers a cell's strokes horizontally. */
function centerOffset(content: Placement[]): number {
  if (!content.length) return -EMPTY_CELL_X;
  const [lo, hi] = xExtent(content);
  return -(lo + hi) / 2;
}

/**
 * Strokes that ever need a twist: some spot fits them more than one way (a chevron as V or A in an
 * empty cell, a bowl under a stem as B's or U's). Everything else turns to fit on its own.
 */
const TWISTS = new Set(
  TILE_IDS.filter((t) =>
    [[], ...Object.values(LETTERS).flatMap((g) => g.parts.map((_, i) => g.parts.filter((__, k) => k !== i)))].some((content) => {
      const spots = slotsFor(content, t).map((s) => `${s.placement.x},${s.placement.y}`);
      return new Set(spots).size < spots.length;
    }),
  ),
);

/**
 * The current word as editable strokes, plus the tray of strokes to drag in. Drag a stroke in
 * from the tray, drag a placed stroke to move it, tap a placed stroke to remove it, and twist chevrons, arcs and bowls by circling the cursor around a spot that fits them more than one way.
 *
 * The held stroke lives in a floating layer for its whole life: it lifts from where it sits,
 * follows the cursor at the point it was grabbed, glides onto spots, and either springs into its
 * slot from where it was released or flies back to its tray tile.
 */
export function WordEditor({ cells, unit, disabled, room, onEdit, onHoverTile }: Props) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const [hover, setHover] = useState<{ cell: number; key: string } | null>(null);
  /** A stroke flying home to its tray tile after the drag ended (removed, or not placed). */
  const [flight, setFlight] = useState<{ id: number; tile: TileId } | null>(null);
  const [glow, setGlow] = useState(false);
  const dragRef = useRef<Drag | null>(null);
  const svgs = useRef<(SVGSVGElement | null)[]>([]);
  const trayEls = useRef(new Map<TileId, HTMLElement>());
  const landings = useRef(new Map<string, Landing>());
  const reduce = useReducedMotion();

  // The floating stroke: centre (screen px), scale (1 = word size) and extra rotation (flights).
  const gx = useMotionValue(0);
  const gy = useMotionValue(0);
  const gs = useMotionValue(1);
  const gr = useMotionValue(0);
  const grip = useRef({ dx: 0, dy: 0, scale0: 1, snapped: false, scaleTo: 1, flightId: 0 });
  const samples = useRef<{ t: number; x: number; y: number }[]>([]);

  const offsets = useMemo(() => cells.map(centerOffset), [cells]);
  const minHalf = minHalfWidthAt(unit);

  // Landings are read when their stroke mounts, so they only need to live for one commit.
  useEffect(() => {
    landings.current.clear();
  });

  // A door opened: the word glows briefly.
  const firstRoom = useRef(room);
  useEffect(() => {
    if (room === firstRoom.current) return;
    firstRoom.current = room;
    setGlow(true);
    const t = setTimeout(() => setGlow(false), 900);
    return () => clearTimeout(t);
  }, [room]);

  const without = (cell: number, source: Source | undefined) =>
    source?.kind === 'cell' && source.cell === cell ? cells[cell].filter((_, i) => i !== source.index) : cells[cell];

  /** Screen position of a point in a cell's coordinates. */
  const screenOf = (cell: number, x: number, y: number) => {
    const m = svgs.current[cell]?.getScreenCTM();
    if (!m) return null;
    const p = new DOMPoint(x + offsets[cell], y).matrixTransform(m);
    return { x: p.x, y: p.y };
  };

  /** Where a tray tile's stroke sits on screen, and its size relative to the word's strokes. */
  const trayHome = (tile: TileId) => {
    const r = trayEls.current.get(tile)?.querySelector('svg')?.getBoundingClientRect();
    return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2, scale: r.width / 2.4 / unit } : null;
  };

  /** Pointer velocity (px/s) over the last tenth of a second. */
  const velocity = () => {
    const s = samples.current;
    const last = s[s.length - 1];
    const first = s.find((p) => last && last.t - p.t <= 100) ?? last;
    if (!last || !first || last.t === first.t) return { x: 0, y: 0 };
    const dt = (last.t - first.t) / 1000;
    return { x: (last.x - first.x) / dt, y: (last.y - first.y) / dt };
  };

  /** Where the held stroke is over the word: the cell, the spot it's locked onto, its twist, and the drop. */
  const locate = (d: Drag, x: number, y: number): Pick<Drag, 'target' | 'aim' | 'turn' | 'overCell'> => {
    const inside = (el: Element | null | undefined) => {
      const r = el?.getBoundingClientRect();
      return !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    };
    const toCell = (cell: number) => {
      const m = svgs.current[cell]?.getScreenCTM();
      if (!m) return null;
      const p = new DOMPoint(x, y).matrixTransform(m.inverse());
      return { lx: p.x - offsets[cell], ly: p.y };
    };
    // A stroke on a spot keeps it while the cursor stays nearby, even past the cell's edge
    // (a V's partner spot for W sits right at the edge).
    let overCell: number | null = null;
    const onSpot = d.aim ?? (d.target && { cell: d.target.cell, x: d.target.slot.placement.x, y: d.target.slot.placement.y });
    if (onSpot) {
      const q = toCell(onSpot.cell);
      if (q && Math.hypot(q.lx - onSpot.x, q.ly - onSpot.y) <= RELEASE) overCell = onSpot.cell;
    }
    if (overCell === null) {
      const c = svgs.current.findIndex((el) => inside(el));
      overCell = c >= 0 ? c : null;
    }
    const local = overCell !== null ? toCell(overCell) : null;
    if (overCell === null || !local || !d.slots[overCell].length) {
      return { overCell, target: null, aim: null, turn: d.turn };
    }
    const { lx, ly } = local;
    const slots = d.slots[overCell];
    const dist = (q: { x: number; y: number }) => Math.hypot(q.x - lx, q.y - ly);
    const nearest = slots.reduce((a, b) => (dist(b.placement) < dist(a.placement) ? b : a));

    // Fixed strokes simply go to the nearest spot.
    if (!TILES[d.tile].rotates) return { overCell, target: { cell: overCell, slot: nearest }, aim: null, turn: d.turn };

    // A spot that fits the stroke only one way takes it that way, following the nearest spot on
    // every move: a second chevron beside a V, the bar upright for Y, K's chevron on its side, a
    // bowl under "||" for U. Only a spot that fits it several ways needs a twist (a chevron as V or
    // A in an empty cell; a bowl under a stem as B's or U's), and once the cursor is circling one,
    // it stays locked there (within RELEASE) so the twist isn't interrupted.
    const twisting = !!d.aim && d.aim.cell === overCell && d.aim.armed && dist(d.aim) <= RELEASE;
    const ways = slots.filter((s) => s.placement.x === nearest.placement.x && s.placement.y === nearest.placement.y);
    if (!twisting && ways.length === 1) {
      const turn = d.turn + wrap((nearest.placement.rot ?? 0) - d.turn);
      return { overCell, target: { cell: overCell, slot: nearest }, aim: null, turn };
    }

    // Rotatable strokes lock onto a spot; circling the cursor around it turns them.
    let aim = d.aim;
    const stray = !aim || aim.cell !== overCell || dist(aim) > RELEASE;
    if (stray && (!aim || aim.cell !== overCell || aim.x !== nearest.placement.x || aim.y !== nearest.placement.y)) {
      aim = { cell: overCell, x: nearest.placement.x, y: nearest.placement.y, armed: false, angle: null };
    }
    let turn = d.turn;
    if (dist(aim!) < ARM) {
      aim = { ...aim!, armed: true, angle: null };
    } else if (aim!.armed) {
      const angle = (Math.atan2(ly - aim!.y, lx - aim!.x) * 180) / Math.PI;
      if (aim!.angle !== null) turn += wrap(angle - aim!.angle);
      aim = { ...aim!, angle };
    }
    const q = norm(quarter(turn));
    const slot = slots.find((s) => s.placement.x === aim!.x && s.placement.y === aim!.y && norm(s.placement.rot ?? 0) === q);
    return { overCell, target: slot ? { cell: overCell, slot } : null, aim, turn };
  };

  /** Move the floating stroke: glide onto the spot it's locked to, else follow the cursor at the grip. */
  const steer = (d: Drag, px: number, py: number) => {
    const g = grip.current;
    const spot = d.target ? { cell: d.target.cell, ...d.target.slot.placement } : d.aim;
    const at = spot ? screenOf(spot.cell, spot.x, spot.y) : null;
    const scaleTo = at ? 1 : LIFT;
    if (scaleTo !== g.scaleTo) {
      g.scaleTo = scaleTo;
      if (reduce) gs.set(scaleTo);
      else animate(gs, scaleTo, SETTLE);
    }
    if (at) {
      if (reduce) (gx.set(at.x), gy.set(at.y));
      else (animate(gx, at.x, GLIDE), animate(gy, at.y, GLIDE));
      g.snapped = true;
      return;
    }
    // Keep the grabbed point of the stroke under the cursor as the stroke grows.
    const k = gs.get() / g.scale0;
    const tx = px - g.dx * k;
    const ty = py - g.dy * k;
    if (!reduce && (g.snapped || gx.isAnimating())) (animate(gx, tx, GLIDE), animate(gy, ty, GLIDE));
    else (gx.set(tx), gy.set(ty));
    g.snapped = false;
  };

  /** Let a placed stroke spring into its slot from wherever the floating stroke is now. */
  const land = (cell: number, p: Placement, turn: number) => {
    const at = screenOf(cell, p.x, p.y);
    if (!at || reduce) return;
    const v = velocity();
    landings.current.set(`${cell}|${slotKey(p)}`, {
      x: (gx.get() - at.x) / unit,
      y: (gy.get() - at.y) / unit,
      scale: gs.get(),
      rotate: wrap(turn - (p.rot ?? 0)),
      vx: v.x / unit,
      vy: v.y / unit,
    });
  };

  /** Fly the floating stroke back into its tray tile (it was removed, or found no spot). */
  const flyHome = (d: Drag) => {
    const home = trayHome(d.tile);
    if (!home || reduce) return;
    const id = ++grip.current.flightId;
    setFlight({ id, tile: d.tile });
    // The floating stroke switches to the tray's orientation and turns there from its own.
    gr.set(wrap(d.turn - (TILES[d.tile].display ?? 0)));
    animate(gx, home.x, SETTLE);
    animate(gy, home.y, SETTLE);
    animate(gr, 0, SETTLE);
    animate(gs, home.scale, SETTLE).then(() => setFlight((f) => (f?.id === id ? null : f)));
  };

  const finish = (d: Drag) => {
    const next = cells.map((c) => [...c]);
    const from = d.source.kind === 'cell' ? d.source : null;
    const original = from ? cells[from.cell][from.index] : null;
    const remove = () => {
      if (!from) return;
      next[from.cell].splice(from.index, 1);
      onEdit(next);
    };
    if (!d.moved) {
      // A tap removes a placed stroke; a tray stroke that was only pressed goes back.
      remove();
      flyHome(d);
      return;
    }
    if (d.target) {
      const p = d.target.slot.placement;
      land(d.target.cell, p, d.turn);
      if (from && from.cell === d.target.cell && slotKey(original!) === slotKey(p)) return; // dropped where it was
      if (from) next[from.cell].splice(from.index, 1);
      next[d.target.cell].push(p);
      onEdit(next);
      return;
    }
    // Nowhere to go: a placed stroke springs back to its slot, a tray stroke back to the tray.
    if (from && original) land(from.cell, original, d.turn);
    else flyHome(d);
  };

  // Listeners are attached synchronously on pointer-down (not in an effect) so a quick flick
  // can't release before they exist.
  const start = (e: React.PointerEvent, tile: TileId, rot: number, source: Source, home: { x: number; y: number; scale: number } | null, look0: Pt[] | null = null) => {
    if (disabled || dragRef.current || !home) return;
    e.preventDefault();
    // Lift the stroke from exactly where it sits, keeping the point that was grabbed.
    const g = grip.current;
    g.flightId++;
    setFlight(null);
    [gx, gy, gs, gr].forEach((v) => v.stop());
    gx.set(home.x);
    gy.set(home.y);
    gr.set(0);
    gs.set(home.scale);
    const reach = 0.8 * unit * home.scale;
    g.dx = Math.max(-reach, Math.min(reach, e.clientX - home.x));
    g.dy = Math.max(-reach, Math.min(reach, e.clientY - home.y));
    g.scale0 = home.scale;
    g.snapped = false;
    g.scaleTo = home.scale * LIFT;
    if (reduce) gs.set(g.scaleTo);
    else animate(gs, g.scaleTo, SETTLE);
    samples.current = [{ t: performance.now(), x: e.clientX, y: e.clientY }];

    const slots = cells.map((_, c) => slotsFor(without(c, source), tile));
    const d0: Drag = {
      tile,
      source,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
      turn: rot,
      slots,
      aim: null,
      target: null,
      overCell: null,
      look0,
    };
    dragRef.current = d0;
    setDrag(d0);
    setHover(null);
    const update = (ev: PointerEvent) => {
      const d = dragRef.current!;
      samples.current = [...samples.current.slice(-5), { t: performance.now(), x: ev.clientX, y: ev.clientY }];
      const moved = d.moved || Math.hypot(ev.clientX - d.startX, ev.clientY - d.startY) >= TAP_SLOP;
      const nd = { ...d, moved, ...(moved ? locate(d, ev.clientX, ev.clientY) : {}) };
      dragRef.current = nd;
      // An automatic turn (snapping into an existing letter) is animated; twisting follows the cursor.
      if (nd.turn !== d.turn && !nd.aim && !reduce) {
        gr.set(gr.get() + d.turn - nd.turn);
        animate(gr, 0, SETTLE);
      }
      if (moved) steer(nd, ev.clientX, ev.clientY);
      return nd;
    };
    const onMove = (ev: PointerEvent) => setDrag(update(ev));
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      const d = update(ev);
      dragRef.current = null;
      setDrag(null);
      onHoverTile(null);
      if (ev.type === 'pointerup') finish(d);
      else flyHome(d);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  /** Press on a placed stroke. Looked up by position, so a stale press can't grab the wrong one. */
  const pressPlaced = (e: React.PointerEvent, cell: number, p: Placement, x: number) => {
    const index = cells[cell].findIndex((q) => slotKey(q) === slotKey(p));
    const at = screenOf(cell, x, p.y);
    if (index >= 0) start(e, p.tile, p.rot ?? 0, { kind: 'cell', cell, index }, at && { ...at, scale: 1 }, lookPoints(cells[cell])[index]);
  };

  const held = drag?.moved ? drag : null;
  // The pressed stroke leaves its cell for the floating layer from the moment it's pressed.
  const carried = drag?.source.kind === 'cell' ? drag.source : null;
  const floating = drag
    ? { tile: drag.tile, turn: drag.turn, red: !!held?.aim && !held.target, lifted: true, look0: drag.look0 }
    : flight
      ? { tile: flight.tile, turn: TILES[flight.tile].display ?? 0, red: false, lifted: false, look0: null }
      : null;

  return (
    <div className={`editor${disabled ? ' disabled' : ''}`}>
      <div className={`word-cells${glow ? ' opened' : ''}`}>
        {cells.map((content, c) => {
          const letter = recognize(content);
          const squeeze = (letter && LETTERS[letter].squeeze) || 1;
          const [lo, hi] = content.length ? xExtent(content) : [0, 0];
          const squeezed = (x: number) => (lo + hi) / 2 + (x - (lo + hi) / 2) * squeeze;
          // A formed letter may draw its strokes with curves they don't have (U's cup); see Look.
          // Looks follow what's left in the cell, so lifting U's bar straightens its stems.
          const kept = content.filter((_, i) => !(carried?.cell === c && carried.index === i));
          const looks = lookPoints(kept);
          const shown = kept.map((p, i) => ({ p, look: looks[i] }));
          const target = held?.target?.cell === c ? held.target : null;
          const aim = held?.aim?.cell === c ? held.aim : null;
          // Nothing fits here, or the held stroke's current orientation doesn't: the letter goes red.
          const noFit = !!held && held.overCell === c && !held.slots[c].length;
          const misfit = !!aim && !target;
          const red = noFit || misfit;
          return (
            <div className={`cell${letter ? ' formed' : ''}${red ? ' red' : ''}`} key={c}>
              <svg
                ref={(el) => {
                  svgs.current[c] = el;
                }}
                viewBox={`${-CELL_W / 2} ${CELL_TOP} ${CELL_W} ${CELL_H}`}
                width={CELL_W * unit}
                height={CELL_H * unit}
              >
                <motion.g className="cell-content" initial={false} animate={{ x: offsets[c] }} transition={SETTLE}>
                  {shown.map(({ p, look }) => {
                    const key = slotKey(p);
                    const x = squeezed(p.x);
                    const hovered = !drag && !disabled && hover?.cell === c && hover.key === key;
                    const landing = landings.current.get(`${c}|${key}`);
                    return (
                      <motion.g
                        key={key}
                        className={`placed${hovered ? ' hovered' : ''}`}
                        initial={landing ? { x: landing.x, y: landing.y, scale: landing.scale, rotate: landing.rotate } : { opacity: 0 }}
                        animate={{ x: 0, y: 0, rotate: 0, opacity: 1, scale: hovered ? 1.06 : 1 }}
                        transition={
                          landing
                            ? { ...LAND, x: { ...LAND, velocity: landing.vx }, y: { ...LAND, velocity: landing.vy } }
                            : { ...SETTLE, opacity: { duration: 0.15 } }
                        }
                      >
                        {/* Eases into its formed letter's look and back (U's bar bends into the cup). */}
                        <MorphStroke
                          tile={p.tile}
                          rot={p.rot ?? 0}
                          x={x}
                          y={p.y}
                          seed={inkSeed(p)}
                          minHalfWidth={minHalf}
                          squeeze={squeeze}
                          fill={red ? 'var(--spicy)' : undefined}
                          look={look}
                          from={landing ? 'own' : undefined}
                        />
                        {/* The hit area follows what's drawn, so tapping U's cup takes the bar, not a stem. */}
                        <path
                          className="hit"
                          d={look ? centerlinePath(look) : TILES[p.tile].path}
                          transform={
                            look
                              ? `translate(${x} ${p.y})`
                              : `translate(${x} ${p.y})${squeeze !== 1 ? ` scale(${squeeze} 1)` : ''}${p.rot ? ` rotate(${p.rot})` : ''}`
                          }
                          onPointerDown={(e) => pressPlaced(e, c, p, x)}
                          onPointerEnter={() => {
                            onHoverTile(p.tile);
                            if (!dragRef.current) setHover({ cell: c, key });
                          }}
                          onPointerLeave={() => {
                            onHoverTile(null);
                            setHover(null);
                          }}
                        >
                          <title>Tap to remove · drag to move</title>
                        </path>
                      </motion.g>
                    );
                  })}
                </motion.g>
              </svg>
              <span className="cell-letter">
                {target ? `→ ${target.slot.toward.join(' ')}` : misfit ? 'circle to turn' : noFit ? 'no fit' : (letter ?? '·')}
              </span>
            </div>
          );
        })}
      </div>

      <div className="tray">
        {TILE_IDS.map((t) => {
          const taken = (drag?.source.kind === 'tray' && drag.tile === t) || flight?.tile === t;
          return (
            <button
              key={t}
              ref={(el) => {
                if (el) trayEls.current.set(t, el);
              }}
              className={`tray-tile${taken ? ' taken' : ''}`}
              style={{ ['--tile' as string]: `var(--t-${t})` }}
              title={TWISTS.has(t) ? `${TILES[t].name}: where it fits a spot either way round, circle the cursor around the spot to turn it` : TILES[t].name}
              onPointerDown={(e) => start(e, t, TILES[t].display ?? 0, { kind: 'tray' }, trayHome(t))}
              onPointerEnter={() => onHoverTile(t)}
              onPointerLeave={() => onHoverTile(null)}
            >
              <svg viewBox="-1.2 -1.2 2.4 2.4">
                <TileStroke tile={t} rot={TILES[t].display} minHalfWidth={minHalfWidthAt(TRAY_PX_PER_UNIT)} />
              </svg>
            </button>
          );
        })}
      </div>

      {floating && (
        <motion.svg
          className={`floating${floating.lifted ? ' lifted' : ''}`}
          viewBox="-1.2 -1.2 2.4 2.4"
          width={2.4 * unit}
          height={2.4 * unit}
          style={{ left: -1.2 * unit, top: -1.2 * unit, x: gx, y: gy, scale: gs, rotate: gr }}
        >
          <Turned
            tile={floating.tile}
            turn={floating.turn}
            minHalfWidth={minHalf}
            fill={floating.red ? 'var(--spicy)' : undefined}
            from={floating.look0 ?? undefined}
          />
        </motion.svg>
      )}
    </div>
  );
}

/**
 * A stroke at any angle: inked at the nearest quarter turn, then turned the rest of the way. One
 * lifted out of a formed letter starts in that letter's look (`from`) and eases back to itself.
 */
function Turned({ tile, turn, minHalfWidth, fill, from }: { tile: TileId; turn: number; minHalfWidth: number; fill?: string; from?: Pt[] }) {
  const q = quarter(turn);
  return (
    <g transform={turn !== q ? `rotate(${turn - q})` : undefined}>
      <MorphStroke tile={tile} rot={norm(q)} seed={inkSeed({ tile, x: 0, y: 0, rot: norm(q) })} minHalfWidth={minHalfWidth} fill={fill} from={from} />
    </g>
  );
}

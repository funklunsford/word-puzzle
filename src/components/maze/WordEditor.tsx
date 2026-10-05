import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { animate, motion, useMotionValue, useReducedMotion } from 'motion/react';
import { LETTERS, TILES, TILE_IDS, xExtent, type Placement, type TileId } from '../../glyphs';
import { inkSeed, lookCenterline, type Pt } from '../../ink';
import { EMPTY_CELL_X, formedLooks, recognize, slotKey, slotsFor, type Slot } from '../../strokes';
import { TileStroke, minHalfWidthAt } from '../Glyph';
import { MorphStroke, centerlinePath } from './MorphStroke';
import { COARSE, useMedia } from '../../useMedia';

const CELL_W = 4;
/**
 * On phones the cells are just wide enough for the widest letter (a formed W, 2.5 units plus its
 * pen; a half-built W spills over its neighbours for a moment), so the four of them draw the word big.
 */
const CELL_W_COMPACT = 2.6;
const CELL_TOP = -0.7;
const CELL_H = 3.6;
/** A press that moves less than this many pixels is a tap (remove), not a drag. Fingers wobble more. */
const TAP_SLOP = 6;
const TAP_SLOP_TOUCH = 10;
/** Two taps on a tray stroke within this long (ms) are a double tap, which turns it on a touch screen. */
const DOUBLE_TAP = 350;
const WIGGLE = { duration: 0.4, times: [0, 0.35, 0.7, 1], ease: 'easeOut' as const };
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

/** The orientations each stroke takes in some letter: what tapping it in the tray cycles through on a touch screen. */
const ORIENTS = Object.fromEntries(
  TILE_IDS.map((t) => [t, [...new Set(Object.values(LETTERS).flatMap((g) => g.parts.filter((p) => p.tile === t).map((p) => norm(p.rot ?? 0))))].sort((a, b) => a - b)]),
) as Record<TileId, number[]>;

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
  /** A finger, not a mouse or pen: the stroke is held above the fingertip, and isn't twisted. */
  touch: boolean;
  /** The orientation it was picked up at; a touch drag keeps to it where a spot fits it more than one way. */
  chosen: number;
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
  /** Phone layout: narrower cells sharing the row's width (the unit is then measured, not given). */
  compact?: boolean;
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
export function WordEditor({ cells, unit, disabled, room, onEdit, onHoverTile, compact = false }: Props) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const [hover, setHover] = useState<{ cell: number; key: string } | null>(null);
  /** A stroke flying home to its tray tile after the drag ended (removed, or not placed). */
  const [flight, setFlight] = useState<{ id: number; tile: TileId } | null>(null);
  const [glow, setGlow] = useState(false);
  const dragRef = useRef<Drag | null>(null);
  const svgs = useRef<(SVGSVGElement | null)[]>([]);
  const trayEls = useRef(new Map<TileId, HTMLElement>());
  const landings = useRef(new Map<string, Landing>());
  const rootRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const coarse = useMedia(COARSE);

  // On phones the four cells share the row's width, and the unit is whatever that makes it.
  const cellW = compact ? CELL_W_COMPACT : CELL_W;
  const [measured, setMeasured] = useState<number | null>(null);
  const u = compact && measured ? measured : unit;
  useLayoutEffect(() => {
    const el = svgs.current[0];
    if (!compact || !el) return;
    const measure = () => setMeasured(el.getBoundingClientRect().width / CELL_W_COMPACT);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [compact]);

  // How each stroke sits in the tray. On a touch screen double-tapping a chevron, arc or bowl turns
  // it there (there's no twisting a stroke under a finger), and it goes in the way it's turned; it
  // starts the way it most often goes in (an arc as C, not on its side).
  const [trayTurn, setTrayTurn] = useState(
    () =>
      Object.fromEntries(
        TILE_IDS.map((t) => {
          const display = TILES[t].display ?? 0;
          return [t, window.matchMedia(COARSE).matches && !ORIENTS[t].includes(display) ? ORIENTS[t][0] : display];
        }),
      ) as Record<TileId, number>,
  );
  const turnInTray = (t: TileId) =>
    setTrayTurn((s) => ({ ...s, [t]: ORIENTS[t][(ORIENTS[t].indexOf(s[t]) + 1) % ORIENTS[t].length] }));
  // A single tap wiggles a turnable stroke (a hint that it turns); a second tap soon after turns it.
  const lastTap = useRef<{ tile: TileId; at: number } | null>(null);
  const [nudges, setNudges] = useState<Partial<Record<TileId, number>>>({});

  // The floating stroke: centre (screen px), scale (1 = word size) and extra rotation (flights).
  const gx = useMotionValue(0);
  const gy = useMotionValue(0);
  const gs = useMotionValue(1);
  const gr = useMotionValue(0);
  // Where the stroke was grabbed (it keeps that point under a mouse; under a finger it's held
  // `lift` px above the fingertip instead, so the finger doesn't hide it or where it's going).
  const grip = useRef({ dx: 0, dy: 0, lift: 0, scale0: 1, snapped: false, scaleTo: 1, flightId: 0 });
  const samples = useRef<{ t: number; x: number; y: number }[]>([]);

  const offsets = useMemo(() => cells.map(centerOffset), [cells]);
  const minHalf = minHalfWidthAt(u);

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
    return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2, scale: r.width / 2.4 / u } : null;
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

    // Under a finger there's no twisting: the stroke goes in the way it was turned in the tray,
    // following the nearest spot (red, and the label says so, if it doesn't fit there that way).
    if (d.touch) {
      const aim = { cell: overCell, x: nearest.placement.x, y: nearest.placement.y, armed: false, angle: null };
      const slot = ways.find((s) => norm(s.placement.rot ?? 0) === norm(d.chosen));
      return { overCell, target: slot ? { cell: overCell, slot } : null, aim, turn: d.turn + wrap(d.chosen - d.turn) };
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
      x: (gx.get() - at.x) / u,
      y: (gy.get() - at.y) / u,
      scale: gs.get(),
      rotate: wrap(turn - (p.rot ?? 0)),
      vx: v.x / u,
      vy: v.y / u,
    });
  };

  /** Fly the floating stroke back into its tray tile (it was removed, or found no spot). */
  const flyHome = (d: Drag) => {
    const home = trayHome(d.tile);
    if (!home || reduce) return;
    const id = ++grip.current.flightId;
    setFlight({ id, tile: d.tile });
    // The floating stroke switches to the tray's orientation and turns there from its own.
    gr.set(wrap(d.turn - trayTurn[d.tile]));
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
      // On a touch screen, double-tapping a stroke in the tray turns it (if it ever needs turning).
      if (d.touch && d.source.kind === 'tray') {
        if (!TWISTS.has(d.tile)) return;
        const now = performance.now();
        const prev = lastTap.current;
        if (prev && prev.tile === d.tile && now - prev.at < DOUBLE_TAP) {
          lastTap.current = null;
          turnInTray(d.tile);
        } else {
          lastTap.current = { tile: d.tile, at: now };
          setNudges((n) => ({ ...n, [d.tile]: (n[d.tile] ?? 0) + 1 }));
        }
        return;
      }
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
    const touch = e.pointerType === 'touch';
    // A touch pointer is captured by the element it pressed, and a pressed placed stroke leaves
    // the page as it lifts: capture it on the editor instead, so the drag keeps getting its events.
    if (touch) {
      try {
        rootRef.current?.setPointerCapture(e.pointerId);
      } catch {
        // the pointer's already gone (lifted at once, or synthetic): the window listeners still work
      }
    }
    // Lift the stroke from exactly where it sits, keeping the point that was grabbed.
    const g = grip.current;
    g.flightId++;
    setFlight(null);
    [gx, gy, gs, gr].forEach((v) => v.stop());
    gx.set(home.x);
    gy.set(home.y);
    gr.set(0);
    gs.set(home.scale);
    const reach = 0.8 * u * home.scale;
    g.dx = touch ? 0 : Math.max(-reach, Math.min(reach, e.clientX - home.x));
    g.dy = touch ? 0 : Math.max(-reach, Math.min(reach, e.clientY - home.y));
    g.lift = touch ? Math.round(Math.min(72, Math.max(44, 1.7 * u))) : 0;
    g.scale0 = home.scale;
    // Under a finger the stroke glides up to its place above the fingertip rather than jumping there.
    g.snapped = touch;
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
      touch,
      chosen: rot,
    };
    dragRef.current = d0;
    setDrag(d0);
    setHover(null);
    // (The letter strip lights up for the held stroke; with the pointer captured it can't hover.)
    if (touch) onHoverTile(tile);
    const update = (ev: PointerEvent) => {
      const d = dragRef.current!;
      samples.current = [...samples.current.slice(-5), { t: performance.now(), x: ev.clientX, y: ev.clientY }];
      const moved = d.moved || Math.hypot(ev.clientX - d.startX, ev.clientY - d.startY) >= (d.touch ? TAP_SLOP_TOUCH : TAP_SLOP);
      // Where the stroke is aimed: the cursor, or the point held above a fingertip.
      const ay = ev.clientY - grip.current.lift;
      const nd = { ...d, moved, ...(moved ? locate(d, ev.clientX, ay) : {}) };
      dragRef.current = nd;
      // An automatic turn (snapping into an existing letter) is animated; twisting follows the cursor.
      if (nd.turn !== d.turn && !nd.aim?.armed && !reduce) {
        gr.set(gr.get() + d.turn - nd.turn);
        animate(gr, 0, SETTLE);
      }
      if (moved) steer(nd, ev.clientX, ay);
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
  /**
   * How a cell's strokes are drawn (see Look): what's left in it once the held stroke is lifted
   * out, previewed with the held stroke on the spot it's over. So U's stems draw back to meet the
   * bowl as it glides in, rather than jutting out below it until it's dropped.
   */
  const preview = (c: number) => {
    const kept = cells[c].filter((_, i) => !(carried?.cell === c && carried.index === i));
    const onSpot = held?.target?.cell === c ? held.target.slot.placement : null;
    const looks = lookPoints(onSpot ? [...kept, onSpot] : kept);
    return { kept, looks: looks.slice(0, kept.length), heldLook: onSpot ? looks[kept.length] : null };
  };
  // A finger pressing a tray stroke may be about to tap it (to turn it), so it stays put until it moves.
  const lifting = !!drag && !(drag.touch && drag.source.kind === 'tray' && !drag.moved);
  const floating = lifting
    ? {
        tile: drag!.tile,
        turn: drag!.turn,
        red: !!held?.aim && !held.target,
        lifted: true,
        look0: drag!.look0,
        look: held?.target ? preview(held.target.cell).heldLook : null,
      }
    : flight
      ? { tile: flight.tile, turn: trayTurn[flight.tile], red: false, lifted: false, look0: null, look: null }
      : null;

  return (
    <div ref={rootRef} className={`editor${disabled ? ' disabled' : ''}${compact ? ' compact' : ''}`}>
      <div className={`word-cells${glow ? ' opened' : ''}`}>
        {cells.map((content, c) => {
          const letter = recognize(content);
          const squeeze = (letter && LETTERS[letter].squeeze) || 1;
          const [lo, hi] = content.length ? xExtent(content) : [0, 0];
          const squeezed = (x: number) => (lo + hi) / 2 + (x - (lo + hi) / 2) * squeeze;
          const { kept, looks } = preview(c);
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
                viewBox={`${-cellW / 2} ${CELL_TOP} ${cellW} ${CELL_H}`}
                width={compact ? '100%' : cellW * unit}
                height={compact ? undefined : CELL_H * unit}
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
                          from={landing ? (look ?? 'own') : undefined}
                        />
                        {/* The hit area follows what's drawn, so tapping U's cup takes the bar, not a stem. */}
                        <path
                          className="hit"
                          data-slot={key /* which stroke this is (read by tests and tools) */}
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
                {target ? `→ ${target.slot.toward.join(' ')}` : misfit ? (held?.touch ? 'double-tap tray' : 'circle to turn') : noFit ? 'no fit' : (letter ?? '·')}
              </span>
            </div>
          );
        })}
      </div>

      <div className="tray">
        {TILE_IDS.map((t) => {
          const taken = (lifting && drag?.source.kind === 'tray' && drag.tile === t) || flight?.tile === t;
          return (
            <button
              key={t}
              ref={(el) => {
                if (el) trayEls.current.set(t, el);
              }}
              className={`tray-tile${taken ? ' taken' : ''}`}
              data-turn={trayTurn[t] /* how it's turned (read by tests and tools) */}
              style={{ ['--tile' as string]: `var(--t-${t})` }}
              title={
                TWISTS.has(t)
                  ? `${TILES[t].name}: ${coarse ? 'double-tap to turn it' : 'where it fits a spot either way round, circle the cursor around the spot to turn it'}`
                  : TILES[t].name
              }
              onPointerDown={(e) => start(e, t, trayTurn[t], { kind: 'tray' }, trayHome(t))}
              onPointerEnter={() => onHoverTile(t)}
              onPointerLeave={() => onHoverTile(null)}
            >
              <svg viewBox="-1.2 -1.2 2.4 2.4">
                <TrayStroke tile={t} turn={trayTurn[t]} nudge={nudges[t] ?? 0} />
              </svg>
            </button>
          );
        })}
      </div>

      {floating && (
        <motion.svg
          className={`floating${floating.lifted ? ' lifted' : ''}`}
          viewBox="-1.2 -1.2 2.4 2.4"
          width={2.4 * u}
          height={2.4 * u}
          style={{ left: -1.2 * u, top: -1.2 * u, x: gx, y: gy, scale: gs, rotate: gr }}
        >
          <Turned
            tile={floating.tile}
            turn={floating.turn}
            minHalfWidth={minHalf}
            fill={floating.red ? 'var(--spicy)' : undefined}
            from={floating.look0 ?? undefined}
            look={floating.look}
          />
        </motion.svg>
      )}
    </div>
  );
}

/**
 * A stroke in its tray tile, turning (forwards, with a spring) when it's turned in the tray, and
 * wiggling when it's tapped once (`nudge` counts the taps), a hint that a second tap turns it.
 */
function TrayStroke({ tile, turn, nudge }: { tile: TileId; turn: number; nudge: number }) {
  const prev = useRef({ turn, nudge });
  const delta = norm(turn - prev.current.turn);
  const wiggle = !delta && nudge !== prev.current.nudge;
  useEffect(() => {
    prev.current = { turn, nudge };
  }, [turn, nudge]);
  return (
    <motion.g
      key={`${turn}:${nudge}`}
      initial={delta ? { rotate: -delta } : wiggle ? { rotate: 0 } : false}
      animate={wiggle ? { rotate: [0, 14, -6, 0] } : { rotate: 0 }}
      transition={wiggle ? WIGGLE : SETTLE}
    >
      <TileStroke tile={tile} rot={turn} minHalfWidth={minHalfWidthAt(TRAY_PX_PER_UNIT)} />
    </motion.g>
  );
}

/**
 * A stroke at any angle: inked at the nearest quarter turn, then turned the rest of the way. One
 * lifted out of a formed letter starts in that letter's look (`from`) and eases back to itself;
 * one held on a spot that completes a letter takes the look it will have there (`look`).
 */
function Turned({ tile, turn, minHalfWidth, fill, from, look }: { tile: TileId; turn: number; minHalfWidth: number; fill?: string; from?: Pt[]; look?: Pt[] | null }) {
  const q = quarter(turn);
  return (
    <g transform={turn !== q ? `rotate(${turn - q})` : undefined}>
      <MorphStroke
        tile={tile}
        rot={norm(q)}
        seed={inkSeed({ tile, x: 0, y: 0, rot: norm(q) })}
        minHalfWidth={minHalfWidth}
        fill={fill}
        from={from}
        look={look}
      />
    </g>
  );
}

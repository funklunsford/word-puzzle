import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { animate, motion, useMotionValue } from 'motion/react';
import { useReduceMotion } from '../../prefs';
import { LETTERS, ORIENTS, TILES, TILE_IDS, TRAY_TURN, drawnScale, drawnWidth, xExtent, type Placement, type TileId } from '../../glyphs';
import { inkSeed, lookCenterline, opticalOffset, strokeCenterline, type Pt } from '../../ink';
import { EMPTY_CELL_X, formedLooks, onlyFit, recognize, slotKey, slotsFor, type Slot } from '../../strokes';
import { TileStroke, minHalfWidthAt } from '../Glyph';
import { MorphStroke, centerlinePath } from './MorphStroke';
import { COARSE, useMedia } from '../../useMedia';

export const CELL_W = 4;
/**
 * On phones the cells are narrow, so the four of them draw the word big (a half-built W spills
 * over its neighbours for a moment).
 */
export const CELL_W_COMPACT = 2.6;
/**
 * The widest a formed letter is drawn in those cells, so the pen keeps clear of the cell's border
 * (only W, 2.5 units at its usual squeeze, is wider: it's drawn a little narrower on phones).
 */
export const MAX_DRAWN_COMPACT = 2.2;
/**
 * Five letters on a phone share the row in narrower cells still, so each is drawn bigger than a
 * 2.6-unit cell would make it. The widest letters (A, M, O, Q, V and Y, 2 units; W) are drawn at
 * most 1.7 units wide there, a little narrower, so an O's ink (thickest at the back of its curves)
 * keeps as clear of the cell's sides as it does in four-letter cells. Narrowing those few letters
 * keeps every letter as tall as before; widening the cell for the same room would shrink them all.
 */
export const CELL_W_COMPACT_5 = 2.4;
export const MAX_DRAWN_COMPACT_5 = 1.7;
export const CELL_TOP = -0.7;
const CELL_H = 3.6;
/** A press that moves less than this many pixels is a tap (remove), not a drag. Fingers wobble more. */
const TAP_SLOP = 6;
const TAP_SLOP_TOUCH = 10;
/** Two taps on a tray stroke within this long (ms) are a double tap, which turns it on a touch screen. */
const DOUBLE_TAP = 400;
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

// Turning a stroke on a spot that fits it more than one way (a chevron as V or Λ, an arc as C or
// reversed, a bowl as B's or U's), in the cell's units. Once the cursor comes within ARM of the
// spot, the stroke stays on it (until the cursor is RELEASE away) and a swipe of SWIPE turns it the
// way the swipe goes: its point, or the back of its curve, follows the cursor (up turns V into Λ).
const ARM = 0.6;
const RELEASE = 1.6;
const SWIPE = 0.5;
/** A finger's swipe to turn a stroke: as short as a mouse's (a stroke carried onto its spot never counts as one, see Aim.settled). */
const SWIPE_TOUCH = 0.5;
/** Slower than this (letter units a second), a pointer is resting or creeping, not swiping. */
const CREEP = 1.5;

const norm = (deg: number) => ((deg % 360) + 360) % 360;
/** Shortest signed angle from one direction to another, in degrees. */
const wrap = (deg: number) => norm(deg + 180) - 180;
/** Which way a stroke points (its corner, or the back of its curve) unturned: away from the middle of its ends. */
const POINTS = Object.fromEntries(
  TILE_IDS.map((t) => {
    const pts = strokeCenterline(t, 0);
    const mid = [(pts[0][0] + pts[pts.length - 1][0]) / 2, (pts[0][1] + pts[pts.length - 1][1]) / 2];
    const c = [pts.reduce((a, p) => a + p[0], 0) / pts.length - mid[0], pts.reduce((a, p) => a + p[1], 0) / pts.length - mid[1]];
    const n = Math.hypot(c[0], c[1]) || 1;
    return [t, [c[0] / n, c[1] / n]];
  }),
) as Record<TileId, number[]>;
/** Which way a stroke points at `rot` degrees (clockwise), as a unit vector in screen axes (y down). */
const pointing = (t: TileId, rot: number) => {
  const a = (rot * Math.PI) / 180;
  const [x, y] = POINTS[t];
  return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
};

/** The quarter turn nearest to `turn` (unwrapped, so turn − quarter is the leftover twist). */
const quarter = (turn: number) => Math.round(turn / 90) * 90;

type Source = { kind: 'tray' } | { kind: 'cell'; cell: number; index: number; key: string };

/** The spot a rotatable stroke is locked onto while it's held over a cell. */
interface Aim {
  cell: number;
  x: number;
  y: number;
  /** The cursor has been brought onto the spot, so a swipe now turns the stroke. */
  armed: boolean;
  /** It has stopped coming in: until then the anchor follows it, so carrying a stroke onto its spot is never a swipe. */
  settled: boolean;
  /** Where the cursor was when the stroke last settled here (armed or turned): swipes are measured from it. */
  ax: number;
  ay: number;
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
  /** A finger, not a mouse or pen: the stroke is held above the fingertip, and turns with a longer swipe. */
  touch: boolean;
  /** Where it was picked up (screen px). */
  home: { x: number; y: number };
  /** The second tap of a double tap on a placed stroke (the first is waiting to remove it). */
  again: boolean;
  /** It has reached the letters' row, so it stays within the row's height (until the pointer is over the tray). */
  entered: boolean;
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
  /** Apply an edit; returns false when the game refuses it (the step is out of strokes, or won). */
  onEdit: (next: Placement[][]) => boolean | void;
  onHoverTile: (tile: TileId | null) => void;
  /** A stroke let go over a letter it doesn't fit (or not the way it was turned): for a word of explanation. */
  onMiss?: (why: 'nofit' | 'turn') => void;
  /** Phone layout: narrower cells sharing the row's width (the unit is then measured, not given). */
  compact?: boolean;
  /** Letters a hint points at (indexes): their cells are outlined. */
  hinted?: number[];
  /** The strokes in the tray (all of them by default; How to play's practice offers a few). */
  tray?: readonly TileId[];
  /** A swipe turns a stroke as it's placed (Settings can turn this off: then a double-tap or double-click turns one). */
  swipe?: boolean;
}

/** How far above a fingertip a held stroke rides (px), so the finger doesn't hide it. */
export const fingerLift = (unit: number) => Math.round(Math.min(72, Math.max(44, 1.7 * unit)));

/** How much a formed letter is narrowed (W); on phones no letter is drawn wider than `maxDrawn` (null elsewhere). */
export function drawnSqueeze(letter: string | null, maxDrawn: number | null): number {
  if (!letter) return 1;
  return drawnScale(letter).shape * (maxDrawn ? Math.min(1, maxDrawn / drawnWidth(letter)) : 1);
}

/** How far apart a formed letter's strokes are drawn, beyond its squeeze (M's spread; see drawnScale). */
const spreadOf = (letter: string | null) => (letter ? (LETTERS[letter].spread ?? 1) : 1);

/**
 * Where a cell draws its strokes across. The letter it is narrows them (W's squeeze). The letter
 * its shape is becoming spreads them (M's spread): a formed M, a half-built one (a bar with the
 * chevron on top, so the chevron's end sits on the bar), or one forming under a held stroke.
 * `shape` is the cell as it's about to be (with a held stroke on its spot); the spread is about
 * its middle, so nothing jumps when the stroke lands.
 */
function across(content: Placement[], shape: Placement[], maxDrawn: number | null) {
  const squeeze = drawnSqueeze(recognize(content), maxDrawn);
  const spread = spreadOf(onlyFit(shape)?.ch ?? null);
  const basis = spread !== 1 ? shape : content;
  const [lo, hi] = basis.length ? xExtent(basis) : [0, 0];
  const mid = (lo + hi) / 2;
  return { squeeze, x: (x: number) => mid + (x - mid) * squeeze * spread };
}

/** Distance from a point to a polyline, and the polyline's length. */
function nearness(pts: Pt[], x: number, y: number) {
  let d = Infinity;
  let length = 0;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    const dx = bx - ax;
    const dy = by - ay;
    const l2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2));
    d = Math.min(d, Math.hypot(ax + t * dx - x, ay + t * dy - y));
    length += Math.sqrt(l2);
  }
  return { d, length };
}
/** Strokes this close (cell units) count as equally near: then the shorter one is picked (T's bar over its stem). */
const PICK_TIE = 0.06;
/** The centrelines a cell's strokes are drawn along: their formed letter's looks, or null where a stroke is drawn as itself. */
function lookPoints(content: Placement[], maxDrawn: number | null): (Pt[] | null)[] {
  const looks = formedLooks(content);
  const squeeze = drawnSqueeze(recognize(content), maxDrawn);
  return content.map((p, i) => (looks?.[i] ? lookCenterline(p, looks[i]!, squeeze) : null));
}

/** Offset that centers a cell's strokes horizontally. */
export function centerOffset(content: Placement[]): number {
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
 * from the tray, drag a placed stroke to move it, tap a placed stroke to remove it, and turn chevrons, arcs and bowls on a spot that fits them more than one way with a swipe (up turns a V into Λ).
 *
 * The held stroke lives in a floating layer for its whole life: it lifts from where it sits,
 * follows the cursor at the point it was grabbed, glides onto spots, and either springs into its
 * slot from where it was released or flies back to its tray tile.
 */
export function WordEditor({ cells, unit, disabled, room, onEdit, onHoverTile, onMiss, compact = false, hinted, tray = TILE_IDS, swipe = true }: Props) {
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
  const reduce = useReduceMotion();
  const coarse = useMedia(COARSE);

  // On phones the cells share the row's width, and the unit is whatever that makes it (five letters
  // get narrower cells, so they're drawn bigger).
  const five = compact && cells.length === 5;
  const cellW = compact ? (five ? CELL_W_COMPACT_5 : CELL_W_COMPACT) : CELL_W;
  const maxDrawn = compact ? (five ? MAX_DRAWN_COMPACT_5 : MAX_DRAWN_COMPACT) : null;
  const [measured, setMeasured] = useState<number | null>(null);
  const u = compact && measured ? measured : unit;
  useLayoutEffect(() => {
    const el = svgs.current[0];
    if (!compact || !el) return;
    const measure = () => setMeasured(el.getBoundingClientRect().width / cellW);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [compact, cellW]);

  // How each stroke sits in the tray (TRAY_TURN at first), and it goes in the way it's turned. On a
  // touch screen double-tapping a chevron, arc or bowl turns it there; with a mouse, a swipe turns it
  // as it's placed (see locate).
  const [trayTurn, setTrayTurn] = useState(() => ({ ...TRAY_TURN }));
  const turnInTray = (t: TileId) =>
    setTrayTurn((s) => ({ ...s, [t]: ORIENTS[t][(ORIENTS[t].indexOf(s[t]) + 1) % ORIENTS[t].length] }));
  // A single tap wiggles a turnable stroke (a hint that it turns); a second tap soon after turns it.
  const lastTap = useRef<{ tile: TileId; at: number } | null>(null);
  // Edits are made against the latest cells: the word as last drawn, or as just edited ahead of
  // the next draw (a tap can let a waiting removal go ahead and then carry on with its own press).
  const cellsRef = useRef(cells);
  cellsRef.current = cells;
  /** Make an edit, unless the game refuses it (out of strokes, won, or hardcore's off-route word): whether it was made. */
  const apply = (next: Placement[][]) => {
    if (onEdit(next) === false) return false;
    cellsRef.current = next;
    return true;
  };
  // On a touch screen a tap on a placed stroke waits a moment before removing it (it dims): a
  // second tap turns it on its spot if it fits the other way round there, or wiggles it if it
  // doesn't, and removes nothing. Then a double tap can never remove two strokes.
  const pendingTap = useRef<{ cell: number; key: string; timer: number; remove: () => void } | null>(null);
  /** The last stroke removed at once (it couldn't turn), so a quick second tap there is ignored. */
  const lastRemoved = useRef<{ cell: number; x: number; y: number; at: number } | null>(null);
  const [pendingStroke, setPendingStroke] = useState<string | null>(null);
  const settleTap = (run: boolean) => {
    const pt = pendingTap.current;
    if (!pt) return;
    pendingTap.current = null;
    clearTimeout(pt.timer);
    setPendingStroke(null);
    if (run) pt.remove();
  };
  const [wiggle, setWiggle] = useState<{ id: string; n: number }>({ id: '', n: 0 });
  // A word changed some other way (undo, reset, a new puzzle) drops a waiting removal.
  useEffect(() => () => settleTap(false), [cells]);

  // A finger scrolls the page from anywhere on the editor except a stroke (placed, or in the tray):
  // a touch that lands on one is claimed for the stroke at once, before the page can start to
  // scroll, since a drag up from the tray looks just like a swipe to scroll down. So is any touch
  // while a stroke is held (a second finger can't scroll or zoom mid-drag). Claiming it must
  // happen on touchstart (cancelling pointerdown doesn't stop a scroll) with a listener that isn't
  // passive, which React's onTouchStart is.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const claim = (ev: TouchEvent) => {
      const on = ev.target instanceof Element && ev.target.closest('.placed, .tray-tile');
      if (dragRef.current || (on && !disabled)) ev.preventDefault();
    };
    el.addEventListener('touchstart', claim, { passive: false });
    return () => el.removeEventListener('touchstart', claim);
  }, [disabled]);
  const [nudges, setNudges] = useState<Partial<Record<TileId, number>>>({});

  // The floating stroke: centre (screen px), scale (1 = word size) and extra rotation (flights).
  const gx = useMotionValue(0);
  const gy = useMotionValue(0);
  const gs = useMotionValue(1);
  const gr = useMotionValue(0);
  // Where the stroke was grabbed (it keeps that point under a mouse; under a finger it's held
  // `lift` px above the fingertip instead, so the finger doesn't hide it or where it's going).
  const grip = useRef({ dx: 0, dy: 0, lift: 0, liftLater: 0, scale0: 1, snapped: false, scaleTo: 1, flightId: 0 });
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

  const without = (cell: number, source: Source | undefined) => {
    const now = cellsRef.current;
    return source?.kind === 'cell' && source.cell === cell ? now[cell].filter((_, i) => i !== source.index) : now[cell];
  };

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
    if (!r) return null;
    // Where the stroke is drawn in its tile: centred by eye (see opticalOffset), not by its middle.
    const [ox, oy] = trayCentring(tile, trayTurn[tile]);
    const k = r.width / 2.4;
    return { x: r.left + r.width / 2 + ox * k, y: r.top + r.height / 2 + oy * k, scale: k / u };
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
  const locate = (d: Drag, x: number, y: number, raw = { x, y }, creeping = false, rest: { x: number; y: number } | null = null): Pick<Drag, 'target' | 'aim' | 'turn' | 'overCell'> => {
    const inside = (el: Element | null | undefined) => {
      const r = el?.getBoundingClientRect();
      return !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    };
    const toCell = (cell: number, px = x, py = y) => {
      const m = svgs.current[cell]?.getScreenCTM();
      if (!m) return null;
      const p = new DOMPoint(px, py).matrixTransform(m.inverse());
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
    // bowl under "||" for U. A spot that fits it several ways (a chevron as V or Λ in an empty cell;
    // a bowl under a stem as B's or U's) holds it once the cursor has come onto it (within RELEASE),
    // so a swipe can turn it there without carrying it off to another spot.
    const held = !!d.aim && d.aim.cell === overCell && d.aim.armed && dist(d.aim) <= RELEASE;
    const at = held ? { x: d.aim!.x, y: d.aim!.y } : nearest.placement;
    const ways = slots.filter((s) => s.placement.x === at.x && s.placement.y === at.y);
    if (ways.length === 1) {
      const turn = d.turn + wrap((ways[0].placement.rot ?? 0) - d.turn);
      return { overCell, target: { cell: overCell, slot: ways[0] }, aim: null, turn };
    }

    // It settles the way it's held, or the nearest way that fits, and a swipe turns it (a mouse's or a
    // finger's, a finger's a little longer):
    // whichever way round points most along the swipe (up turns V into Λ; left and right turn an arc
    // or a bowl). Swipes count from where the cursor came onto the spot, or last turned it.
    let aim: Aim = held ? d.aim! : { cell: overCell, x: at.x, y: at.y, armed: false, settled: false, ax: lx, ay: ly };
    const rawLocal = toCell(overCell, raw.x, raw.y) ?? local;
    const closest = (turn: number) => ways.reduce((a, b) => (Math.abs(wrap((b.placement.rot ?? 0) - turn)) < Math.abs(wrap((a.placement.rot ?? 0) - turn)) ? b : a));
    let way = closest(d.turn);
    if (!aim.armed && dist(aim) < ARM) aim = { ...aim, armed: true, ax: rawLocal.lx, ay: rawLocal.ly };
    // While it's still coming in towards the spot, swipes count from wherever it has got to; once it
    // stops getting closer, they count from its closest point.
    if (aim.armed && !aim.settled) {
      const near = (px: number, py: number) => Math.hypot(px - aim.x, py - aim.y);
      if (near(rawLocal.lx, rawLocal.ly) <= near(aim.ax, aim.ay)) aim = { ...aim, ax: rawLocal.lx, ay: rawLocal.ly };
      else if (near(rawLocal.lx, rawLocal.ly) > near(aim.ax, aim.ay) + 0.05) aim = { ...aim, settled: true };
    }
    // A pointer resting or creeping (lining the stroke up, or drifting) carries the start of a swipe
    // with it: only a deliberate, quick move turns the stroke. After a pause, it starts where it rested.
    const restLocal = rest && toCell(overCell, rest.x, rest.y);
    if (aim.armed && restLocal) aim = { ...aim, settled: true, ax: restLocal.lx, ay: restLocal.ly };
    else if (aim.armed && creeping) aim = { ...aim, ax: rawLocal.lx, ay: rawLocal.ly };
    if (aim.armed && swipe) {
      const dx = rawLocal.lx - aim.ax;
      const dy = rawLocal.ly - aim.ay;
      const len = Math.hypot(dx, dy);
      if (len >= (d.touch ? SWIPE_TOUCH : SWIPE)) {
        const along = (w: Slot) => {
          const [px, py] = pointing(d.tile, w.placement.rot ?? 0);
          return (px * dx + py * dy) / len;
        };
        const best = ways.reduce((a, b) => (along(b) > along(a) ? b : a));
        if (along(best) > 0.5) way = best;
        aim = { ...aim, ax: rawLocal.lx, ay: rawLocal.ly };
      }
    }
    const turn = d.turn + wrap((way.placement.rot ?? 0) - d.turn);
    return { overCell, target: { cell: overCell, slot: way }, aim, turn };
  };

  /** The letters' row on screen, top to bottom (the cells' drawing area). */
  const rowBand = () => {
    const rs = svgs.current.filter(Boolean).map((el) => el!.getBoundingClientRect());
    return rs.length ? { top: Math.min(...rs.map((r) => r.top)), bottom: Math.max(...rs.map((r) => r.bottom)) } : null;
  };

  /** Move the floating stroke: glide onto the spot it's locked to, else follow the cursor at the grip. */
  const steer = (d: Drag, px: number, py: number) => {
    const g = grip.current;
    const spot = d.target ? { cell: d.target.cell, ...d.target.slot.placement } : d.aim;
    // On a spot it sits where that spot is drawn (M's bars part as its last stroke comes in).
    const sx = d.target ? across(cellsRef.current[d.target.cell], [...without(d.target.cell, d.source), d.target.slot.placement], maxDrawn).x(d.target.slot.placement.x) : spot?.x;
    const at = spot ? screenOf(spot.cell, sx!, spot.y) : null;
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

  /** Let a placed stroke spring into its slot (in `after`, the cell as it will be) from wherever the floating stroke is now. */
  const land = (cell: number, p: Placement, turn: number, after: Placement[]) => {
    const at = screenOf(cell, across(after, after, maxDrawn).x(p.x), p.y);
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

  /** The next way round a placed stroke fits on its own spot (cycling), or null if it fits only one way there. */
  const turnedInPlace = (d: Drag, cell: number, original: Placement): Placement | null => {
    const rot = norm(original.rot ?? 0);
    // A stroke alone in its cell (V's chevron) is offered back at the empty cell's x, not where it
    // sits in its letter: there only its height has to match, and it keeps its own x.
    const alone = cellsRef.current[cell].length === 1;
    const ways = d.slots[cell]
      .map((s) => (alone ? { ...s.placement, x: original.x } : s.placement))
      .filter((q) => q.x === original.x && q.y === original.y && norm(q.rot ?? 0) !== rot)
      .sort((a, b) => norm(norm(a.rot ?? 0) - rot) - norm(norm(b.rot ?? 0) - rot));
    return ways[0] ?? null;
  };

  const finish = (d: Drag) => {
    const base = cellsRef.current;
    const next = base.map((c) => [...c]);
    const from = d.source.kind === 'cell' ? d.source : null;
    const at = from ? base[from.cell].findIndex((q) => slotKey(q) === from.key) : -1;
    if (from && at < 0) return; // the stroke's gone (the word changed under the press)
    const original = from ? base[from.cell][at] : null;
    if (!d.moved) {
      // Double-tapping (or double-clicking) a stroke in the tray turns it (if it ever needs turning).
      if (d.source.kind === 'tray') {
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
      // A tap or click on a placed stroke waits a moment (dimmed) before removing it; a second one
      // turns it on its spot where it fits the other way round too (a chevron as V or Λ, a bowl as
      // B's or U's), or wiggles it where it doesn't (and removes nothing).
      if (from && original) {
        if (d.again) {
          const turned = turnedInPlace(d, from.cell, original);
          if (turned) {
            next[from.cell][at] = turned;
            land(from.cell, turned, d.turn, next[from.cell]);
            apply(next);
          } else setWiggle((w) => ({ id: `${from.cell}|${from.key}`, n: w.n + 1 }));
          return;
        }
        // A stroke that can't turn where it sits has nothing to wait for: it goes at once (its
        // flight home starts where it sat), and a second tap right there is ignored rather than
        // taking the stroke now nearest (see start).
        if (!turnedInPlace(d, from.cell, original)) {
          [gx, gy, gs, gr].forEach((v) => v.stop());
          gx.set(d.home.x);
          gy.set(d.home.y);
          gs.set(1);
          gr.set(0);
          next[from.cell].splice(at, 1);
          if (apply(next)) flyHome(d);
          lastRemoved.current = { cell: from.cell, x: d.startX, y: d.startY, at: performance.now() };
          return;
        }
        const timer = window.setTimeout(() => settleTap(true), DOUBLE_TAP);
        pendingTap.current = {
          cell: from.cell,
          key: from.key,
          timer,
          remove: () => {
            // Whatever the word is by then: the stroke is found again by its key.
            const now = cellsRef.current.map((c) => [...c]);
            const i = now[from.cell].findIndex((q) => slotKey(q) === from.key);
            if (i < 0) return;
            now[from.cell].splice(i, 1);
            // It flies home from its spot, as if it had been removed at once.
            [gx, gy, gs, gr].forEach((v) => v.stop());
            gx.set(d.home.x);
            gy.set(d.home.y);
            gs.set(1);
            gr.set(0);
            if (apply(now)) flyHome(d);
          },
        };
        setPendingStroke(`${from.cell}|${from.key}`);
        return;
      }
      // A tray stroke that was only pressed goes back.
      flyHome(d);
      return;
    }
    if (d.target) {
      const p = d.target.slot.placement;
      land(d.target.cell, p, d.turn, [...base[d.target.cell].filter((_, i) => !(from && from.cell === d.target!.cell && i === at)), p]);
      if (from && from.cell === d.target.cell && slotKey(original!) === slotKey(p)) return; // dropped where it was
      if (from) next[from.cell].splice(at, 1);
      next[d.target.cell].push(p);
      // Refused: it goes back where it came from, to its spot or to the tray.
      if (!apply(next)) {
        if (from && original) land(from.cell, original, d.turn, base[from.cell]);
        else flyHome(d);
      }
      return;
    }
    // Nowhere to go: a placed stroke springs back to its slot, a tray stroke back to the tray. Let
    // go over a letter, it says why.
    if (from && original) land(from.cell, original, d.turn, base[from.cell]);
    else flyHome(d);
    if (d.overCell !== null && !(from && from.cell === d.overCell)) onMiss?.(d.aim ? 'turn' : 'nofit');
  };

  // Listeners are attached synchronously on pointer-down (not in an effect) so a quick flick
  // can't release before they exist.
  const start = (e: React.PointerEvent, tile: TileId, rot: number, source: Source, home: { x: number; y: number; scale: number } | null, look0: Pt[] | null = null) => {
    if (disabled || dragRef.current || !home) return;
    e.preventDefault();
    // A press while a tapped stroke waits to be removed: on that same stroke it may be the second
    // tap; on anything else the removal goes ahead first, and this press carries on against the
    // word as it is now (its stroke found again by key).
    // The second tap of a double tap on a stroke that went at once (it couldn't turn): ignored.
    const lr = lastRemoved.current;
    if (source.kind === 'cell' && lr && lr.cell === source.cell && performance.now() - lr.at < DOUBLE_TAP && Math.hypot(e.clientX - lr.x, e.clientY - lr.y) < 24) return;
    const pt = pendingTap.current;
    const again = !!pt && source.kind === 'cell' && source.cell === pt.cell && source.key === pt.key;
    if (pt) settleTap(!again);
    if (source.kind === 'cell') {
      const { cell, key } = source;
      const index = cellsRef.current[cell].findIndex((q) => slotKey(q) === key);
      if (index < 0) return;
      source = { ...source, index };
    }
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
    g.lift = touch ? fingerLift(u) : 0;
    g.scale0 = home.scale;
    // Under a finger the stroke glides up to its place above the fingertip rather than jumping there.
    g.snapped = touch;
    g.scaleTo = home.scale * LIFT;
    if (reduce) gs.set(g.scaleTo);
    else animate(gs, g.scaleTo, SETTLE);
    samples.current = [{ t: performance.now(), x: e.clientX, y: e.clientY }];

    const slots = cellsRef.current.map((_, c) => slotsFor(without(c, source), tile));
    // A stroke lifted from a spot that fits it more than one way (a lone V, which can be Λ) is
    // already on that spot: a swipe from wherever it was pressed turns it there. Under a finger it
    // stays on its spot (not lifted above the fingertip) until the finger leaves it, so a swipe to
    // turn it never carries it out of its letter.
    let aim: Aim | null = null;
    g.liftLater = 0;
    if (source.kind === 'cell' && TILES[tile].rotates) {
      const own = cellsRef.current[source.cell][source.index];
      const level = slots[source.cell].filter((s) => s.placement.y === own.y);
      const spot = level.length ? level.reduce((a, b) => (Math.abs(b.placement.x - own.x) < Math.abs(a.placement.x - own.x) ? b : a)).placement : null;
      const m = svgs.current[source.cell]?.getScreenCTM();
      if (spot && m && level.filter((s) => s.placement.x === spot.x).length > 1) {
        const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
        aim = { cell: source.cell, x: spot.x, y: spot.y, armed: true, settled: true, ax: p.x - offsets[source.cell], ay: p.y };
        if (touch) [g.liftLater, g.lift] = [g.lift, 0];
      }
    }
    const d0: Drag = {
      tile,
      source,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
      turn: rot,
      slots,
      aim,
      target: null,
      overCell: null,
      look0,
      touch,
      home,
      again,
      entered: false,
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
      // Where the stroke is aimed: the cursor, or the point held above a fingertip. Once it has
      // reached the letters' row it stays within the row's height (a swipe up to turn it doesn't
      // carry it off), until the pointer goes down over the tray to put it back.
      // A finger that has carried a stroke off its own spot: now the stroke rises above it.
      const gr0 = grip.current;
      if (gr0.liftLater && Math.hypot(ev.clientX - d.startX, ev.clientY - d.startY) > RELEASE * u) {
        [gr0.lift, gr0.liftLater, gr0.snapped] = [gr0.liftLater, 0, true];
      }
      const rawY = ev.clientY - grip.current.lift;
      const row = rowBand();
      const entered = d.entered || (!!row && rawY >= row.top && rawY <= row.bottom);
      const overTray = ev.clientY >= (rootRef.current?.querySelector('.tray')?.getBoundingClientRect().top ?? Infinity);
      const ay = entered && row && !overTray ? Math.min(row.bottom, Math.max(row.top, rawY)) : rawY;
      // (The first move after a rest has no speed yet: it starts the swipe, it isn't creeping.)
      const v = velocity();
      const last = samples.current[samples.current.length - 1];
      const moving = samples.current.filter((p) => last.t - p.t <= 100).length >= 2;
      const creeping = moving && Math.hypot(v.x, v.y) / u < CREEP;
      const prev = samples.current[samples.current.length - 2];
      const rest = prev && last.t - prev.t > 100 ? { x: prev.x, y: prev.y - grip.current.lift } : null;
      const nd = { ...d, moved, entered, ...(moved ? locate(d, ev.clientX, ay, { x: ev.clientX, y: rawY }, creeping, rest) : {}) };
      dragRef.current = nd;
      // Turns snap: the stroke springs round to its new way.
      if (nd.turn !== d.turn && !reduce) {
        gr.set(gr.get() + d.turn - nd.turn);
        animate(gr, 0, SETTLE);
      }
      if (moved) steer(nd, ev.clientX, ay);
      return nd;
    };
    // The rest of the press is heard on the window and on the pressed element itself: a phone that
    // doesn't honour the capture above keeps sending it to that element, even after it leaves the
    // page as the stroke lifts (where nothing bubbles up to the window). Each event is handled once.
    const pressed = e.currentTarget as Element;
    const targets: EventTarget[] = touch ? [window, pressed] : [window];
    let last: Event | null = null;
    const once = (ev: Event) => ev !== last && ((last = ev), true);
    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId === e.pointerId && once(ev)) setDrag(update(ev));
    };
    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId || !once(ev)) return;
      for (const t of targets) {
        t.removeEventListener('pointermove', onMove as EventListener);
        t.removeEventListener('pointerup', onUp as EventListener);
        t.removeEventListener('pointercancel', onUp as EventListener);
      }
      const d = update(ev);
      dragRef.current = null;
      setDrag(null);
      onHoverTile(null);
      if (ev.type === 'pointerup') finish(d);
      // A phone may cancel a quick second tap as a gesture of its own: it's still a double tap.
      else if (d.touch && !d.moved && d.source.kind === 'cell') {
        if (d.again) finish(d);
      } else flyHome(d);
    };
    for (const t of targets) {
      t.addEventListener('pointermove', onMove as EventListener);
      t.addEventListener('pointerup', onUp as EventListener);
      t.addEventListener('pointercancel', onUp as EventListener);
    }
  };

  /** Press on a placed stroke. Looked up by position, so a stale press can't grab the wrong one. */
  /**
   * The placed stroke a pointer is on: the one whose drawn line is nearest (not the one drawn last,
   * whose wide tap area would otherwise cover a neighbour: T's stem over its bar, N's diagonal over
   * a bar), the shorter one where two meet. Used for presses and hover alike.
   */
  const strokeAt = (cell: number, clientX: number, clientY: number) => {
    const m = svgs.current[cell]?.getScreenCTM();
    if (!m) return null;
    const q = new DOMPoint(clientX, clientY).matrixTransform(m.inverse());
    const lx = q.x - offsets[cell];
    const content = cellsRef.current[cell];
    const { squeeze, x: drawn } = across(content, content, maxDrawn);
    const looks = lookPoints(content, maxDrawn);
    let best: { p: Placement; x: number; d: number; length: number } | null = null;
    content.forEach((p, i) => {
      const x = drawn(p.x);
      const line = (looks[i] ?? strokeCenterline(p.tile, p.rot ?? 0, squeeze)).map(([px, py]): Pt => [x + px, p.y + py]);
      const { d, length } = nearness(line, lx, q.y);
      if (!best || d < best.d - PICK_TIE || (Math.abs(d - best.d) <= PICK_TIE && length < best.length)) best = { p, x, d, length };
    });
    return best as { p: Placement; x: number } | null;
  };
  const pressAt = (e: React.PointerEvent, cell: number) => {
    const s = strokeAt(cell, e.clientX, e.clientY);
    if (s) pressPlaced(e, cell, s.p, s.x);
  };
  /** A mouse over the word: the stroke a click would remove is tinted (see .placed.hovered). */
  const hoverAt = (e: React.PointerEvent, cell: number) => {
    if (e.pointerType !== 'mouse' || dragRef.current) return;
    const s = strokeAt(cell, e.clientX, e.clientY);
    const key = s ? slotKey(s.p) : null;
    if (hover?.cell === cell && hover.key === key) return;
    setHover(key ? { cell, key } : null);
    onHoverTile(s ? s.p.tile : null);
  };

  const pressPlaced = (e: React.PointerEvent, cell: number, p: Placement, x: number) => {
    const index = cells[cell].findIndex((q) => slotKey(q) === slotKey(p));
    const at = screenOf(cell, x, p.y);
    if (index >= 0) start(e, p.tile, p.rot ?? 0, { kind: 'cell', cell, index, key: slotKey(p) }, at && { ...at, scale: 1 }, lookPoints(cells[cell], maxDrawn)[index]);
  };

  const held = drag?.moved ? drag : null;
  // The pressed stroke leaves its cell (or tile) for the floating layer once the pointer moves: until
  // then the press may be a tap or click (to remove it, or the first of two to turn it), and it stays put.
  const lifting = !!drag && drag.moved;
  const carried = lifting && drag?.source.kind === 'cell' ? drag.source : null;
  /**
   * How a cell's strokes are drawn (see Look): what's left in it once the held stroke is lifted
   * out, previewed with the held stroke on the spot it's over. So U's stems draw back to meet the
   * bowl as it glides in, rather than jutting out below it until it's dropped.
   */
  const preview = (c: number) => {
    const kept = cells[c].filter((_, i) => !(carried?.cell === c && carried.index === i));
    const onSpot = held?.target?.cell === c ? held.target.slot.placement : null;
    const looks = lookPoints(onSpot ? [...kept, onSpot] : kept, maxDrawn);
    // The cell as it'll be with the held stroke on its spot, if anything (see across).
    const shape = onSpot ? [...kept, onSpot] : kept;
    return { kept, looks: looks.slice(0, kept.length), heldLook: onSpot ? looks[kept.length] : null, shape };
  };
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
          const { kept, looks, shape } = preview(c);
          // Strokes are narrowed by the letter's squeeze (W), and drawn apart by its spread (M): the
          // spread follows the letter the cell is becoming, so M's bars part as its last stroke
          // comes in, and a half-built M's chevron sits on its bar (see across).
          const { squeeze, x: squeezed } = across(content, shape, maxDrawn);
          const shown = kept.map((p, i) => ({ p, look: looks[i] }));
          const target = held?.target?.cell === c ? held.target : null;
          const aim = held?.aim?.cell === c ? held.aim : null;
          // Nothing fits here, or the held stroke's current orientation doesn't: the letter goes red.
          const noFit = !!held && held.overCell === c && !held.slots[c].length;
          const misfit = !!aim && !target;
          const red = noFit || misfit;
          return (
            <div className={`cell${letter ? ' formed' : ''}${red ? ' red' : ''}${hinted?.includes(c) ? ' hinted' : ''}`} key={c}>
              <svg
                ref={(el) => {
                  svgs.current[c] = el;
                }}
                viewBox={`${-cellW / 2} ${CELL_TOP} ${cellW} ${CELL_H}`}
                width={compact ? '100%' : cellW * unit}
                height={compact ? undefined : CELL_H * unit}
              >
                <motion.g
                  className="cell-content"
                  initial={false}
                  animate={{ x: offsets[c] }}
                  transition={SETTLE}
                  onPointerDown={(e) => pressAt(e, c)}
                  onPointerMove={(e) => hoverAt(e, c)}
                  onPointerLeave={() => {
                    if (hover?.cell !== c) return;
                    setHover(null);
                    onHoverTile(null);
                  }}
                >
                  {shown.map(({ p, look }) => {
                    const key = slotKey(p);
                    const x = squeezed(p.x);
                    const hovered = !drag && !disabled && hover?.cell === c && hover.key === key;
                    const landing = landings.current.get(`${c}|${key}`);
                    // Tapped on a touch screen and about to go: dimmed (still there to tap again).
                    const leaving = pendingStroke === `${c}|${key}`;
                    // Double-tapped where it can't turn: a wiggle, and nothing removed.
                    const wiggled = wiggle.id === `${c}|${key}` ? wiggle.n : 0;
                    return (
                      <motion.g
                        key={key}
                        className={`placed${hovered ? ' hovered' : ''}`}
                        initial={landing ? { x: landing.x, y: landing.y, scale: landing.scale, rotate: landing.rotate } : { opacity: 0 }}
                        animate={{ x: 0, y: 0, rotate: 0, opacity: leaving ? 0.35 : 1, scale: hovered ? 1.04 : 1 }}
                        transition={
                          landing
                            ? { ...LAND, x: { ...LAND, velocity: landing.vx }, y: { ...LAND, velocity: landing.vy } }
                            : { ...SETTLE, opacity: { duration: leaving ? 0.08 : 0.15 } }
                        }
                      >
                        <motion.g key={wiggled} initial={wiggled ? { rotate: 0 } : false} animate={wiggled ? { rotate: [0, 11, -8, 4, 0] } : undefined} transition={WIGGLE}>
                          {/* Eases into its formed letter's look and back (U's bar bends into the cup). */}
                          <MorphStroke
                            tile={p.tile}
                            rot={p.rot ?? 0}
                            x={x}
                            y={p.y}
                            seed={inkSeed(p)}
                            minHalfWidth={minHalf}
                            squeeze={squeeze}
                            fill={red ? 'var(--spicy)' : hovered ? 'var(--remove)' : undefined}
                            look={look}
                            from={landing ? (look ?? 'own') : undefined}
                          />
                        </motion.g>
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
                        >
                          <title>{coarse ? 'Tap to remove · double-tap to turn · drag to move' : 'Click to remove · double-click to turn · drag to move'}</title>
                        </path>
                      </motion.g>
                    );
                  })}
                </motion.g>
              </svg>
              <span className="cell-letter">
                {target ? `→ ${target.slot.toward.join(' ')}` : misfit ? (swipe ? 'swipe to turn' : 'turn it first') : noFit ? 'no fit' : (letter ?? 'no letter')}
              </span>
            </div>
          );
        })}
      </div>

      <div className="tray">
        {tray.map((t) => {
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
              data-tile={t /* which stroke this is (read by tests and tools) */}
              aria-label={`${TILES[t].name} stroke`}
              title={TWISTS.has(t) ? (coarse ? 'Drag into a letter · double-tap to turn' : 'Drag into a letter · double-click to turn') : 'Drag into a letter'}
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

/** How far a stroke is shifted in its tray tile to look centred (tray units). */
export const trayCentring = (tile: TileId, turn: number) => opticalOffset(tile, norm(turn), minHalfWidthAt(TRAY_PX_PER_UNIT));

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
      {/* Centred by eye (an arc's weight is in its back), inside the turn so a turn carries it round. */}
      <g transform={`translate(${trayCentring(tile, turn).join(' ')})`}>
        <TileStroke tile={tile} rot={turn} minHalfWidth={minHalfWidthAt(TRAY_PX_PER_UNIT)} />
      </g>
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

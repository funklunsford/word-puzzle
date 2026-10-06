import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { LETTERS, type Placement, type TileId } from '../../glyphs';
import { inkSeed, strokeCenterline } from '../../ink';
import { recognize, slotKey } from '../../strokes';
import { TUTORIAL as STEPS, type Ghost } from '../../tutorial';
import { TileStroke, minHalfWidthAt } from '../Glyph';
import { CELL_TOP, CELL_W, WordEditor, centerOffset, fingerLift } from './WordEditor';

/** The practice tray: a long bar, a bar, a chevron and an arc (every stroke the steps use). */
const TRAY: TileId[] = ['LV', 'H', 'BV', 'C'];
/** Pixels per letter unit in the practice cell. */
const UNIT = 26;
/** The ghost shows the move again once the player has left the cell alone this long (ms). */
const IDLE = 2500;

const fresh = (letter: string) => LETTERS[letter].parts.map((p) => ({ ...p }));

/** Where the practice cell and tray are, in px from the practice box's corner. */
interface Geo {
  /** Letter (0, 0) in the cell, before the cell centres its letter. */
  ox: number;
  oy: number;
  /** Px per letter unit. */
  k: number;
  tray: Partial<Record<TileId, { x: number; y: number }>>;
  w: number;
  h: number;
}

/**
 * How to play's practice: a letter cell and a small tray, the game's own editor, with four moves to
 * make (add, move, turn, remove). A ghost hand (a cursor with a mouse) shows each move until the
 * player has a go, and again whenever they leave it alone for a moment.
 */
export function HowToTry({ touch }: { touch: boolean }) {
  const reduce = useReducedMotion();
  const [stepIndex, setStepIndex] = useState(0);
  const [startCells, setStartCells] = useState(() => [fresh(STEPS[0].start)]);
  const [cells, setCells] = useState(startCells);
  const [done, setDone] = useState(false);
  const [idle, setIdle] = useState(true);
  const idleTimer = useRef(0);
  const box = useRef<HTMLDivElement>(null);
  const [geo, setGeo] = useState<Geo | null>(null);
  const step = STEPS[stepIndex];
  const finished = done && stepIndex === STEPS.length - 1;

  // Measure where things are (the card can still be scaling in, so undo its scale).
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const svg = el.querySelector('.cell svg');
      if (!svg || !el.offsetWidth) return;
      const scale = r.width / el.offsetWidth;
      const s = svg.getBoundingClientRect();
      const k = s.width / scale / CELL_W;
      const tray: Geo['tray'] = {};
      for (const t of TRAY) {
        const b = el.querySelector(`[data-tile="${t}"] svg`)?.getBoundingClientRect();
        if (b) tray[t] = { x: (b.left - r.left + b.width / 2) / scale, y: (b.top - r.top + b.height / 2) / scale };
      }
      setGeo({ ox: (s.left - r.left) / scale + (CELL_W / 2) * k, oy: (s.top - r.top) / scale - CELL_TOP * k, k, tray, w: el.offsetWidth, h: el.offsetHeight });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [stepIndex]);

  const onEdit = (next: Placement[][]) => {
    if (done) return false;
    setCells(next);
    if (recognize(next[0]) === step.goal) {
      setDone(true);
      if (stepIndex < STEPS.length - 1)
        window.setTimeout(() => {
          const following = STEPS[stepIndex + 1];
          // The next step carries on with the letter just made, if it starts from it.
          const start = following.start === step.goal ? next : [fresh(following.start)];
          setStepIndex(stepIndex + 1);
          setStartCells(start);
          setCells(start);
          setDone(false);
          window.clearTimeout(idleTimer.current);
          setIdle(true);
        }, 1300);
    }
    return true;
  };
  const busy = useCallback(() => {
    window.clearTimeout(idleTimer.current);
    setIdle(false);
  }, []);
  const rest = useCallback(() => {
    window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setIdle(true), IDLE);
  }, []);
  const startOver = () => {
    setCells(startCells);
    window.clearTimeout(idleTimer.current);
    setIdle(true);
  };

  const plan = done ? null : step.next(cells[0]);
  const say = finished ? step.done : done ? step.done : plan ? plan.say[touch ? 'touch' : 'mouse'] : 'Not quite.';
  return (
    <section className="how-try" aria-label="Try it">
      <div className="how-try-head">
        <span className="how-try-label">Try it</span>
        <span className="how-try-dots" aria-label={`Move ${stepIndex + 1} of ${STEPS.length}`}>
          {STEPS.map((_, i) => (
            <span key={i} className={i < stepIndex || (i === stepIndex && done) ? 'done' : i === stepIndex ? 'now' : ''} />
          ))}
        </span>
      </div>
      <p className={`how-try-say${done ? ' done' : ''}`} aria-live="polite">
        {done && '✓ '}
        {say}
        {!done && !plan && (
          <button className="how-try-again" onClick={startOver}>
            Start over
          </button>
        )}
      </p>
      <div className="how-try-box" ref={box} onPointerDownCapture={busy} onPointerUpCapture={rest} onPointerCancelCapture={rest}>
        <WordEditor key={stepIndex} cells={cells} unit={UNIT} disabled={done} room={done ? step.goal : step.start} onEdit={onEdit} onHoverTile={() => {}} tray={TRAY} />
        {geo && plan && idle && (
          <GhostMove key={`${stepIndex}:${cells[0].map(slotKey).join(',')}`} plan={plan.ghost} content={cells[0]} geo={geo} touch={touch} still={!!reduce} />
        )}
      </div>
    </section>
  );
}

/** A point on a stroke to press: the middle of a bar, partway along a chevron's arm. */
function grabPoint(p: Placement) {
  const pts = strokeCenterline(p.tile, p.rot ?? 0);
  const [x, y] = pts[Math.round((pts.length - 1) * (p.tile === 'BV' ? 0.3 : 0.5))];
  return { x: p.x + x, y: p.y + y };
}

const CURSOR = 'M0 0 L0 0.78 L0.2 0.6 L0.36 0.92 L0.48 0.86 L0.32 0.55 L0.58 0.55 Z';

/**
 * The ghost: a fingertip or cursor doing the move over the practice cell, with a faint copy of the
 * stroke (red for one being removed), on a loop. With reduced motion, the copy just sits where the
 * move leaves it.
 */
function GhostMove({ plan, content, geo, touch, still }: { plan: Ghost; content: Placement[]; geo: Geo; touch: boolean; still: boolean }) {
  const { k } = geo;
  const off = centerOffset(content);
  const at = (x: number, y: number) => ({ x: geo.ox + (x + off) * k, y: geo.oy + y * k });
  const lift = touch ? fingerLift(UNIT) : 0;

  // Each move as keyframes: when (fractions of the loop), and where the pointer and the copy are.
  let times: number[];
  let pointer: { x: number[]; y: number[]; opacity: number[]; scale: number[] };
  let ring: number[] = [];
  let copy: { tile: TileId; rot: number; seed: number; fill?: string; x: number[]; y: number[]; opacity: number[]; scale: number[]; rotate: number[] };
  let duration: number;
  const hold = (n: number, v: number) => Array<number>(n).fill(v);

  if (plan.kind === 'carry') {
    const to = at(plan.to.x, plan.to.y);
    const fromTray = plan.from === 'tray';
    const src = fromTray ? (geo.tray[plan.tile] ?? to) : at((plan.from as Placement).x, (plan.from as Placement).y);
    const grab = fromTray ? { x: 0, y: 0 } : (() => {
      const g = grabPoint(plan.from as Placement);
      const p = at(g.x, g.y);
      return { x: p.x - src.x, y: p.y - src.y };
    })();
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
    const tile = plan.tile;
    const rot = fromTray ? 0 : ((plan.from as Placement).rot ?? 0);
    copy = {
      tile,
      rot,
      seed: inkSeed(fromTray ? plan.to : (plan.from as Placement)),
      x: [src.x, src.x, src.x, held.x, to.x, to.x, to.x, to.x],
      y: [src.y, src.y, src.y, held.y, to.y, to.y, to.y, to.y],
      opacity: [0, 0, 0.75, 0.75, 0.75, 0.75, 0, 0],
      scale: [1, 1, 1.08, 1.08, 1.08, 1, 1, 1],
      rotate: hold(8, 0),
    };
  } else if (plan.kind === 'turn') {
    const spot = at(plan.at.x, plan.at.y);
    const g = grabPoint(plan.at);
    const p = at(g.x, g.y);
    const rot = plan.at.rot ?? 0;
    duration = 2.6;
    // Two taps or clicks, and it turns over.
    times = [0, 0.1, 0.2, 0.28, 0.36, 0.44, 0.7, 0.86, 1];
    pointer = { x: hold(9, p.x), y: hold(9, p.y), opacity: [0, 1, 1, 1, 1, 1, 1, 0, 0], scale: [1, 1, 0.85, 1, 0.85, 1, 1, 1, 1] };
    ring = [0, 0, 0.7, 0, 0.7, 0, 0, 0, 0];
    copy = { tile: plan.at.tile, rot, seed: inkSeed(plan.at), x: hold(9, spot.x), y: hold(9, spot.y), opacity: [0, 0, 0, 0, 0, 0.8, 0.8, 0, 0], scale: hold(9, 1), rotate: [0, 0, 0, 0, 0, 0, 180, 180, 180] };
  } else {
    // Point at the bar, tap or click (with a mouse it reddens first, as hovering does), and it goes.
    const spot = at(plan.at.x, plan.at.y);
    const g = grabPoint(plan.at);
    const p = at(g.x, g.y);
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
  }

  const loop = { duration, times, repeat: Infinity, repeatDelay: 0.8, ease: 'easeInOut' as const };
  const pen = minHalfWidthAt(k);
  const stroke = (rotate: number, fill?: string) => (
    <g transform={`scale(${k})`}>
      <g transform={rotate ? `rotate(${rotate})` : undefined}>
        <TileStroke tile={copy.tile} rot={copy.rot} seed={copy.seed} minHalfWidth={pen} fill={fill} />
      </g>
    </g>
  );

  if (still) {
    // Where the move leaves the stroke: on its new spot, turned over, or (red) about to go.
    const last = copy.x.length - 2;
    const x = plan.kind === 'carry' ? copy.x[last] : copy.x[0];
    const y = plan.kind === 'carry' ? copy.y[last] : copy.y[0];
    return (
      <svg className="how-try-ghost" width={geo.w} height={geo.h} viewBox={`0 0 ${geo.w} ${geo.h}`} aria-hidden="true">
        <g transform={`translate(${x} ${y})`} opacity={0.5}>
          {stroke(plan.kind === 'turn' ? 180 : 0, copy.fill)}
        </g>
      </svg>
    );
  }

  return (
    <svg className="how-try-ghost" width={geo.w} height={geo.h} viewBox={`0 0 ${geo.w} ${geo.h}`} aria-hidden="true">
      <motion.g initial={false} animate={{ x: copy.x, y: copy.y, opacity: copy.opacity, scale: copy.scale }} transition={loop}>
        <motion.g initial={false} animate={{ rotate: copy.rotate }} transition={loop}>
          {stroke(0, copy.fill)}
        </motion.g>
      </motion.g>
      <motion.g initial={false} animate={{ x: pointer.x, y: pointer.y, opacity: pointer.opacity }} transition={loop}>
        {ring.length > 0 && (
          <motion.circle className="how-try-ring" r={0.75 * k} initial={false} animate={{ opacity: ring, scale: ring.map((o) => (o ? 1.3 : 0.6)) }} transition={loop} />
        )}
        <motion.g initial={false} animate={{ scale: pointer.scale }} transition={loop}>
          {touch ? <circle className="how-try-finger" r={0.5 * k} /> : <path className="how-try-cursor" d={CURSOR} transform={`scale(${0.95 * k})`} />}
        </motion.g>
      </motion.g>
    </svg>
  );
}

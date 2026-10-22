import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { TILE_IDS, type Placement } from '../../glyphs';
import { nextSteps, type Doors } from '../../hints';
import { slotKey } from '../../strokes';
import { SAMPLE, coachPlan, sayMove, type WordMove } from '../../tutorial';
import { TIP_TIME, coachTip, strayText, tipText, type Tip } from '../../onboarding';
import { GhostMove, measureGeo, type Geo } from './GhostMove';
import { maxDrawnFor } from './WordEditor';

/** The ghost shows the next move again once the board has been left alone this long (ms). */
const IDLE = 2500;

interface CoachInput {
  /** The sample puzzle is being played (the coach is quiet otherwise). */
  active: boolean;
  /** A new run of the sample (it started, or started over): the coach starts afresh. */
  run: number;
  won: boolean;
  locked: boolean;
  /** Strokes used this step. */
  used: number;
  room: string;
  cells: Placement[][];
  /** Words visited, in order (the first is the start). */
  visited: string[];
  /** Words landed on so far, free returns to a word visited before included (each gets its own tip). */
  landings: number;
  /** The step just made: the word, what it cost, and whether it went back to a word visited before. */
  lastDoor: { word: string; cost: number; back: boolean } | null;
  goal: string;
  doorsOf: Doors | null;
  dict: Set<string>;
  touch: boolean;
}

/**
 * The sample puzzle's coach: which one tip to show (see coachTip), what it says, and the next move
 * for the ghost hand, planned from the letters as they are (see coachPlan). Tips that only tell
 * (the goal, the step's strokes, a word made) go once they're closed, once the player does
 * something, or after a while left alone, when the next move takes over. The ghost shows that move
 * when the board's been left alone a moment (`busy` and `rest` hear the board's presses).
 */
export function useCoach(c: CoachInput) {
  const { active, run, won, locked, used, room, cells, visited, landings, lastDoor, goal, doorsOf, dict, touch } = c;
  const [done, setDone] = useState<ReadonlySet<string>>(() => new Set());
  const [pressing, setPressing] = useState(false);
  const [idle, setIdle] = useState(true);
  const idleTimer = useRef(0);
  const finish = useCallback((key: string) => setDone((d) => (d.has(key) ? d : new Set(d).add(key))), []);

  // A new run starts afresh.
  useEffect(() => {
    setDone(new Set());
    setIdle(true);
    setPressing(false);
    window.clearTimeout(idleTimer.current);
  }, [run]);

  // (Not while the board still shows the puzzle before: the sample's start word comes in with it.)
  const live = active && visited[0] === SAMPLE.start;
  const started = landings > 0 || used > 0;
  const landed = !!lastDoor && !used && !won;
  const tip: Tip | null = live ? coachTip({ won, locked, used, started, words: landings, landed, done }) : null;
  /** The board as it is: any stroke, undo or reset changes it. */
  const sig = `${room}|${cells.map((cell) => cell.map((p) => slotKey(p)).join(',')).join('/')}`;
  const key = tip === 'word' ? `word${landings}` : tip === 'move' ? `move:${sig}` : tip;

  // Done with a tip that only tells, once the board changes after it showed (in the same run).
  const shown = useRef<{ key: string; sig: string; run: number } | null>(null);
  useEffect(() => {
    const prev = shown.current;
    if (prev && prev.run === run && prev.sig !== sig && /^(goal|dots|word)/.test(prev.key)) finish(prev.key);
    shown.current = key ? { key, sig, run } : null;
  }, [key, sig, run, finish]);
  // Or after a while left alone.
  useEffect(() => {
    const ms = tip ? TIP_TIME[tip] : undefined;
    if (!key || !ms || pressing) return;
    const t = window.setTimeout(() => finish(key), ms);
    return () => window.clearTimeout(t);
  }, [key, tip, pressing, finish]);
  // Out of strokes is said again next time the step runs out.
  useEffect(() => {
    if (!locked) setDone((d) => (d.has('out') ? new Set([...d].filter((k) => k !== 'out')) : d));
  }, [locked]);

  // The next move: towards the sample's next word if the player's on its route, or any next word on
  // a lowest route from where they are, as far as the step's strokes left allow.
  const visitedKey = visited.join(' ');
  const plan = useMemo(() => {
    if (!live || won || locked || !doorsOf) return null;
    const on = SAMPLE.path.indexOf(room);
    const ahead = on >= 0 && on < SAMPLE.path.length - 1 ? [SAMPLE.path[on + 1]] : [];
    const targets = [...new Set([...ahead, ...nextSteps(doorsOf, room, goal, new Set(visitedKey.split(' '))).map((s) => s.next)])];
    return { found: coachPlan(cells, targets, used, { touch, stops: (w) => dict.has(w) || w === room }), next: targets[0] };
  }, [live, won, locked, doorsOf, room, goal, visitedKey, cells, used, touch, dict]);

  const hidden = !!key && done.has(key);
  const move: WordMove | null = tip === 'move' && !hidden ? (plan?.found?.moves[0] ?? null) : null;
  let text: string | null = null;
  if (tip === 'move') text = hidden ? null : move ? sayMove(cells, move, touch) : strayText(used, plan?.next);
  else if (tip && !hidden) text = tipText(tip, { start: SAMPLE.start, goal, word: room, cost: lastDoor?.cost, back: lastDoor?.back });

  const rest = useCallback(() => {
    setPressing(false);
    window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setIdle(true), IDLE);
  }, []);
  // A press on the board: busy until it's let go, wherever that is (a mouse can drop a stroke off the
  // board, where only the window hears it).
  const busy = useCallback(() => {
    window.clearTimeout(idleTimer.current);
    setIdle(false);
    setPressing(true);
    const done = () => {
      window.removeEventListener('pointerup', done);
      window.removeEventListener('pointercancel', done);
      rest();
    };
    window.addEventListener('pointerup', done);
    window.addEventListener('pointercancel', done);
  }, [rest]);
  useEffect(() => () => window.clearTimeout(idleTimer.current), []);

  return {
    tip: text ? tip : null,
    text,
    close: () => key && finish(key),
    /** The next move, and the move the ghost shows now (while the board's left alone). */
    move,
    ghost: move && idle ? move : null,
    busy,
    rest,
  };
}

/** A tip from the coach: a bubble pointing up or down at what it's about (`arrowX`: px from its left; centred if not given). */
export function CoachTip({ text, point, arrowX, onClose, children }: { text: string; point: 'up' | 'down' | 'none'; arrowX?: number | null; onClose?: () => void; children?: ReactNode }) {
  return (
    <div className={`coach ${point}`} style={arrowX != null ? ({ '--arrow-x': `${arrowX}px` } as CSSProperties) : undefined}>
      <p className="coach-text" role="status">
        {text}
      </p>
      {children}
      {onClose && (
        <button className="coach-x" aria-label="Close this tip" onClick={onClose}>
          ×
        </button>
      )}
    </div>
  );
}

/**
 * Where a tip's arrow goes: across `box` (the tip's place), in px from its left, over the middle of
 * what `target` finds (or between two things, as Undo and Reset). Null, for the middle, if it finds
 * nothing. Measured again whenever `deps` change (the tip, the layout, the window).
 */
export function useArrowTo(box: RefObject<HTMLElement | null>, target: () => Element | Element[] | null | undefined, deps: unknown[]) {
  const [x, setX] = useState<number | null>(null);
  useLayoutEffect(() => {
    const b = box.current?.getBoundingClientRect();
    const found = target();
    const els = !found ? [] : Array.isArray(found) ? found : [found];
    if (!b?.width || !els.length) return setX(null);
    const mid = els.reduce((sum, e) => {
      const r = e.getBoundingClientRect();
      return sum + r.left + r.width / 2;
    }, 0) / els.length;
    setX(Math.max(20, Math.min(b.width - 20, mid - b.left)));
  }, deps);
  return x;
}

/**
 * The ghost hand over the board's editor (`box` wraps only the editor, so the ghost is measured
 * against it alone), showing `move` in the letters `cells`. Measured again as the editor resizes.
 */
export function BoardGhost({ box, move, cells, touch, still, compact }: { box: RefObject<HTMLDivElement | null>; move: WordMove | null; cells: Placement[][]; touch: boolean; still: boolean; compact: boolean }) {
  const [geo, setGeo] = useState<Geo | null>(null);
  const shown = !!move;
  useLayoutEffect(() => {
    const el = box.current;
    if (!el || !shown) return;
    const measure = () => setGeo(measureGeo(el, TILE_IDS));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [box, shown, cells]);
  if (!geo || !move) return null;
  const g = move.ghost;
  const at = g.kind === 'carry' ? g.to : g.at;
  return (
    <GhostMove
      key={`${move.cell}:${move.from ?? ''}:${g.kind}:${slotKey(at)}:${geo.w}x${geo.h}:${geo.k.toFixed(2)}`}
      move={move}
      cells={cells}
      geo={geo}
      touch={touch}
      still={still}
      maxDrawn={maxDrawnFor(compact, cells.length)}
    />
  );
}

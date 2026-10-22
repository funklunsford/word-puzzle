import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useReduceMotion } from '../../prefs';
import type { Placement } from '../../glyphs';
import { STEP_LIMIT, slotKey } from '../../strokes';
import { TRAY, TUTORIAL, spell, wordCells } from '../../tutorial';
import { GhostMove, measureGeo, type Geo } from './GhostMove';
import { WordEditor } from './WordEditor';

/** Pixels per letter unit in the turn's single cell (the word's five cells share the panel's width). */
const UNIT = 26;
/** The ghost shows the move again once the player has left the practice alone this long (ms). */
const IDLE = 2500;
/** How long a word or letter made is shown before the next part (ms): long enough to read the line. */
const NEXT = 2500;
const noHover = () => {};

/**
 * How to play's practice, in the game's own editor: the word step the demo shows (CRUMB → GRUMP),
 * then a turn (V → A), each within a step's strokes. A ghost hand (a cursor with a mouse) shows the
 * next move whenever the player leaves it alone for a moment, except while the demo plays
 * (`waiting`), so there's one hand at a time. The player's first press stops the demo (`onStart`).
 */
export function HowToTry({ touch, waiting, onStart }: { touch: boolean; waiting: boolean; onStart: () => void }) {
  const reduce = useReduceMotion();
  const [stepIndex, setStepIndex] = useState(0);
  const step = TUTORIAL[stepIndex];
  const [cells, setCells] = useState(() => wordCells(TUTORIAL[0].start));
  /** Strokes spent this step, as the game counts them: one an edit, and none back at the start. */
  const [used, setUsed] = useState(0);
  const [done, setDone] = useState(false);
  const [idle, setIdle] = useState(true);
  const idleTimer = useRef(0);
  const nextTimer = useRef(0);
  const box = useRef<HTMLDivElement>(null);
  const [geo, setGeo] = useState<Geo | null>(null);
  // (Edits are checked against the latest count: a waiting tap's removal can land after a render.)
  const now = useRef({ used, done });
  now.current = { used, done };
  useEffect(() => () => window.clearTimeout(nextTimer.current), []);

  // Measure where things are (the turn has one cell, the word five).
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setGeo(measureGeo(el, TRAY));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [stepIndex]);

  const goTo = (i: number) => {
    setStepIndex(i);
    setCells(wordCells(TUTORIAL[i].start));
    setUsed(0);
    setDone(false);
    window.clearTimeout(idleTimer.current);
    setIdle(true);
  };

  const onEdit = (next: Placement[][]) => {
    // Out of strokes, as in the game: Start over to try again.
    if (now.current.done || now.current.used >= STEP_LIMIT) return false;
    const word = spell(next);
    const spent = word === step.start ? 0 : now.current.used + 1;
    now.current = { used: spent, done: word === step.goal };
    setCells(next);
    setUsed(spent);
    if (word === step.goal) {
      setDone(true);
      if (stepIndex < TUTORIAL.length - 1) nextTimer.current = window.setTimeout(() => goTo(stepIndex + 1), NEXT);
    }
    return true;
  };
  const busy = useCallback(() => {
    window.clearTimeout(idleTimer.current);
    setIdle(false);
    onStart();
  }, [onStart]);
  const rest = useCallback(() => {
    window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setIdle(true), IDLE);
  }, []);
  const startOver = () => {
    setCells(wordCells(step.start));
    setUsed(0);
    window.clearTimeout(idleTimer.current);
    setIdle(true);
  };

  const plan = useMemo(() => (done ? null : step.next(cells, used)), [done, step, cells, used]);
  const say = done ? step.done : plan ? plan.say[touch ? 'touch' : 'mouse'] : step.stray;
  /** The move the ghost is showing, while the player leaves the practice alone (and the demo's done). */
  const ghost = geo && plan && idle && !waiting ? plan.move : null;
  // The ghost starts its loop afresh when the panel is measured anew (a window resized across the side
  // by side layout's width): new keyframes restart where it is, but not when it fades in and out.
  const where = geo ? [geo.w, geo.h, ...geo.cells.flatMap((c) => [c.ox, c.oy])].map(Math.round).join(',') : '';
  // A turn is shown on the stroke itself: the ghost draws it turning, so the editor hides its own.
  const ghosted = ghost?.ghost.kind === 'turn' && !reduce ? `${ghost.cell}|${slotKey(ghost.ghost.at)}` : undefined;
  const out = !done && used >= STEP_LIMIT;
  return (
    <section className="how-try" aria-label="Try it">
      <div className="how-try-head">
        <span className="how-try-label">Try it</span>
        {/* This step's strokes, as under the board: filling as they're used. */}
        <span className={`how-try-meter${done ? ' done' : out ? ' out' : ''}`} role="img" aria-label={`${used} of ${STEP_LIMIT} strokes used`}>
          Strokes
          {Array.from({ length: STEP_LIMIT }, (_, i) => (
            <span key={i} className={i < used ? 'used' : ''} />
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
        <WordEditor
          key={stepIndex}
          cells={cells}
          unit={UNIT}
          compact={cells.length > 1}
          disabled={done}
          room={done ? step.goal : step.start}
          onEdit={onEdit}
          onHoverTile={noHover}
          tray={TRAY}
          ghosted={ghosted}
        />
        {geo && ghost && (
          <GhostMove
            key={`${stepIndex}:${where}:${cells.map((c) => c.map(slotKey).join(',')).join('|')}`}
            move={ghost}
            content={cells[ghost.cell]}
            geo={geo}
            touch={touch}
            still={!!reduce}
          />
        )}
      </div>
    </section>
  );
}

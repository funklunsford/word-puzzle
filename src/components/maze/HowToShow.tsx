import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useReduceMotion } from '../../prefs';
import { inkSeed } from '../../ink';
import { STEP_LIMIT } from '../../strokes';
import { TRAY, TUTORIAL, stepMoves, wordCells } from '../../tutorial';
import { TileStroke, minHalfWidthAt } from '../Glyph';
import { GhostMove, RemoveMark, ghostTiming, grabPoint, measureGeo, type Geo } from './GhostMove';
import { WordEditor, centerOffset } from './WordEditor';

/** The step the demo shows, the practice's first: CRUMB → GRUMP. */
const STEP = TUTORIAL[0];
/** Its moves as the practice plans them (a bar onto the C, then the B's bottom stroke off), worked out when first shown. */
let planned: ReturnType<typeof stepMoves> | null = null;
const demoMoves = () => (planned ??= stepMoves(STEP));
const START = wordCells(STEP.start);
/** Before the first move (the card is still opening), between moves, and after the last (ms). */
const LEAD = 700;
const GAP = 350;
const HOLD = 1200;
/** The editor's unit before it measures its cells (five share the panel's width). */
const UNIT = 26;
const NO_TRAY: readonly [] = [];
const noEdit = () => false;
const noHover = () => {};

/**
 * How to play's demo: a whole word step, CRUMB → GRUMP, played by the ghost hand in the game's own
 * editor (shown, not touched): it carries the bar from the tray onto the C, which becomes G, and
 * takes the B's bottom stroke off, leaving P, and the word lands. It plays once as the card opens
 * (`playing`), then rests on the word made, with Watch again. With reduced motion it's still: the
 * word before, with the strokes that change marked, and after.
 */
export function HowToShow({ touch, playing, onDone, onAgain }: { touch: boolean; playing: boolean; onDone: () => void; onAgain: () => void }) {
  const reduce = useReduceMotion();
  const moves = demoMoves();
  const end = moves[moves.length - 1].after;
  const box = useRef<HTMLDivElement>(null);
  const [geo, setGeo] = useState<Geo | null>(null);
  /** Each play starts the word afresh (and without the glow a word just made gets). */
  const [run, setRun] = useState(0);
  /** The move the ghost is showing (-1: none), the letters so far, and whether this play has made the word. */
  const [shown, setShown] = useState(-1);
  const [cells, setCells] = useState(playing ? START : end);
  const [made, setMade] = useState(!playing);
  /** The player asked to watch again: the button stays (dimmed) while it plays, so it keeps the focus. */
  const [asked, setAsked] = useState(false);
  const finished = useRef(onDone);
  finished.current = onDone;

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setGeo(measureGeo(el, reduce ? NO_TRAY : TRAY));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [reduce]);

  // A play: each move in turn (the ghost changes the letters as it does it, and the last makes the
  // word, which lands there and then, as in the game), then a moment on the word made.
  useEffect(() => {
    if (reduce) return;
    if (!playing) {
      // Played through, or the player has started the practice: it rests on the word made.
      setShown(-1);
      setCells(end);
      return;
    }
    setShown(-1);
    const timers: number[] = [];
    const after = (ms: number, f: () => void) => timers.push(window.setTimeout(f, ms));
    let t = LEAD;
    moves.forEach((m, i) => {
      after(t, () => setShown(i));
      t += ghostTiming(m.move, touch).duration * 1000 + GAP;
    });
    after(t, () => setShown(-1));
    after(t + HOLD, () => finished.current());
    return () => timers.forEach(clearTimeout);
    // (Only a new play starts it over: the hand and the moves don't change while it plays.)
  }, [playing, reduce]);
  // Watch again: the word afresh, as it was before the first move.
  const again = () => {
    if (playing) return;
    setAsked(true);
    setRun((r) => r + 1);
    setCells(START);
    setMade(false);
    onAgain();
  };

  const move = shown >= 0 ? moves[shown] : null;
  return (
    <section className={`how-show${reduce ? ' still' : ''}`} aria-label="Watch">
      <div className="how-try-head">
        <span className="how-try-label">Watch</span>
        {!reduce && (!playing || asked) && (
          <button className="how-show-again" aria-disabled={playing} onClick={again}>
            Watch again
          </button>
        )}
      </div>
      <p className="how-show-caption">Each step, change up to {STEP_LIMIT} strokes to make a new word.</p>
      {/* The demo itself is decorative: the caption and the line under it say what it shows. */}
      {reduce ? (
        <div className="how-show-box" aria-hidden="true" inert>
          <div className="how-show-word" ref={box}>
            <WordEditor cells={START} unit={UNIT} compact disabled room={STEP.start} onEdit={noEdit} onHoverTile={noHover} tray={NO_TRAY} />
            {geo && <Marks geo={geo} />}
          </div>
          <div className="how-show-arrow">↓</div>
          <WordEditor cells={end} unit={UNIT} compact disabled room={STEP.goal} onEdit={noEdit} onHoverTile={noHover} tray={NO_TRAY} />
        </div>
      ) : (
        <div className="how-show-box" ref={box} aria-hidden="true" inert>
          <WordEditor key={run} cells={cells} unit={UNIT} compact disabled room={made ? STEP.goal : STEP.start} onEdit={noEdit} onHoverTile={noHover} tray={TRAY} />
          {geo && move && (
            <GhostMove
              key={`${run}:${shown}`}
              move={move.move}
              content={move.before[move.move.cell]}
              geo={geo}
              touch={touch}
              still={false}
              once
              solid
              onMove={() => {
                setCells(move.after);
                if (shown === moves.length - 1) setMade(true);
              }}
            />
          )}
        </div>
      )}
      <p className={`how-show-made${made || !playing ? ' shown' : ''}`}>
        <strong>{STEP.goal} ✓</strong> a real word, {moves.length} strokes from {STEP.start}.
      </p>
    </section>
  );
}

/**
 * The still demo's marks on the word before: where the bar goes (faint, as the practice's still
 * ghost shows a move), and the stroke that comes off (red, as a stroke under the mouse is, and a ✕).
 */
function Marks({ geo }: { geo: Geo }) {
  const pen = minHalfWidthAt(geo.k);
  return (
    <svg className="how-try-ghost" width={geo.w} height={geo.h} viewBox={`0 0 ${geo.w} ${geo.h}`}>
      {demoMoves().map(({ move: { cell, ghost }, before }) => {
        const p = ghost.kind === 'carry' ? ghost.to : ghost.at;
        const c = geo.cells[cell];
        if (!c) return null;
        const at = (lx: number, ly: number) => ({ x: c.ox + (lx + centerOffset(before[cell])) * geo.k, y: c.oy + ly * geo.k });
        const { x, y } = at(p.x, p.y);
        const g = grabPoint(p);
        return (
          <g key={cell}>
            <g transform={`translate(${x} ${y}) scale(${geo.k})`} opacity={ghost.kind === 'carry' ? 0.5 : 1}>
              <TileStroke tile={p.tile} rot={p.rot ?? 0} seed={inkSeed(p)} minHalfWidth={pen} fill={ghost.kind === 'remove' ? 'var(--remove)' : undefined} />
            </g>
            {ghost.kind === 'remove' && <RemoveMark {...at(g.x, g.y)} k={geo.k} />}
          </g>
        );
      })}
    </svg>
  );
}

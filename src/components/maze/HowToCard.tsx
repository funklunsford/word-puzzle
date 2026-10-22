import type { ReactNode, RefObject } from 'react';
import { LETTERS, TILES, drawnScale, drawnWidth, type Placement, type TileId } from '../../glyphs';
import { inkSeed } from '../../ink';
import { oneWayCost, slotKey } from '../../strokes';
import { SCORE_KEY } from '../../golf';
import { SAMPLE, SAMPLE_STEP, moveLines, stepChanges } from '../../tutorial';
import { GlyphWord, PlacedStrokes, TileStroke, minHalfWidthAt } from '../Glyph';
import { AddMark, RemoveMark, grabPoint } from './GhostMove';

const PAD = 0.3;
const GAP = 0.7;
type Marks = { removed?: Placement[]; added?: Placement[] };

/** Crossed out, on a stroke drawn in units at `k` px a unit. */
const CrossOut = ({ p, k }: { p: Placement; k: number }) => {
  const g = grabPoint(p);
  return (
    <g transform={`translate(${g.x} ${g.y}) scale(${1 / k})`}>
      <RemoveMark x={0} y={0} k={k} />
    </g>
  );
};

/**
 * A word drawn as the game draws it (see GlyphWord), with strokes marked by shape as well as colour:
 * one that goes on outlined in green, one that comes off red and crossed out. `size` is its cap height in px.
 */
function MarkedWord({ word, size, marks = [], label }: { word: string; size: number; marks?: Marks[]; label?: string }) {
  const k = size / 2;
  let x = 0;
  const letters = [...word].map((ch, i) => {
    const at = x;
    x += drawnWidth(ch) + GAP;
    return { ch, at, marks: marks[i] ?? {} };
  });
  const w = Math.max(x - GAP, 0) + PAD * 2;
  const h = 2 + PAD * 2 + 0.6;
  return (
    <svg viewBox={`${-PAD} ${-PAD} ${w} ${h}`} width={k * w} height={k * h} role="img" aria-label={label ?? word}>
      {letters.map(({ ch, at, marks: m }, i) => {
        // (Marks sit where a squeezed or spread letter draws its strokes: see drawnScale.)
        const { squeeze = 1, spread = 1 } = LETTERS[ch];
        const moved = (p: Placement) => ({ ...p, x: p.x * drawnScale(ch).place });
        const off = new Set(m.removed?.map((p) => slotKey(p)));
        return (
          <g key={i} transform={`translate(${at} 0)`}>
            {m.added?.map((p, j) => <AddMark key={j} p={moved(p)} k={k} />)}
            {LETTERS[ch].parts.map((p, j) => (
              <TileStroke
                key={j}
                tile={p.tile}
                rot={p.rot}
                x={p.x * squeeze * spread}
                y={p.y}
                seed={inkSeed(p)}
                minHalfWidth={minHalfWidthAt(k)}
                squeeze={squeeze}
                look={p.look}
                fill={off.has(slotKey(p)) ? 'var(--remove)' : undefined}
              />
            ))}
            {m.removed?.map((p, j) => <CrossOut key={j} p={moved(p)} k={k} />)}
          </g>
        );
      })}
    </svg>
  );
}

/** A stroke as it sits in the tray: a tile in its colour. `size` is the tile's side in px. */
function TrayTile({ tile, size }: { tile: TileId; size: number }) {
  return (
    <svg className="how-tile" viewBox="-1.2 -1.2 2.4 2.4" width={size} height={size} style={{ ['--tile' as string]: `var(--t-${tile})` }} aria-hidden="true">
      <rect x={-1.15} y={-1.15} width={2.3} height={2.3} rx={0.5} />
      <TileStroke tile={tile} rot={TILES[tile].display ?? 0} minHalfWidth={minHalfWidthAt(size / 2.4)} />
    </svg>
  );
}

const ARROW = 'M0 0 L1 0 M0.7 -0.28 L1 0 L0.7 0.28';

/**
 * The four moves' drawings, marked as the step is: a bar from a tray tile onto a T; E's bottom bar
 * crossed out; L's foot bar, moved down from the top; a V turned over. `size` is a letter's cap height in px.
 */
function MovePicture({ move, size }: { move: number; size: number }) {
  const k = size / 2;
  const view = (w: number, children: ReactNode) => (
    <svg viewBox={`${-PAD} ${-PAD} ${w + 2 * PAD} ${2.6 + PAD}`} width={(w + 2 * PAD) * k} height={(2.6 + PAD) * k} aria-hidden="true">
      {children}
    </svg>
  );
  const pen = minHalfWidthAt(k);
  const arrow = (
    <svg className="how-move-arrow" viewBox="-0.1 -0.5 1.2 1" width={k * 1.1} height={k} aria-hidden="true">
      <path d={ARROW} />
    </svg>
  );
  if (move === 0) {
    const T = LETTERS.T.parts;
    return (
      <span className="how-move-pic">
        <TrayTile tile="H" size={k * 1.7} />
        {arrow}
        {view(
          1,
          <>
            <AddMark p={T[0]} k={k} />
            <PlacedStrokes parts={T} minHalfWidth={pen} />
          </>,
        )}
      </span>
    );
  }
  if (move === 1) {
    const E = LETTERS.E.parts;
    return (
      <span className="how-move-pic">
        {view(
          1,
          <>
            {E.map((p, i) => (
              <TileStroke key={i} tile={p.tile} rot={p.rot} x={p.x} y={p.y} seed={inkSeed(p)} minHalfWidth={pen} fill={i === 3 ? 'var(--remove)' : undefined} />
            ))}
            <CrossOut p={E[3]} k={k} />
          </>,
        )}
      </span>
    );
  }
  if (move === 2) {
    // Where the bar was (at the top, faint) and where it goes (the foot, outlined), an arrow between.
    const [stem, foot] = LETTERS.L.parts;
    const was = { tile: 'H' as const, x: 0.5, y: 0, rot: 0 };
    return (
      <span className="how-move-pic">
        {view(
          1.7,
          <>
            <g opacity={0.35}>
              <TileStroke tile="H" x={was.x} y={was.y} seed={inkSeed(was)} minHalfWidth={pen} />
            </g>
            <AddMark p={foot} k={k} />
            <PlacedStrokes parts={[stem, foot]} minHalfWidth={pen} />
            <path className="how-move-path" d="M1.2 0 C1.75 0.4 1.75 1.5 1.25 1.95 M1.25 1.95 L1.62 1.86 M1.25 1.95 L1.3 1.57" />
          </>,
        )}
      </span>
    );
  }
  // V turned over: Λ, outlined, with an arrow going round between.
  const V = LETTERS.V.parts[0];
  return (
    <span className="how-move-pic">
      {view(2, <PlacedStrokes parts={[V]} minHalfWidth={pen} />)}
      <svg className="how-move-arrow" viewBox="-1 -1 2 2" width={k * 1.2} height={k * 1.2} aria-hidden="true">
        <path d="M0.7 -0.1 A0.7 0.7 0 1 1 0.15 -0.68 M0.15 -0.68 L-0.2 -0.85 M0.15 -0.68 L-0.12 -0.38" />
      </svg>
      {view(
        2,
        <>
          <AddMark p={{ ...V, rot: 180 }} k={k} />
          <PlacedStrokes parts={[{ ...V, rot: 180 }]} minHalfWidth={pen} />
        </>,
      )}
    </span>
  );
}

interface Props {
  /** A finger (taps, double-taps) or a mouse (clicks, swipes). */
  touch: boolean;
  /** The phone layout: the drawings a little smaller, to fit its width. */
  compact: boolean;
  /** The card opened by itself, on a first visit: it offers the sample, or skipping to today's puzzle. */
  firstVisit: boolean;
  /** The sample can be played now (the 5-letter game, with nothing in progress to lose). */
  canSample: boolean;
  /** The sample's been played through before. */
  sampled: boolean;
  easycore: boolean;
  inkPots: boolean;
  closeRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onSample: () => void;
  onSkip: () => void;
}

/**
 * How to play: the goal (the sample puzzle's route, as the path card draws one), a step of it with
 * its changes marked, and the four moves, all still, in the game's own strokes and the player's
 * colours. The rest is under More. On a first visit it leads to the sample puzzle on the real board.
 */
export function HowToCard({ touch, compact, firstVisit, canSample, sampled, easycore, inkPots, closeRef, onClose, onSample, onSkip }: Props) {
  const [start, ...rest] = SAMPLE.path;
  const costs = rest.map((w, i) => oneWayCost(SAMPLE.path[i], w));
  const from = SAMPLE.path[SAMPLE_STEP];
  const to = SAMPLE.path[SAMPLE_STEP + 1];
  const changes = stepChanges(from, to);
  const strokes = costs[SAMPLE_STEP];
  /** Cap heights (px): the route's words, the step's, the moves' letters. */
  const [chip, word, letter] = compact ? [12, 26, 26] : [14, 34, 30];
  return (
    <>
      <div className="help-head">
        <h2 id="help-title">How to play</h2>
        <button ref={closeRef} className="close" aria-label="Close how to play" onClick={onClose}>
          ×
        </button>
      </div>

      <section className="how-part" aria-labelledby="how-goal">
        <div className="how-label-row">
          <h3 className="how-label" id="how-goal">
            The goal
          </h3>
          <span className="how-total">{SAMPLE.best} strokes</span>
        </div>
        <ol className="how-ladder" aria-label={`${start} to ${SAMPLE.goal} in ${SAMPLE.best} strokes`}>
          <li className="how-chip start">
            <span className="tag">start</span>
            <GlyphWord word={start} size={chip} />
          </li>
          {rest.map((w, i) => (
            <li key={w} className="how-rung">
              <span className="cost" aria-label={`${costs[i]} strokes to`}>
                +{costs[i]}
              </span>
              <span className={`how-chip${w === SAMPLE.goal ? ' goal' : ''}`}>
                {w === SAMPLE.goal && <span className="tag">goal</span>}
                <GlyphWord word={w} size={chip} />
              </span>
            </li>
          ))}
        </ol>
        <p className="how-text">Turn the start word into the goal word, one real word at a time. Fewest strokes wins.</p>
      </section>

      <section className="how-part" aria-labelledby="how-step">
        <h3 className="how-label" id="how-step">
          Each step
        </h3>
        <div className="how-step">
          <MarkedWord word={from} size={word} marks={changes.map((c) => ({ removed: c.removed }))} label={`${from}, the strokes that come off crossed out`} />
          <span className="how-step-arrow">
            <svg viewBox="-0.1 -0.5 1.2 1" width={28} height={16} aria-hidden="true">
              <path d={ARROW} />
            </svg>
            <span>{strokes} strokes</span>
          </span>
          <MarkedWord word={to} size={word} marks={changes.map((c) => ({ added: c.added }))} label={`${to}, the strokes that go on outlined`} />
        </div>
        <p className="how-text">Change up to 3 strokes. Every step must make a real word.</p>
      </section>

      <section className="how-part" aria-labelledby="how-moves">
        <h3 className="how-label" id="how-moves">
          The moves
        </h3>
        <ul className="how-moves">
          {moveLines(touch).map((line, i) => (
            <li key={i}>
              <MovePicture move={i} size={letter} />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </section>

      <details className="how-more">
        <summary>More</summary>
        <ul className="how">
          <li>Going back to a word you've visited is free.</li>
          <li>Your score is named like golf: {SCORE_KEY}.</li>
          <li>Stuck? {touch ? 'Tap' : 'Click'} Hint for the next word's meaning, then the letters to change, then the word.</li>
          {easycore && <li>Want it easier? Choose Easycore in Settings: shorter puzzles with everyday words, and a daily of their own.</li>}
          <li>Want a challenge? {easycore ? 'Choose' : 'Turn on'} Hardcore in Settings (it starts the puzzle over): only words on a lowest-stroke route count, and no hints.</li>
          {inkPots && <li>Ink pots: the first time you reach a pot word, you bank a free stroke for a later step.</li>}
        </ul>
      </details>

      <div className="how-actions">
        {firstVisit && canSample ? (
          <>
            <button className="pill help-go" onClick={onSample}>
              Try a sample puzzle
            </button>
            <button className="link-btn how-skip" onClick={onSkip}>
              Skip to today's puzzle
            </button>
          </>
        ) : (
          <>
            <button className="pill help-go" onClick={onClose}>
              Play
            </button>
            {canSample && (
              <button className="link-btn how-skip" onClick={onSample}>
                {sampled ? 'Try the sample puzzle again' : 'Try a sample puzzle'}
              </button>
            )}
          </>
        )}
      </div>
    </>
  );
}

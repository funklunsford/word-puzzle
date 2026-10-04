import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { LETTERS, recipe, type Placement, type TileId } from './glyphs';
import { STEP_LIMIT, exits, recognize, wordDistance } from './strokes';
import { WordEditor } from './components/maze/WordEditor';
import { Glyph, GlyphWord } from './components/Glyph';

interface Puzzle {
  start: string;
  goal: string;
  best: number;
  path: string[];
}

interface MazeData {
  words: string[];
  puzzle: Puzzle;
}

interface Visit {
  word: string;
  cost: number;
}

/** Layout: page width cap, the left column's width and the gap, and the width where it appears. */
const MAX_W = 980;
const PANEL_W = 220;
const GAP = 16;
const SIDE_MIN = 760;

const cellsFor = (word: string): Placement[][] => [...word].map((ch) => LETTERS[ch].parts.map((p) => ({ ...p })));

function useWidth() {
  const [w, setW] = useState(() => window.innerWidth);
  useEffect(() => {
    const on = () => setW(window.innerWidth);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return w;
}

export function MazeApp() {
  const [data, setData] = useState<MazeData | null>(null);
  const [room, setRoom] = useState('');
  const [cells, setCells] = useState<Placement[][]>([]);
  const [history, setHistory] = useState<Placement[][][]>([]);
  const [trail, setTrail] = useState<Visit[]>([]);
  const [spent, setSpent] = useState(0);
  const [hoverTile, setHoverTile] = useState<TileId | null>(null);
  const [reveal, setReveal] = useState(false);
  const width = useWidth();

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}mazes.json`)
      .then((r) => r.json())
      .then(setData);
  }, []);

  const puzzle = data?.puzzle;
  const dict = useMemo(() => new Set(data?.words ?? []), [data]);

  const restart = useCallback(() => {
    if (!puzzle) return;
    setRoom(puzzle.start);
    setCells(cellsFor(puzzle.start));
    setHistory([]);
    setTrail([{ word: puzzle.start, cost: 0 }]);
    setSpent(0);
    setReveal(false);
  }, [puzzle]);
  useEffect(restart, [restart]);

  const roomExits = useMemo(() => (data && room ? exits(room, data.words) : []), [data, room]);

  const won = !!puzzle && room === puzzle.goal;
  const stepEdits = history.length;
  const locked = stepEdits >= STEP_LIMIT;

  const onEdit = useCallback(
    (next: Placement[][]) => {
      if (won || locked) return;
      const letters = next.map(recognize);
      const word = letters.every(Boolean) ? letters.join('') : null;
      if (word === room) {
        // Back to where this step started: refund it.
        setCells(cellsFor(room));
        setHistory([]);
        return;
      }
      if (word && dict.has(word)) {
        const cost = stepEdits + 1;
        setSpent((s) => s + cost);
        setRoom(word);
        setCells(cellsFor(word));
        setHistory([]);
        setTrail((t) => [...t, { word, cost }]);
        return;
      }
      setHistory((h) => [...h, cells]);
      setCells(next);
    },
    [won, locked, room, dict, stepEdits, cells],
  );

  const undo = () => {
    if (!history.length) return;
    setCells(history[history.length - 1]);
    setHistory((h) => h.slice(0, -1));
  };
  const resetStep = () => {
    if (!history.length) return;
    setCells(cellsFor(room));
    setHistory([]);
  };

  if (!data || !puzzle || !room) return <div className="maze loading">Loading…</div>;

  // Two columns (step panel | play area) when there's room, otherwise one stacked column.
  const side = width >= SIDE_MIN;
  const available = Math.min(width, MAX_W) - 32 - (side ? PANEL_W + GAP : 0) - 26;
  const unit = Math.max(13, Math.min(34, available / 17.5));
  const visited = new Set(trail.map((v) => v.word));
  const found = roomExits.filter((x) => visited.has(x.word)).length;
  const lettersWithTile = hoverTile ? new Set(Object.keys(LETTERS).filter((ch) => recipe(ch).has(hoverTile))) : null;
  const toGoal = wordDistance(room, puzzle.goal);
  const used = spent + stepEdits;

  // The step after a door opens, until the next stroke: confirm it (completion feedback).
  const justOpened = !won && !stepEdits && trail.length > 1;

  // Four regions: where you're going (top), this step (left), the play area (centre), and the
  // path so far with game controls (bottom).
  return (
    <MotionConfig reducedMotion="user">
      <div className={`maze${side ? ' side' : ''}`} style={side ? { gridTemplateColumns: `${PANEL_W}px 1fr` } : undefined}>
        <header className="topbar">
          <h1>Stroke Maze</h1>
          <div className="goal">
            <span className="label">Reach</span>
            <GlyphWord word={puzzle.goal} size={22} />
          </div>
          <div className="score">
            <strong>{used}</strong> {used === 1 ? 'stroke' : 'strokes'} used
            <span className="meta"> · best {puzzle.best}</span>
          </div>
        </header>

        <section className="step-panel" aria-label="This step">
          <span className="label">This step</span>
          <div className="step-meter">
            <div className="pips" aria-label={`${stepEdits} of ${STEP_LIMIT} strokes this step`}>
              {Array.from({ length: STEP_LIMIT }, (_, i) => (
                <span key={i} className={`pip${i < stepEdits ? ' used' : ''}`} />
              ))}
            </div>
            <span className="step-count">
              {stepEdits} of {STEP_LIMIT} strokes
            </span>
          </div>
          <p className={`step-status${locked ? ' out' : justOpened ? ' opened' : ''}`}>
            {locked
              ? 'Out of strokes for this step. Undo to try another way.'
              : stepEdits
                ? 'Keep going: land on a real word to open a door.'
                : justOpened
                  ? `Door opened: ${room} (+${trail[trail.length - 1].cost}). Find the next one.`
                  : 'Change the word into another real word to open a door.'}
          </p>
          <div className="step-buttons">
            <button onClick={undo} disabled={!history.length}>
              Undo
            </button>
            <button onClick={resetStep} disabled={!history.length}>
              Reset step
            </button>
          </div>
        </section>

        <section className="how-panel" aria-label="How to play">
          <span className="label">How to play</span>
          <ul className="how">
            <li>Drag strokes in from the tray.</li>
            <li>Tap a stroke to remove it, or drag it to move it.</li>
            <li>Starting a new letter with a chevron, arc or bowl? Hold it over its spot and circle the cursor around it to turn it.</li>
          </ul>
        </section>

        <main className="stage">
          <AnimatePresence>
            {won && (
              <motion.div className="win" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                You reached {puzzle.goal} in {spent} strokes. Best possible: {puzzle.best}.
              </motion.div>
            )}
          </AnimatePresence>
          <div className="room-head">
            <span className="label">You are in</span>
            <span className="meta">
              {roomExits.length} {roomExits.length === 1 ? 'door' : 'doors'}
              {found ? ` · ${found} explored` : ''}
              {!won && toGoal <= STEP_LIMIT ? ' · the goal is one step away' : ''}
            </span>
          </div>
          <WordEditor cells={cells} unit={unit} disabled={won || locked} room={room} onEdit={onEdit} onHoverTile={setHoverTile} />
          <div className="letters" aria-label="Letters by stroke">
            {Object.keys(LETTERS).map((ch) => (
              <span
                key={ch}
                className={`ref-letter${lettersWithTile ? (lettersWithTile.has(ch) ? ' match' : ' dim') : ''}`}
              >
                <Glyph letter={ch} size={13} />
              </span>
            ))}
          </div>
        </main>

        <footer className="journey">
          <div className="trail">
            <span className="label">Your path</span>
            <ol>
              {trail.map((v, i) => {
                const isHere = i === trail.length - 1;
                return (
                  <motion.li
                    key={i}
                    className={isHere ? 'here' : ''}
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
                  >
                    {i > 0 && <span className="cost">+{v.cost}</span>}
                    <GlyphWord word={v.word} size={14} />
                    {isHere && <span className="meta">{won ? 'goal' : 'here'}</span>}
                  </motion.li>
                );
              })}
            </ol>
          </div>
          <div className="playtest">
            <button onClick={restart}>Restart</button>
            <button onClick={() => setReveal((r) => !r)}>{reveal ? 'Hide' : 'Show'} best route</button>
          </div>
          {reveal && (
            <p className="answers">
              {puzzle.path.join(' → ')} ({puzzle.best} strokes)
              <br />
              Doors from {room}: {roomExits.map((x) => `${x.word} (${x.cost})`).join(', ')}
            </p>
          )}
        </footer>
      </div>
    </MotionConfig>
  );
}

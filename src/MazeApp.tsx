import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { LETTERS, recipe, type Placement, type TileId } from './glyphs';
import { STEP_LIMIT, exits, recognize, wordDistance } from './strokes';
import { buildGraph, randomPuzzle, type Graph, type Puzzle } from './maze';
import { Masthead } from './components/maze/Masthead';
import { WordEditor } from './components/maze/WordEditor';
import { Glyph, GlyphWord } from './components/Glyph';

interface MazeData {
  words: string[];
  puzzle: Puzzle;
}

interface Visit {
  word: string;
  cost: number;
}

/** Layout: the main column's width cap, the side card's width, and the width where the card sits beside it. */
const COLUMN_W = 640;
const SIDE_W = 260;
const SIDE_MIN = 1000;

const HELP_KEY = 'strokes:seen-help';
/** Storage can be missing or blocked (private windows); then help just opens every time. */
const seenHelp = () => {
  try {
    return localStorage.getItem(HELP_KEY) === '1';
  } catch {
    return false;
  }
};
const markHelpSeen = () => {
  try {
    localStorage.setItem(HELP_KEY, '1');
  } catch {
    // ignore
  }
};

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
  // How to play opens on a player's very first visit only.
  const [help, setHelp] = useState(() => !seenHelp());
  useEffect(() => markHelpSeen(), []);
  const width = useWidth();

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}mazes.json`)
      .then((r) => r.json())
      .then(setData);
  }, []);

  // Dev only: a random start and goal in place of the fixed puzzle (see randomPuzzle).
  const [custom, setCustom] = useState<Puzzle | null>(null);
  const [generating, setGenerating] = useState(false);
  const graph = useRef<Graph | null>(null);
  const newPuzzle = () => {
    if (!data || generating) return;
    setGenerating(true);
    // Building the graph takes ~0.5 s the first time; let the button show it's working first.
    setTimeout(() => {
      graph.current ??= buildGraph(data.words);
      let next = randomPuzzle(data.words, graph.current);
      while (next.start === puzzle?.start && next.goal === puzzle?.goal) next = randomPuzzle(data.words, graph.current);
      setCustom(next);
      setGenerating(false);
    }, 30);
  };

  const puzzle = custom ?? data?.puzzle;
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

  // The main column (score, board, step controls) with the path card beside it when there's room.
  const side = width >= SIDE_MIN;
  const column = Math.min(width - 32, COLUMN_W);
  // Board padding, gaps between letter tiles and their own padding come off before sizing the word.
  const unit = Math.max(13, Math.min(32, (column - 36 - 30 - 48) / 16));
  const visited = new Set(trail.map((v) => v.word));
  const found = roomExits.filter((x) => visited.has(x.word)).length;
  const lettersWithTile = hoverTile ? new Set(Object.keys(LETTERS).filter((ch) => recipe(ch).has(hoverTile))) : null;
  const toGoal = wordDistance(room, puzzle.goal);
  const used = spent + stepEdits;

  // The step after a door opens, until the next stroke: confirm it (completion feedback).
  const justOpened = !won && !stepEdits && trail.length > 1;

  return (
    <MotionConfig reducedMotion="user">
      <div className={`maze${side ? ' side' : ''}`} style={side ? { gridTemplateColumns: `minmax(0, ${COLUMN_W}px) ${SIDE_W}px` } : undefined}>
        <Masthead />

        <main className="column">
          <section className="scorecard">
            <button className="help-btn" aria-label="How to play" aria-expanded={help} onClick={() => setHelp((h) => !h)}>
              ?
            </button>
            <div className={`goal-panel${won ? ' reached' : ''}`}>
              <span className="label">{won ? 'Reached' : 'Goal'}</span>
              <GlyphWord word={puzzle.goal} size={unit * 1.3} />
              {!won && toGoal <= STEP_LIMIT && <div className="score-hint">One step away</div>}
            </div>
            <div className="score-panel">
              <div className="score-big">
                <strong>{used}</strong> <span>{used === 1 ? 'stroke' : 'strokes'}</span>
              </div>
              <div className="score-sub">
                <span>best {puzzle.best}</span>
                <span>
                  {roomExits.length} {roomExits.length === 1 ? 'door' : 'doors'} here
                  {found ? ` (${found} explored)` : ''}
                </span>
              </div>
            </div>
          </section>

          {help && (
            <section className="help-card" aria-label="How to play">
              <div className="help-head">
                <span className="label">How to play</span>
                <button className="close" aria-label="Close how to play" onClick={() => setHelp(false)}>
                  ×
                </button>
              </div>
              <ul className="how">
                <li>Change the word into another real word, up to 3 strokes per step, to open a door.</li>
                <li>Drag strokes in from the tray. Tap a stroke to remove it, or drag it to move it.</li>
                <li>Starting a new letter with a chevron, arc or bowl? Hold it over its spot and circle the cursor around it to turn it.</li>
              </ul>
            </section>
          )}

          <section className="board">
            <AnimatePresence>
              {won && (
                <motion.div className="win" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  You reached {puzzle.goal} in {spent} strokes. Best possible: {puzzle.best}.
                </motion.div>
              )}
            </AnimatePresence>
            <span className="label">You are in</span>
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
          </section>

          <section className="controls" aria-label="This step">
            <div className="pill-row">
              <button className="pill" onClick={undo} disabled={!history.length}>
                Undo
              </button>
              <button className="pill" onClick={resetStep} disabled={!history.length}>
                Reset step
              </button>
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
            <div className="step-meter">
              <span>This step:</span>
              <span className="pips" aria-label={`${stepEdits} of ${STEP_LIMIT} strokes this step`}>
                {Array.from({ length: STEP_LIMIT }, (_, i) => (
                  <span key={i} className={`pip${i < stepEdits ? ' used' : ''}`} />
                ))}
              </span>
            </div>
          </section>
        </main>

        <aside className="side-card">
          <span className="label">Your path</span>
          <ol className="trail">
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
            {!won && (
              <li className="goal-chip" aria-label={`Goal: ${puzzle.goal}`}>
                <span className="cost">goal</span>
                <GlyphWord word={puzzle.goal} size={14} />
              </li>
            )}
          </ol>
          <div className="pill-row">
            <button className="pill quiet" onClick={restart}>
              Restart
            </button>
            <button className="pill quiet" onClick={() => setReveal((r) => !r)}>
              {reveal ? 'Hide' : 'Show'} best route
            </button>
          </div>
          {import.meta.env.DEV && (
            <div className="dev-tools">
              <span className="label">Dev</span>
              <button className="pill quiet" onClick={newPuzzle} disabled={generating}>
                {generating ? 'Generating…' : 'New start & goal'}
              </button>
              {custom && (
                <button className="pill quiet" onClick={() => setCustom(null)}>
                  Back to {data.puzzle.start} → {data.puzzle.goal}
                </button>
              )}
            </div>
          )}
          {reveal && (
            <p className="answers">
              {puzzle.path.join(' → ')} ({puzzle.best} strokes)
              <br />
              Doors from {room}: {roomExits.map((x) => `${x.word} (${x.cost})`).join(', ')}
            </p>
          )}
        </aside>
      </div>
    </MotionConfig>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
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
  puzzles: Puzzle[];
}

interface Visit {
  word: string;
  cost: number;
}

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
  const [pi, setPi] = useState(0);
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

  const puzzle = data?.puzzles[pi];
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

  const wide = width >= 720;
  const available = Math.min(width, 760) - 32 - (wide ? 72 : 0);
  const unit = Math.max(13, Math.min(28, available / 17.5));
  const visited = new Set(trail.map((v) => v.word));
  const found = roomExits.filter((x) => visited.has(x.word)).length;
  const lettersWithTile = hoverTile ? new Set(Object.keys(LETTERS).filter((ch) => recipe(ch).has(hoverTile))) : null;
  const toGoal = wordDistance(room, puzzle.goal);

  return (
    <div className={`maze${wide ? ' wide' : ''}`}>
      <div className="maze-main">
        <header className="top">
          <h1>Stroke Maze</h1>
          <select value={pi} onChange={(e) => setPi(Number(e.target.value))} aria-label="Puzzle">
            {data.puzzles.map((_, i) => (
              <option key={i} value={i}>
                Maze {i + 1}
              </option>
            ))}
          </select>
        </header>

        <section className="goal">
          <span className="label">Reach</span>
          <GlyphWord word={puzzle.goal} size={22} />
          <span className="meta">
            {spent + stepEdits} {spent + stepEdits === 1 ? 'stroke' : 'strokes'} used · best {puzzle.best}
          </span>
        </section>

        <section className="room">
          <div className="room-head">
            <span className="label">You are in</span>
            <span className="meta">
              {roomExits.length} {roomExits.length === 1 ? 'door' : 'doors'}
              {found ? ` · ${found} explored` : ''}
              {!won && toGoal <= STEP_LIMIT ? ' · the goal is one step away' : ''}
            </span>
          </div>

          <WordEditor cells={cells} unit={unit} disabled={won || locked} onEdit={onEdit} onHoverTile={setHoverTile} />

          <div className="step">
            <span className="pips" aria-label={`${stepEdits} of ${STEP_LIMIT} strokes this step`}>
              {Array.from({ length: STEP_LIMIT }, (_, i) => (
                <span key={i} className={`pip${i < stepEdits ? ' used' : ''}`} />
              ))}
            </span>
            <span className="step-msg">
              {locked
                ? 'Out of strokes for this step. Undo to try another way.'
                : stepEdits
                  ? 'Keep going: land on a real word to open a door.'
                  : 'Drag strokes on, off, or around. Up to 3 per step.'}
            </span>
            <button onClick={undo} disabled={!history.length}>
              Undo
            </button>
            <button onClick={resetStep} disabled={!history.length}>
              Reset step
            </button>
          </div>
        </section>

        <AnimatePresence>
          {won && (
            <motion.div className="win" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              You reached {puzzle.goal} in {spent} strokes. Best possible: {puzzle.best}.
            </motion.div>
          )}
        </AnimatePresence>

        <section className="trail">
          <span className="label">Your path</span>
          <ol>
            {trail.map((v, i) => {
              const isHere = i === trail.length - 1;
              return (
                <li key={i} className={isHere ? 'here' : ''}>
                  {i > 0 && <span className="cost">+{v.cost}</span>}
                  <GlyphWord word={v.word} size={14} />
                  {isHere && <span className="meta">{won ? 'goal' : 'here'}</span>}
                </li>
              );
            })}
          </ol>
        </section>

        <footer className="playtest">
          <button onClick={restart}>Restart</button>
          <button onClick={() => setReveal((r) => !r)}>{reveal ? 'Hide' : 'Show'} best route</button>
          {reveal && (
            <p className="answers">
              {puzzle.path.join(' → ')} ({puzzle.best} strokes)
              <br />
              Doors from {room}: {roomExits.map((x) => `${x.word} (${x.cost})`).join(', ')}
            </p>
          )}
        </footer>
      </div>

      <aside className="letters" aria-label="Letters by stroke">
        {Object.keys(LETTERS).map((ch) => (
          <span
            key={ch}
            className={`ref-letter${lettersWithTile ? (lettersWithTile.has(ch) ? ' match' : ' dim') : ''}`}
          >
            <Glyph letter={ch} size={13} />
          </span>
        ))}
      </aside>
    </div>
  );
}

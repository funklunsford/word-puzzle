import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useAnimate } from 'motion/react';
import { LETTERS, recipe, type TileId } from './glyphs';
import {
  newGame,
  play,
  playableLetters,
  remainingWords,
  tilesFor,
  type Board as BoardData,
  type GameState,
  type Play,
} from './game';
import { Board } from './components/Board';
import { Keyboard } from './components/Keyboard';
import { WordLine } from './components/WordLine';
import { GlyphWord } from './components/Glyph';

type Toast = { id: number; text: string; tone: 'good' | 'bad' };

function describe(p: Play): string {
  const parts = [`+${p.score}`];
  if (p.pangram) parts.push('PANGRAM!');
  if (p.spicy) parts.push('🌶️ ×2');
  return parts.join('  ');
}

export function App() {
  const [boards, setBoards] = useState<BoardData[]>([]);
  const [boardIdx, setBoardIdx] = useState(0);
  const [state, setState] = useState<GameState | null>(null);
  const [word, setWord] = useState('');
  const [toast, setToast] = useState<Toast | null>(null);
  const [showAnswers, setShowAnswers] = useState(false);
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [hoverTile, setHoverTile] = useState<TileId | null>(null);
  const [pinnedTile, setPinnedTile] = useState<TileId | null>(null);
  const [width, setWidth] = useState(() => Math.min(window.innerWidth, 640) - 32);
  const [scope, animateWord] = useAnimate();
  const tileEls = useRef(new Map<TileId, Element>());

  const board = boards[boardIdx];

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}boards.json`)
      .then((r) => r.json())
      .then(setBoards);
    const onResize = () => setWidth(Math.min(window.innerWidth, 640) - 32);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!board) return;
    setState(newGame(board));
    setWord('');
    setShowAnswers(false);
    setPinnedTile(null);
  }, [board]);

  const registerTile = useCallback((tile: TileId, el: Element | null) => {
    if (el) tileEls.current.set(tile, el);
  }, []);
  const tileEl = useCallback((tile: TileId) => tileEls.current.get(tile) ?? null, []);

  const playable = useMemo(() => (board ? playableLetters(board.tiles) : new Set<string>()), [board]);
  const remaining = useMemo(() => (board && state ? remainingWords(state, board) : []), [board, state]);

  const say = (text: string, tone: Toast['tone']) => setToast({ id: Date.now(), text, tone });

  const onKey = useCallback(
    (key: string) => {
      if (!board || !state) return;
      if (key === 'Backspace') return setWord((w) => w.slice(0, -1));
      if (key === 'Enter') {
        const result = play(state, board, word);
        if ('error' in result) {
          say(result.error, 'bad');
          animateWord(scope.current, { x: [0, -12, 12, -8, 8, -3, 0] }, { duration: 0.4 });
          return;
        }
        setState(result.state);
        setWord('');
        say(describe(result.play), 'good');
        return;
      }
      const ch = key.toUpperCase();
      if (ch.length === 1 && playable.has(ch) && word.length < 15) setWord((w) => w + ch);
    },
    [board, state, word, playable, animateWord, scope],
  );

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Enter' || e.key === 'Backspace' || /^[a-z]$/i.test(e.key)) {
        e.preventDefault();
        onKey(e.key);
      }
    };
    window.addEventListener('keydown', onDown);
    return () => window.removeEventListener('keydown', onDown);
  }, [onKey]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  if (!board || !state) return <div className="app loading">Loading…</div>;

  const inUse = tilesFor(word);
  const focusTile = hoverTile ?? pinnedTile;
  const preview = hoverKey ? recipe(hoverKey) : null;
  const matches = focusTile ? new Set(Object.keys(LETTERS).filter((ch) => recipe(ch).has(focusTile))) : null;
  const pangramFound = state.plays.some((p) => p.pangram);

  return (
    <div className="app">
      <header className="top">
        <h1>Stroke Smush</h1>
        <select value={boardIdx} onChange={(e) => setBoardIdx(Number(e.target.value))} aria-label="Board">
          {boards.map((b, i) => (
            <option key={b.id} value={i}>
              Board {i + 1} · {b.tiles.length} tiles
            </option>
          ))}
        </select>
      </header>

      <div className="scoreline">
        <span className="score">{state.score}</span>
        <span className="meta">
          {state.plays.length} found · {remaining.length} left
          {pangramFound ? ' · pangram ✓' : ''}
        </span>
      </div>

      <Board
        board={board}
        state={state}
        inUse={inUse}
        preview={preview}
        focusTile={focusTile}
        onHoverTile={setHoverTile}
        onToggleTile={(t) => setPinnedTile((p) => (p === t ? null : t))}
        registerTile={registerTile}
      />

      <div className="word-area">
        <WordLine word={word} maxWidth={width} tileEl={tileEl} scope={scope} ghost={hoverKey} />
        <AnimatePresence>
          {toast && (
            <motion.div
              key={toast.id}
              className={`toast ${toast.tone}`}
              initial={{ opacity: 0, y: 8, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12 }}
            >
              {toast.text}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Keyboard playable={playable} matches={matches} onKey={onKey} onHoverKey={setHoverKey} />

      {remaining.length === 0 && (
        <div className="done">All words found! Final score {state.score}.</div>
      )}

      <section className="found">
        {[...state.plays].reverse().map((p) => (
          <div className={`found-row${p.pangram ? ' pangram' : ''}`} key={p.word}>
            <GlyphWord word={p.word} size={16} />
            <span>{p.score}</span>
          </div>
        ))}
      </section>

      <footer className="playtest">
        <button onClick={() => setState(newGame(board))}>Restart</button>
        <button onClick={() => setShowAnswers((s) => !s)}>{showAnswers ? 'Hide' : 'Show'} possible words</button>
        {showAnswers && (
          <p className="answers">
            <strong>Pangrams:</strong> {board.pangrams.join(', ')}
            <br />
            <strong>Remaining ({remaining.length}):</strong> {remaining.join(', ')}
          </p>
        )}
      </footer>
    </div>
  );
}

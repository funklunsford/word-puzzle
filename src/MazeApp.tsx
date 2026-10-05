import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'motion/react';
import { LETTERS, recipe, type Placement, type TileId } from './glyphs';
import { STEP_LIMIT, exits, recognize, wordDistance } from './strokes';
import { dataUrl } from './data';
import type { Need, Puzzle } from './maze';
import { payStep, type InkPots } from './inkpots';
import { nextStep, type NextStep } from './hints';
import { FLAGS, loadFlags, saveFlags, type Flag } from './flags';
import { COARSE, useMedia } from './useMedia';
import { InkDrop } from './components/maze/InkDrop';
import { InkPot } from './components/maze/InkPot';
import { centerOf, useInkFlights } from './components/maze/InkFlights';
import { Definition, type Definitions } from './components/maze/Definition';
import { Masthead } from './components/maze/Masthead';
import { Celebration } from './celebration/Celebration';
import { themeFor } from './celebration/themes';
import { WordEditor } from './components/maze/WordEditor';
import { Glyph, GlyphWord } from './components/Glyph';

/** A puzzle's ink pots: where they are, the best score with them, and a route that gets it. */
type PotPlan = Omit<InkPots, 'bound'>;

/** A puzzle, with its ink pots (used when that modifier is on). */
interface Pick {
  puzzle: Puzzle;
  inkPots: PotPlan;
  /** Pool puzzles: what its shortest routes need from C, I and V, and whether the obvious approach misses par (shown in Dev). */
  need?: Need;
  tricky?: boolean;
}

/** How Dev describes a pool puzzle's need (see classifyNeed in src/maze.ts). */
const NEEDS: Record<Need, string> = {
  none: 'needs no C, I or V',
  letter: 'changes a C, I or V the start or goal has',
  stone: 'needs a stepping stone through C, I or V',
};

interface MazeData extends Pick {
  words: string[];
  /** The pool a puzzle is picked from on each load (see scripts/mazes.ts). */
  puzzles: Pick[];
}

/** A random puzzle from the pool, other than the one being played (WILD → TAME if there's no pool). */
function pickPuzzle(data: MazeData, current?: Puzzle): Pick {
  const pool = data.puzzles?.length ? data.puzzles : [{ puzzle: data.puzzle, inkPots: data.inkPots }];
  const options = pool.length > 1 ? pool.filter((p) => p.puzzle.start !== current?.start || p.puzzle.goal !== current?.goal) : pool;
  return options[Math.floor(Math.random() * options.length)];
}

interface Visit {
  word: string;
  /** Strokes charged for reaching it (after any ink). */
  cost: number;
  /** Ink spent on that step. */
  used?: number;
}

/** Layout: the main column's width cap, the side card's width, and the width where the card sits beside it. */
const COLUMN_W = 640;
const SIDE_W = 260;
const SIDE_MIN = 1000;
/** Below this width the layout is the phone one: compact header and score, bigger word (see .maze.compact). */
const COMPACT_MAX = 600;

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
  /** Every word visited, once each, in the order first reached (with what reaching it cost). */
  const [trail, setTrail] = useState<Visit[]>([]);
  const [spent, setSpent] = useState(0);
  /** The door just walked through (cost 0 when it led back to a word already visited). */
  const [lastDoor, setLastDoor] = useState<(Visit & { back: boolean; pot: boolean }) | null>(null);
  const [hoverTile, setHoverTile] = useState<TileId | null>(null);
  const [reveal, setReveal] = useState(false);
  // Hints, for the word the player is in: first which letter to change, then the word to make.
  // They're free, but counted (the win message says how many).
  const [hint, setHint] = useState<{ room: string; level: 1 | 2; step: NextStep | null } | null>(null);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [defs, setDefs] = useState<Definitions | null>(null);
  /** A word in Your path whose definition is shown under it (tap a word to look it up). */
  const [peek, setPeek] = useState<string | null>(null);
  const [flags, setFlags] = useState(loadFlags);
  /** Free strokes banked from ink pots, waiting to pay for the next steps to new words. */
  const [ink, setInk] = useState(0);
  // Ink in flight: drops rise from a pot word into the bank, and pour from the bank into a word.
  // The bank shows a collected drop once it lands; `bankPop` replays the landing's little spring.
  const { launch, layer: inkFlights } = useInkFlights();
  const [inFlight, setInFlight] = useState(0);
  const [bankPop, setBankPop] = useState(0);
  const boardRef = useRef<HTMLElement>(null);
  const bankRef = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  // How to play pops up on a player's very first visit only (or with ?help in the address, for testing).
  const [help, setHelp] = useState(() => !seenHelp() || new URLSearchParams(location.search).has('help'));
  useEffect(() => markHelpSeen(), []);
  const helpBtn = useRef<HTMLButtonElement>(null);
  const helpClose = useRef<HTMLButtonElement>(null);
  const closeHelp = useCallback(() => {
    setHelp(false);
    helpBtn.current?.focus();
  }, []);
  useEffect(() => {
    if (!help) return;
    helpClose.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeHelp();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [help, closeHelp]);
  const width = useWidth();
  const compact = width < COMPACT_MAX;
  const coarse = useMedia(COARSE);

  useEffect(() => {
    // Every load plays a fresh puzzle, picked before the first render. (`live` drops a load that
    // was superseded, e.g. by StrictMode running this effect twice in development.)
    let live = true;
    fetch(dataUrl('mazes.json'))
      .then((r) => r.json())
      .then((d: MazeData) => {
        if (!live) return;
        setData(d);
        setCurrent(pickPuzzle(d));
      });
    // Definitions are a nicety: the game plays without them if they don't load.
    fetch(dataUrl('definitions.json'))
      .then((r) => r.json())
      .then((d) => live && setDefs(d))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  /** The puzzle being played: a random one from the pool (dev can switch to another, or to WILD → TAME). */
  const [current, setCurrent] = useState<Pick | null>(null);
  const puzzle = current?.puzzle;
  /** The puzzle's ink pots, when that modifier is on. */
  const potPlan = flags.inkPots ? (current?.inkPots ?? null) : null;
  const best = potPlan?.best ?? puzzle?.best ?? 0;
  const dict = useMemo(() => new Set(data?.words ?? []), [data]);

  const toggleFlag = (flag: Flag) => {
    const next = { ...flags, [flag]: !flags[flag] };
    saveFlags(next);
    setFlags(next); // the puzzle restarts, so ink and the best score never mix across settings
  };

  const restart = useCallback(() => {
    if (!puzzle) return;
    setRoom(puzzle.start);
    setCells(cellsFor(puzzle.start));
    setHistory([]);
    setTrail([{ word: puzzle.start, cost: 0 }]);
    setSpent(0);
    setLastDoor(null);
    setInk(0);
    setInFlight(0);
    setReveal(false);
    setHint(null);
    setHintsUsed(0);
    setPeek(null);
  }, [puzzle, potPlan]);
  useEffect(restart, [restart]);

  const roomExits = useMemo(() => (data && room ? exits(room, data.words) : []), [data, room]);

  const won = !!puzzle && room === puzzle.goal;
  // Reaching the goal celebrates, for puzzles that have a celebration (the pilot: WILD → TAME). In
  // development, ?celebrate opens it at once, and ?celebrate=2.2 holds it at 2.2 seconds.
  const theme = puzzle ? themeFor(puzzle.start, puzzle.goal) : undefined;
  const [celebrating, setCelebrating] = useState<{ freezeAt?: number } | null>(null);
  useEffect(() => {
    if (won && theme) setCelebrating({});
  }, [won, theme]);
  useEffect(() => {
    const q = new URLSearchParams(location.search).get('celebrate');
    if (import.meta.env.DEV && q !== null) setCelebrating({ freezeAt: q ? Number(q) : undefined });
  }, []);
  const stepEdits = history.length;
  const locked = stepEdits >= STEP_LIMIT;

  const onEdit = useCallback(
    (next: Placement[][]): boolean => {
      if (won || locked) return false;
      const letters = next.map(recognize);
      const word = letters.every(Boolean) ? letters.join('') : null;
      if (word === room) {
        // Back to where this step started: refund it.
        setCells(cellsFor(room));
        setHistory([]);
        return true;
      }
      if (word && dict.has(word)) {
        setRoom(word);
        setCells(cellsFor(word));
        setHistory([]);
        // Going back to a word already visited is free, and it isn't listed again.
        if (trail.some((v) => v.word === word)) {
          setLastDoor({ word, cost: 0, back: true, pot: false });
          return true;
        }
        // A new word: banked ink pays first (see payStep), and a pot banks more on its first visit.
        const { paid, used } = payStep(stepEdits + 1, ink);
        const pot = !!potPlan?.pots.includes(word);
        setSpent((s) => s + paid);
        setInk(ink - used + (pot ? 1 : 0));
        setTrail((t) => [...t, { word, cost: paid, used }]);
        setLastDoor({ word, cost: paid, used, back: false, pot });
        return true;
      }
      setHistory((h) => [...h, cells]);
      setCells(next);
      return true;
    },
    [won, locked, room, dict, stepEdits, cells, trail, ink, potPlan],
  );

  // After a step to a new word: ink paid for it pours from the bank into the word, and a pot's ink
  // rises from the word into the bank (after the pour, when both happen).
  useEffect(() => {
    if (!lastDoor || lastDoor.back || (!lastDoor.used && !lastDoor.pot)) return;
    const word = boardRef.current?.querySelector('.word-cells');
    const bank = bankRef.current;
    if (!word || !bank || reduce) {
      if (lastDoor.pot) setBankPop((n) => n + 1);
      return;
    }
    if (lastDoor.used) launch(centerOf(bank), centerOf(word));
    if (lastDoor.pot) {
      setInFlight((n) => n + 1);
      launch(centerOf(word), centerOf(bank), lastDoor.used ? 0.35 : 0.1, () => {
        setInFlight((n) => n - 1);
        setBankPop((n) => n + 1);
      });
    }
  }, [lastDoor, launch, reduce]);

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
  const shownHint = hint && hint.room === room && !won ? hint : null;
  const askHint = () => {
    if (!data || !puzzle || won) return;
    const level = shownHint ? 2 : 1;
    setHintsUsed((n) => n + 1);
    // The search takes a moment on a phone: show the hint once it's ready, without blocking the tap.
    window.setTimeout(() => {
      const step = shownHint?.step ?? nextStep(data.words, room, puzzle.goal, visited);
      setHint({ room, level, step });
    }, 0);
  };
  const ordinal = (i: number) => ['1st', '2nd', '3rd', '4th'][i];
  const hintText = shownHint?.step
    ? shownHint.level === 1
      ? `Hint: change the ${shownHint.step.letters.map(ordinal).join(' and ')} letter${shownHint.step.letters.length > 1 ? 's' : ''}.`
      : `Hint: make ${shownHint.step.next} next (${shownHint.step.cost ? `${shownHint.step.cost} ${shownHint.step.cost === 1 ? 'stroke' : 'strokes'}` : 'free'}).`
    : shownHint
      ? 'No hint from here.'
      : null;
  const found = roomExits.filter((x) => visited.has(x.word)).length;
  const lettersWithTile = hoverTile ? new Set(Object.keys(LETTERS).filter((ch) => recipe(ch).has(hoverTile))) : null;
  const toGoal = wordDistance(room, puzzle.goal);
  const potsLeft = (potPlan?.pots ?? []).filter((p) => !visited.has(p));
  const potsNear = won ? [] : potsLeft.filter((p) => wordDistance(room, p) <= STEP_LIMIT);
  const banked = Math.max(0, ink - inFlight);
  const used = spent + stepEdits;

  // The step after a door opens, until the next stroke: confirm it (completion feedback).
  const justOpened = !won && !stepEdits && !!lastDoor;

  return (
    <MotionConfig reducedMotion="user">
      <div
        className={`maze${side ? ' side' : ''}${compact ? ' compact' : ''}`}
        style={side ? { gridTemplateColumns: `minmax(0, ${COLUMN_W}px) ${SIDE_W}px` } : undefined}
      >
        <Masthead compact={compact} />

        <main className="column">
          <section className="scorecard">
            <button ref={helpBtn} className="help-btn" aria-label="How to play" aria-haspopup="dialog" aria-expanded={help} onClick={() => setHelp(true)}>
              ?
            </button>
            <div className={`goal-panel${won ? ' reached' : ''}`}>
              <span className="label">{won ? 'Reached' : 'Goal'}</span>
              <GlyphWord word={puzzle.goal} size={compact ? 24 : unit * 1.3} />
              {!won && toGoal <= STEP_LIMIT && <div className="score-hint">One step away</div>}
            </div>
            <div className="score-panel">
              <div className="score-big">
                <strong>{used}</strong> <span>{used === 1 ? 'stroke' : 'strokes'}</span>
              </div>
              <div className="score-sub">
                <span>lowest strokes possible: {best}</span>
                <span>
                  {roomExits.length} {roomExits.length === 1 ? 'word' : 'words'} within reach
                  {found ? <span className="nowrap"> ({found} visited)</span> : null}
                </span>
              </div>
              {potPlan && (
                <div className={`ink-bank${banked ? ' full' : ''}`} aria-live="polite">
                  <span className="bank-drops" ref={bankRef}>
                    {banked ? (
                      Array.from({ length: banked }, (_, i) => (
                        <motion.span
                          key={i === banked - 1 ? `${i}-${bankPop}` : i}
                          initial={i === banked - 1 ? { scale: 1.6 } : false}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', bounce: 0.5, duration: 0.45 }}
                        >
                          <InkDrop size={13} />
                        </motion.span>
                      ))
                    ) : (
                      <InkDrop filled={false} size={13} />
                    )}
                  </span>
                  {banked ? `${banked} free ${banked === 1 ? 'stroke' : 'strokes'} banked` : 'no ink banked'}
                  {potsNear.length > 0 && <span className="pot-near"> · ink pot within reach: {potsNear.join(', ')}</span>}
                </div>
              )}
            </div>
          </section>

          <AnimatePresence>
            {help && (
              <motion.div
                className="help-backdrop"
                onClick={closeHelp}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <motion.section
                  className="help-card"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="help-title"
                  onClick={(e) => e.stopPropagation()}
                  initial={{ opacity: 0, y: 16, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.98 }}
                  transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
                >
                  <div className="help-head">
                    <h2 id="help-title">How to play</h2>
                    <button ref={helpClose} className="close" aria-label="Close how to play" onClick={closeHelp}>
                      ×
                    </button>
                  </div>
                  <p className="help-lead">
                    Turn the start word into the goal word, one real word at a time, in as few strokes as you can.
                  </p>
                  <ul className="how">
                    <li>Change the word into another real word, using up to 3 strokes per step.</li>
                    <li>Drag strokes in from the tray. Tap a stroke to remove it, or drag it to move it.</li>
                    {coarse ? (
                      <li>A chevron, arc or bowl that fits a spot either way round goes in the way it's turned: double-tap it in the tray to turn it, or double-tap it in the word to turn it where it is.</li>
                    ) : (
                      <li>A chevron, arc or bowl that fits a spot either way round? As you place it, swipe the way you want it to point: up turns a V into Λ, for A.</li>
                    )}
                    <li>Going back to a word you've already visited is free.</li>
                    {potPlan && <li>Ink pots: the first time you reach a pot word, you bank a free stroke that pays for a later step.</li>}
                  </ul>
                  <button className="pill help-go" onClick={closeHelp}>
                    Let's play
                  </button>
                </motion.section>
              </motion.div>
            )}
          </AnimatePresence>

          <section className="board" ref={boardRef}>
            <AnimatePresence>
              {won && (
                <motion.div className="win" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  You reached {puzzle.goal} in {spent} strokes. Lowest strokes possible: {best}.
                  {hintsUsed > 0 && ` (${hintsUsed} ${hintsUsed === 1 ? 'hint' : 'hints'})`}
                </motion.div>
              )}
            </AnimatePresence>
            <div className="board-head">
              <span className="label">You are in</span>
              {/* The word's meaning sits right above it, and changes as each new word is made. */}
              <AnimatePresence mode="wait" initial={false}>
                {defs?.[room] && (
                  <motion.p
                    key={room}
                    className="definition"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Definition word={room} def={defs[room]} />
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
            <WordEditor
              cells={cells}
              unit={unit}
              compact={compact}
              disabled={won || locked}
              hinted={shownHint?.step?.letters}
              room={room}
              onEdit={onEdit}
              onHoverTile={setHoverTile}
            />
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
              <button className="pill hint-btn" onClick={askHint} disabled={won || shownHint?.level === 2}>
                {shownHint ? 'Next word' : 'Hint'}
              </button>
            </div>
            <p className={`step-status${hintText && !locked ? ' hinted' : locked ? ' out' : justOpened ? ' opened' : ''}`}>
              {hintText && !locked
                ? hintText
                : locked
                ? 'Out of strokes for this step. Undo to try another way.'
                : stepEdits
                  ? 'Keep going: land on a real word.'
                  : justOpened
                    ? lastDoor!.back
                      ? `Back in ${room}: free, you've been here before.`
                      : `New word: ${room} (+${lastDoor!.cost}${lastDoor!.used ? `, ${lastDoor!.used} paid in ink` : ''}).${
                          lastDoor!.pot ? ' Ink pot! You banked a free stroke.' : ' Find the next one.'
                        }`
                    : null}
            </p>
            {/* This step's strokes: three dots, filling as strokes are used. */}
            <div className={`step-meter${locked ? ' full' : ''}`} aria-label={`${stepEdits} of ${STEP_LIMIT} strokes used this step`}>
              <span>Strokes this step</span>
              <span className="pips">
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
              const isHere = v.word === room;
              return (
                <motion.li
                  key={i}
                  className={isHere ? 'here' : ''}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
                >
                  <button
                    className="trail-word"
                    aria-pressed={peek === v.word}
                    aria-label={`${v.word}: show its definition`}
                    onClick={() => setPeek((p) => (p === v.word ? null : v.word))}
                  >
                    {i > 0 && <span className="cost">+{v.cost}</span>}
                    {!!v.used && (
                      <motion.span
                        className="ink-used"
                        aria-label={`${v.used} paid in ink`}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', bounce: 0.4, duration: 0.4, delay: 0.5 }}
                      >
                        <InkDrop size={9} />
                        {v.used}
                      </motion.span>
                    )}
                    <GlyphWord word={v.word} size={14} />
                    {potPlan?.pots.includes(v.word) && <InkPot full={false} size={13} />}
                    {isHere && <span className="meta">{won ? 'goal' : 'here'}</span>}
                  </button>
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
          {potPlan && (
            <div className="pots" aria-label="Ink pots">
              <span className="label">Ink pots</span>
              <ul>
                {potPlan.pots.map((p) => {
                  const got = visited.has(p);
                  const near = potsNear.includes(p);
                  return (
                    <li key={p} className={got ? 'got' : near ? 'near' : ''} aria-label={`${p}${got ? ' (collected)' : near ? ' (within reach)' : ''}`}>
                      <InkPot full={!got} near={near} size={18} />
                      <GlyphWord word={p} size={13} />
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {peek && defs?.[peek] && (
            <p className="definition peek">
              <Definition word={peek} def={defs[peek]} />
            </p>
          )}
          <div className="pill-row">
            <button className="pill quiet" onClick={restart}>
              Restart
            </button>
            <button className="pill quiet" onClick={() => setReveal((r) => !r)}>
              {reveal ? 'Hide' : 'Show'} lowest-stroke route
            </button>
          </div>
          {import.meta.env.DEV && (
            <div className="dev-tools">
              <span className="label">Dev</span>
              {current?.need && (
                <span className="maze-kind">
                  This maze: {current.tricky ? 'tricky' : 'obvious'}, {NEEDS[current.need]}
                </span>
              )}
              <button className="pill quiet" onClick={() => setCurrent(pickPuzzle(data, puzzle))}>
                New start & goal
              </button>
              {puzzle.start !== data.puzzle.start || puzzle.goal !== data.puzzle.goal ? (
                <button className="pill quiet" onClick={() => setCurrent({ puzzle: data.puzzle, inkPots: data.inkPots })}>
                  Play {data.puzzle.start} → {data.puzzle.goal}
                </button>
              ) : null}
              <button className="pill quiet" onClick={() => setCelebrating({})}>
                Preview celebration
              </button>
              {(Object.keys(FLAGS) as Flag[]).map((f) => (
                <label key={f} className="flag">
                  <input type="checkbox" checked={flags[f]} onChange={() => toggleFlag(f)} /> {FLAGS[f].label}
                </label>
              ))}
            </div>
          )}
          {reveal && (
            <p className="answers">
              {(potPlan?.walk ?? puzzle.path).join(' → ')} ({best} strokes)
              <br />
              Words within reach of {room}: {roomExits.map((x) => `${x.word} (${x.cost})`).join(', ')}
            </p>
          )}
        </aside>
      </div>
      {inkFlights}
      {celebrating && (
        <Celebration
          start={theme ? puzzle.start : data.puzzle.start}
          goal={theme ? puzzle.goal : data.puzzle.goal}
          theme={theme ?? themeFor(data.puzzle.start, data.puzzle.goal)!}
          strokes={won ? spent : data.puzzle.best + 1}
          hints={won ? hintsUsed : 0}
          best={theme ? best : data.puzzle.best}
          freezeAt={celebrating.freezeAt}
          onClose={() => setCelebrating(null)}
        />
      )}
    </MotionConfig>
  );
}

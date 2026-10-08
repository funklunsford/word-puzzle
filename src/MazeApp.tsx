import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { PrefsContext, followSystemMotion, loadPrefs, motionConfig, savePrefs, useReduceMotion, type Prefs } from './prefs';
import { LETTERS, recipe, type Placement, type TileId } from './glyphs';
import { STEP_LIMIT, recognize, wordDistance } from './strokes';
import { dataUrl } from './data';
import type { Need, Puzzle } from './maze';
import { payStep, type InkPots } from './inkpots';
import { doorsFrom, nextStep, type Doors, type NextStep } from './hints';
import { FLAGS, loadFlags, saveFlags, type Flag } from './flags';
import { COARSE, useMedia } from './useMedia';
import { InkDrop } from './components/maze/InkDrop';
import { InkPot } from './components/maze/InkPot';
import { centerOf, useInkFlights } from './components/maze/InkFlights';
import { Definition, type Definitions } from './components/maze/Definition';
import { Masthead } from './components/maze/Masthead';
import { HowToTry } from './components/maze/HowToTry';
import { GearIcon, Settings } from './components/maze/Settings';
import { ShareSheet } from './components/maze/ShareSheet';
import type { ShareResult } from './share';
import { followSystemTheme, loadTheme, saveTheme, type ThemeChoice } from './theme';
import { Celebration, inkSources } from './celebration/Celebration';
import { celebrationFor, dayFor, dayNumber, daysFor, loadDaily, localDate } from './daily/daily';
import { CELL_W, WordEditor } from './components/maze/WordEditor';
import { loadLetters, type WordLength } from './letters';
import { Glyph, GlyphWord } from './components/Glyph';

/** A puzzle's ink pots: where they are, the best score with them, and a route that gets it. */
type PotPlan = Omit<InkPots, 'bound'>;

/** A puzzle, with its ink pots (used when that modifier is on). */
interface Pick {
  puzzle: Puzzle;
  inkPots: PotPlan;
  /** A daily's date (pool puzzles have none). */
  date?: string;
  /** Words on a lowest-stroke route, with their strokes from the start (hardcore keeps to them). */
  onRoute?: Record<string, number>;
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
  /** Each word's doors, as [to, cost, to, cost, ...] by word index (see scripts/mazes.ts). */
  doors?: number[][];
  /** The pool a puzzle is picked from on each load (see scripts/mazes.ts). */
  puzzles: Pick[];
}

/** A random puzzle from the pool, other than the one being played (WILD → TAME if there's no pool). */
function pickPuzzle(data: MazeData, current?: Puzzle): Pick {
  const pool = data.puzzles?.length ? data.puzzles : [{ puzzle: data.puzzle, inkPots: data.inkPots, onRoute: data.onRoute }];
  const options = pool.length > 1 ? pool.filter((p) => p.puzzle.start !== current?.start || p.puzzle.goal !== current?.goal) : pool;
  return options[Math.floor(Math.random() * options.length)];
}

interface Visit {
  word: string;
  /** Strokes charged for reaching it (after any ink). */
  cost: number;
  /** Ink spent on that step. */
  used?: number;
  /** The word the step started from (going back is free, so it isn't always the word before it). */
  from?: string;
}

/** Layout: the main column's width cap, the side card's width, and the width where the card sits beside it. */
const COLUMN_W = 640;
const SIDE_W = 260;
const SIDE_MIN = 1000;
/** The 5-letter game's wider column (so five letters keep the size four have), and where the card fits beside it. */
const COLUMN_W_5 = 760;
const SIDE_MIN_5 = 1100;
/** Below this width the layout is the phone one: compact header and score, bigger word (see .maze.compact). */
const COMPACT_MAX = 600;

const HELP_KEY = 'strokes:seen-help';
/** A daily's result, kept in this browser so a return visit shows it. */
interface Result {
  strokes: number;
  best: number;
  hints: number;
  hardcore: boolean;
  /** Each step's words and strokes, for the share grid. */
  steps: ShareResult['steps'];
}
/** Where a daily's result is kept: the 4- and 5-letter games keep theirs apart. */
const resultKey = (date: string, letters: WordLength) => `strokes:result${letters === 5 ? '5' : ''}:${date}`;
const loadResult = (date: string, letters: WordLength): Result | null => {
  try {
    const r = JSON.parse(localStorage.getItem(resultKey(date, letters)) ?? 'null');
    // (Results kept before the grid have only each step's strokes: they share without it.)
    return r && { ...r, steps: Array.isArray(r.steps) ? r.steps.filter((s: unknown) => typeof s === 'object') : [] };
  } catch {
    return null;
  }
};

/** A path's steps, for sharing: where each began, the word it made, and its strokes. */
const stepsOf = (trail: Visit[]): ShareResult['steps'] => trail.slice(1).map((v) => ({ from: v.from ?? v.word, to: v.word, cost: v.cost }));

/** Hardcore: only words on a lowest-stroke route open, so every step must keep the player on par. */
const HARDCORE_KEY = 'strokes:hardcore';
const loadHardcore = () => {
  try {
    return localStorage.getItem(HARDCORE_KEY) === '1';
  } catch {
    return false;
  }
};
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

function useWindowSize() {
  const [size, setSize] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useEffect(() => {
    const on = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return size;
}

export function MazeApp() {
  const [flags, setFlags] = useState(loadFlags);
  /** This visit's game: 5-letter words on a desktop, 4 elsewhere unless the fiveLetters flag is on (see src/letters.ts). Chosen once. */
  const [letters] = useState<WordLength>(() => loadLetters(flags.fiveLetters));
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
  const [hardcore, setHardcore] = useState(loadHardcore);
  // Settings (the gear): light or dark, the player's choice or the device's.
  const [settings, setSettings] = useState(false);
  const gearBtn = useRef<HTMLButtonElement>(null);
  const [theme, setTheme] = useState<ThemeChoice>(loadTheme);
  const themeRef = useRef(theme);
  themeRef.current = theme;
  useEffect(() => followSystemTheme(() => themeRef.current), []);
  // The rest of the settings: motion, swipe to turn, the letter guide, definitions, colour-blind squares.
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  useEffect(() => followSystemMotion(() => prefsRef.current.motion), []);
  const changePrefs = (patch: Partial<Prefs>) => {
    const next = { ...prefsRef.current, ...patch };
    setPrefs(next);
    savePrefs(next);
  };
  const chooseTheme = (choice: ThemeChoice) => {
    setTheme(choice);
    saveTheme(choice);
  };
  const closeSettings = useCallback(() => {
    setSettings(false);
    gearBtn.current?.focus();
  }, []);
  /** A word hardcore just turned away (off the lowest-stroke route), for the step line. */
  const [refused, setRefused] = useState<string | null>(null);
  /** Said in the step line until the next stroke or hint (switching hardcore on or off). */
  const [notice, setNotice] = useState<string | null>(null);
  /** Hardcore asked for once with progress on the board: a second tap within a few seconds starts over in it. */
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => {
      setArmed(false);
      setNotice(null);
    }, 5000);
    return () => window.clearTimeout(t);
  }, [armed]);
  /** Free strokes banked from ink pots, waiting to pay for the next steps to new words. */
  const [ink, setInk] = useState(0);
  // Ink in flight: drops rise from a pot word into the bank, and pour from the bank into a word.
  // The bank shows a collected drop once it lands; `bankPop` replays the landing's little spring.
  const { launch, layer: inkFlights } = useInkFlights();
  const [inFlight, setInFlight] = useState(0);
  const [bankPop, setBankPop] = useState(0);
  const boardRef = useRef<HTMLElement>(null);
  /** The word's strokes on the board, for the Perfect confetti to pop out of. */
  const wordInk = useCallback(() => inkSources(boardRef.current?.querySelector('.word-cells')), []);
  const bankRef = useRef<HTMLSpanElement>(null);
  const reduce = useReduceMotion(prefs.motion);
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
  const { w: width, h: height } = useWindowSize();
  const compact = width < COMPACT_MAX;
  const coarse = useMedia(COARSE);

  useEffect(() => {
    // The puzzle is picked before the first render: the day's puzzle for the player's own date, or
    // with the freshPuzzle flag a random one from the pool. ?day=YYYY-MM-DD plays an earlier day's
    // (any day's, in development). (`live` drops a load that was superseded, e.g. by StrictMode
    // running this effect twice in development.)
    let live = true;
    const today = localDate();
    const asked = new URLSearchParams(location.search).get('day');
    const days = daysFor(letters);
    const date = asked && days.includes(asked) && (import.meta.env.DEV || asked <= today) ? asked : dayFor(today, days);
    const maze = letters === 5 ? 'mazes-5.json' : 'mazes.json';
    Promise.all([fetch(dataUrl(maze)).then((r) => r.json() as Promise<MazeData>), loadDaily(date, letters)]).then(([d, day]) => {
      if (!live) return;
      const pick: Pick = { puzzle: day.puzzle, inkPots: day.inkPots, need: day.need, tricky: day.tricky, date: day.date, onRoute: day.onRoute };
      setData(d);
      setDaily(pick);
      setCurrent(flags.freshPuzzle ? pickPuzzle(d) : pick);
    });
    // Definitions are a nicety: the game plays without them if they don't load.
    fetch(dataUrl(letters === 5 ? 'definitions-5.json' : 'definitions.json'))
      .then((r) => r.json())
      .then((d) => live && setDefs(d))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  /** The puzzle being played: the day's, or a random one from the pool (see the freshPuzzle flag; dev can switch). */
  const [current, setCurrent] = useState<Pick | null>(null);
  const [daily, setDaily] = useState<Pick | null>(null);
  const puzzle = current?.puzzle;
  /** The puzzle's ink pots, when that modifier is on. */
  const potPlan = flags.inkPots ? (current?.inkPots ?? null) : null;
  const best = potPlan?.best ?? puzzle?.best ?? 0;
  const dict = useMemo(() => new Set(data?.words ?? []), [data]);

  const toggleFlag = (flag: Flag) => {
    const next = { ...flags, [flag]: !flags[flag] };
    saveFlags(next);
    if (flag === 'fiveLetters') {
      // The game is chosen once per load, so load again (without a link's ?flags= undoing the change).
      const url = new URL(location.href);
      url.searchParams.delete('flags');
      window.history.replaceState(window.history.state, '', url);
      location.reload();
      return;
    }
    setFlags(next); // the puzzle restarts, so ink and the best score never mix across settings
    if (flag === 'freshPuzzle' && data) setCurrent(next.freshPuzzle ? pickPuzzle(data, puzzle) : daily);
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
    setRefused(null);
    setNotice(null);
  }, [puzzle, potPlan]);
  useEffect(restart, [restart]);

  /** Hardcore on starts the puzzle over (the way so far may be off the route); off carries on. */
  /**
   * Hardcore on starts the puzzle over (the way so far may be off the route), so with progress on
   * the board it asks for a second tap first. Off just carries on.
   */
  const toggleHardcore = () => {
    const next = !hardcore;
    const progress = spent > 0 || history.length > 0 || trail.length > 1;
    setRefused(null);
    if (next && progress && !armed) {
      setArmed(true);
      setNotice(`Hardcore starts over. ${coarse ? 'Tap' : 'Click'} the flame again to go.`);
      return;
    }
    setArmed(false);
    try {
      localStorage.setItem(HARDCORE_KEY, next ? '1' : '0');
    } catch {
      // storage blocked: on for this visit only
    }
    setHardcore(next);
    if (next) restart();
    setNotice(next ? 'Hardcore on: only lowest-stroke words count, and no hints.' : 'Hardcore off.');
  };

  // The maze's doors, shipped with it (worked out from the words only if they're missing).
  const doorsOf = useMemo<Doors | null>(() => {
    if (!data) return null;
    if (!data.doors) return doorsFrom(data.words);
    const index = new Map(data.words.map((w, i) => [w, i]));
    const doors = data.doors;
    return (w) => {
      const flat = doors[index.get(w) ?? -1] ?? [];
      return Array.from({ length: flat.length / 2 }, (_, k): [string, number] => [data.words[flat[2 * k]], flat[2 * k + 1]]);
    };
  }, [data]);
  const roomExits = useMemo(() => (doorsOf && room ? doorsOf(room).map(([word, cost]) => ({ word, cost })) : []), [doorsOf, room]);

  // (A path that started from this puzzle's start: while a new puzzle swaps in, the old word can
  // equal the new goal for a moment, which isn't a win.)
  const won = !!puzzle && room === puzzle.goal && trail[0]?.word === puzzle.start;
  // Reaching the goal celebrates: confetti for a solve in the lowest possible strokes, then the
  // daily's own scene. In development, ?celebrate opens it at once (?celebrate=2.2 holds it at 2.2
  // seconds), and ?perfect adds the confetti (?perfect=1.2 holds the whole thing at 1.2 seconds).
  // (The 5-letter days have no scenes of their own: a Perfect gets the confetti, then the goal word.)
  const scene = current?.date && letters === 4 ? celebrationFor(current.date) : undefined;
  const perfect = won && spent <= best;
  const [celebrating, setCelebrating] = useState<{ perfect: boolean; freezeAt?: number } | null>(null);
  useEffect(() => {
    if (!won) return;
    if (scene || perfect) setCelebrating({ perfect });
    // A daily's result is kept, so coming back today shows it (the best one, if played again).
    const date = current?.date;
    if (!date) return;
    const result: Result = { strokes: spent, best, hints: hintsUsed, hardcore, steps: stepsOf(trail) };
    const before = loadResult(date, letters);
    if (!before || result.strokes < before.strokes || (result.strokes === before.strokes && result.hints < before.hints)) {
      try {
        localStorage.setItem(resultKey(date, letters), JSON.stringify(result));
      } catch {
        // storage blocked: shown this visit only
      }
      setSaved(result);
    }
  }, [won]);
  /** Today's result from an earlier visit (or this one), if any. */
  const [saved, setSaved] = useState<Result | null>(null);
  useEffect(() => setSaved(current?.date ? loadResult(current.date, letters) : null), [current?.date, letters]);
  /** The result being shared (the share sheet is open). */
  const [sharing, setSharing] = useState<ShareResult | null>(null);
  const shareBtn = useRef<HTMLButtonElement>(null);
  const share = (r: Result | null) => {
    if (!puzzle || !r) return;
    const date = current?.date;
    setSharing({ ...r, start: puzzle.start, goal: puzzle.goal, date, number: date ? dayNumber(date) : undefined });
  };
  const closeShare = useCallback(() => {
    setSharing(null);
    shareBtn.current?.focus();
  }, []);
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const at = (key: string) => (q.get(key) ? Number(q.get(key)) : undefined);
    if (import.meta.env.DEV && (q.has('celebrate') || q.has('perfect'))) setCelebrating({ perfect: q.has('perfect'), freezeAt: at('celebrate') ?? at('perfect') });
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
        // Hardcore: a new word must be on a lowest-stroke route, reached on par. Going back to a word
        // already visited is free, as always (every word visited is on the route).
        if (hardcore && current?.onRoute) {
          const back = trail.some((v) => v.word === word);
          if (!back && current.onRoute[word] !== spent + payStep(stepEdits + 1, ink).paid) {
            setRefused(word);
            return false;
          }
        }
        setRefused(null);
        setNotice(null);
        setArmed(false);
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
        setTrail((t) => [...t, { word, cost: paid, used, from: room }]);
        setLastDoor({ word, cost: paid, used, back: false, pot });
        return true;
      }
      setRefused(null);
      setNotice(null);
      setArmed(false);
      setHistory((h) => [...h, cells]);
      setCells(next);
      return true;
    },
    [won, locked, room, dict, stepEdits, cells, trail, ink, potPlan, hardcore, current, spent],
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
  const columnW = letters === 5 ? COLUMN_W_5 : COLUMN_W;
  const side = width >= (letters === 5 ? SIDE_MIN_5 : SIDE_MIN);
  const column = Math.min(width - 32, columnW);
  // Board padding, the gaps between letter tiles (10 px) and their own padding (12 px) come off
  // before sizing the word, whose letters are CELL_W units wide each.
  const n = puzzle.start.length;
  const unit = Math.max(13, Math.min(32, (column - 36 - 10 * (n - 1) - 12 * n) / (CELL_W * n)));
  const visited = new Set(trail.map((v) => v.word));
  const shownHint = hint && hint.room === room && !won ? hint : null;
  const askHint = () => {
    // No hints in hardcore.
    if (!data || !puzzle || won || hardcore) return;
    // The latest thing asked for wins the step line.
    setRefused(null);
    setNotice(null);
    setArmed(false);
    const level = shownHint ? 2 : 1;
    setHintsUsed((n) => n + 1);
    // The search takes a moment on a phone: show the hint once it's ready, without blocking the tap.
    window.setTimeout(() => {
      const step = shownHint?.step ?? nextStep(doorsOf!, room, puzzle.goal, visited);
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
  // In hardcore, only the words that would open: visited ones (free) and the route's next on par.
  const reach = hardcore && current?.onRoute ? roomExits.filter((x) => visited.has(x.word) || current.onRoute![x.word] === spent + x.cost) : roomExits;
  const found = reach.filter((x) => visited.has(x.word)).length;
  const lettersWithTile = hoverTile ? new Set(Object.keys(LETTERS).filter((ch) => recipe(ch).has(hoverTile))) : null;
  const potsLeft = (potPlan?.pots ?? []).filter((p) => !visited.has(p));
  const potsNear = won ? [] : potsLeft.filter((p) => wordDistance(room, p) <= STEP_LIMIT);
  const banked = Math.max(0, ink - inFlight);
  const used = spent + stepEdits;

  // The step after a door opens, until the next stroke: confirm it (completion feedback).
  const justOpened = !won && !stepEdits && !!lastDoor;

  return (
    <PrefsContext.Provider value={prefs}>
    <MotionConfig reducedMotion={motionConfig(prefs.motion)}>
      <div
        className={`maze${side ? ' side' : ''}${compact ? ' compact' : ''}${letters === 5 ? ' five' : ''}`}
        style={side ? { gridTemplateColumns: `minmax(0, ${columnW}px) ${SIDE_W}px` } : undefined}
      >
        <Masthead
          // A short screen (a phone on its side) gets the slim wordmark too, leaving room for the game.
          compact={compact || height < 500}
          actions={
            <button ref={gearBtn} className="gear-btn" aria-label="Settings" aria-haspopup="dialog" aria-expanded={settings} onClick={() => setSettings(true)}>
              <GearIcon />
            </button>
          }
          dateline={
            current?.date &&
            `No. ${dayNumber(current.date)}${letters === 5 ? ' · 5 letters' : ''} · ${new Date(`${current.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}`
          }
        />

        <main className="column">
          <section className="scorecard">
            <button ref={helpBtn} className="help-btn" aria-label="How to play" aria-haspopup="dialog" aria-expanded={help} onClick={() => setHelp(true)}>
              ?
            </button>
            <div className={`goal-panel${won ? ' reached' : ''}`}>
              <span className="label">{won ? 'Reached' : 'Goal'}</span>
              <GlyphWord word={puzzle.goal} size={compact ? 24 : unit * 1.3} />
            </div>
            <div className="score-panel">
              <div className="score-big">
                <strong>{used}</strong> <span>{used === 1 ? 'stroke' : 'strokes'}</span>
                {hardcore && <span className="hardcore-tag">Hardcore</span>}
              </div>
              <div className="score-sub">
                <span>lowest strokes possible: {best}</span>
                <span>
                  {reach.length} {hardcore ? 'route ' : ''}
                  {reach.length === 1 ? 'word' : 'words'} within reach
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
                  <p className="help-lead">Turn one word into another, in as few strokes as you can.</p>
                  <HowToTry touch={coarse} />
                  {/* Touch screens and mouse play differently (tap vs click, double-tap vs swipe to turn), so each gets its own. */}
                  <ul className="how">
                    <li>Each step, change up to 3 strokes to make another real word.</li>
                    {coarse ? (
                      <li>Drag strokes in from the tray. Tap one to remove it, or drag it to move it. To turn one, double-tap it{prefs.swipe ? ', or swipe as you place it' : ''}.</li>
                    ) : (
                      <li>Drag strokes in from the tray. Click one to remove it, or drag it to move it. To turn one, double-click it{prefs.swipe ? ', or swipe as you place it' : ''}.</li>
                    )}
                    <li>Going back to a word you've visited is free.</li>
                    <li>Stuck? {coarse ? 'Tap' : 'Click'} Hint.</li>
                    <li>Want a challenge? {coarse ? 'Tap' : 'Click'} the flame for hardcore: only words on a lowest-stroke route count, and there are no hints.</li>
                    {potPlan && <li>Ink pots: the first time you reach a pot word, you bank a free stroke for a later step.</li>}
                  </ul>
                  <button className="pill help-go" onClick={closeHelp}>
                    Let's play
                  </button>
                </motion.section>
              </motion.div>
            )}
          </AnimatePresence>

          <section className="board" ref={boardRef}>
            <button
              className={`hardcore-btn${hardcore ? ' on' : ''}${armed ? ' armed' : ''}`}
              aria-pressed={hardcore}
              aria-label="Hardcore mode"
              title={hardcore ? 'Hardcore is on: only words on a lowest-stroke route open' : 'Hardcore: only words on a lowest-stroke route open (starts the puzzle over)'}
              onClick={toggleHardcore}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path className="flame" d="M12 2.8c.9 3.4 5.6 5.6 5.6 10.6a5.6 5.6 0 0 1-11.2 0c0-2.6 1.6-4.3 2.6-5.6.3 1.8 1.2 3 2.3 3.6-.5-3 .1-6 .7-8.6Z" />
                <path className="core" d="M12 13.2c1.3 1.3 2.3 2.4 2.1 3.9a2.1 2.1 0 0 1-4.2 0c0-1.4 1-2.5 2.1-3.9Z" />
              </svg>
            </button>
            <div className="board-head">
              <span className="label">You are in</span>
              {/* The word's meaning sits right above it, and changes as each new word is made. */}
              <AnimatePresence mode="wait" initial={false}>
                {prefs.definitions && defs?.[room] && (
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
              swipe={prefs.swipe}
              onMiss={(why) =>
                setNotice(
                  why === 'turn'
                    ? `That fits there turned the other way: ${prefs.swipe ? 'swipe as you drop it' : 'turn it in the tray first'}.`
                    : "That stroke doesn't fit in that letter.",
                )
              }
            />
            {prefs.letters && (
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
            )}
          </section>

          {won ? (
            <section className="controls result" aria-label="Result" aria-live="polite">
              <p className="result-line">
                <strong>
                  {puzzle.goal} in {spent} {spent === 1 ? 'stroke' : 'strokes'}
                </strong>
                <span className="nowrap"> · lowest possible {best}</span>
                {spent <= best && <span className="nowrap"> · perfect ⭐</span>}
                {hardcore && <span className="nowrap"> · hardcore</span>}
                {hintsUsed > 0 && <span className="nowrap"> · {hintsUsed} {hintsUsed === 1 ? 'hint' : 'hints'}</span>}
              </p>
              <div className="pill-row">
                <button
                  ref={shareBtn}
                  className="pill"
                  aria-haspopup="dialog"
                  onClick={() => share({ strokes: spent, best, hints: hintsUsed, hardcore, steps: stepsOf(trail) })}
                >
                  Share
                </button>
                {(scene || spent <= best) && (
                  <button className="pill quiet" onClick={() => setCelebrating({ perfect: spent <= best })}>
                    Watch again
                  </button>
                )}
              </div>
              {current?.date && <p className="result-next">A new puzzle comes at midnight.</p>}
            </section>
          ) : (
          <section className="controls" aria-label="This step">
            {saved && stepEdits === 0 && trail.length === 1 && (
              <p className="solved-before">
                Solved today in {saved.strokes}
                {saved.strokes <= saved.best ? ' · perfect ⭐' : ''}. Play it again any time, or{' '}
                <button ref={shareBtn} className="link-btn" aria-haspopup="dialog" onClick={() => share(saved)}>
                  share it
                </button>
                .
              </p>
            )}
            <div className="pill-row">
              <button className="pill" onClick={undo} disabled={!history.length}>
                Undo
              </button>
              <button className="pill" onClick={resetStep} disabled={!history.length}>
                Reset step
              </button>
              {/* No hints in hardcore: the button gives way to a quiet note. */}
              {hardcore ? (
                <span className="no-hints">No hints</span>
              ) : (
                <button className="pill hint-btn" onClick={askHint} disabled={won || shownHint?.level === 2}>
                  {!shownHint ? 'Hint' : shownHint.level === 1 ? 'Next word' : 'Hint used'}
                </button>
              )}
            </div>
            <p aria-live="polite" className={`step-status${refused ? ' out' : hintText && !locked ? ' hinted' : locked ? ' out' : justOpened ? ' opened' : ''}`}>
              {refused
                ? `Hardcore: ${refused} is off the lowest-stroke route.`
                : notice
                ? notice
                : hintText && !locked
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
          )}
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
              {daily && current !== daily ? (
                <button className="pill quiet" onClick={() => setCurrent(daily)}>
                  Play the daily ({daily.puzzle.start} → {daily.puzzle.goal})
                </button>
              ) : null}
              {scene && (
                <button className="pill quiet" onClick={() => setCelebrating({ perfect: false })}>
                  Preview celebration
                </button>
              )}
              <button className="pill quiet" onClick={() => setCelebrating({ perfect: true })}>
                Preview Perfect
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
      <AnimatePresence>{settings && <Settings theme={theme} onTheme={chooseTheme} prefs={prefs} onPrefs={changePrefs} onClose={closeSettings} />}</AnimatePresence>
      <AnimatePresence>{sharing && <ShareSheet result={sharing} onClose={closeShare} />}</AnimatePresence>
      {inkFlights}
      {celebrating && (
        <Celebration
          start={puzzle.start}
          goal={puzzle.goal}
          load={scene}
          perfect={celebrating.perfect}
          from={wordInk}
          strokes={won ? spent : celebrating.perfect ? best : best + 1}
          hints={won ? hintsUsed : 0}
          best={best}
          freezeAt={celebrating.freezeAt}
          onClose={() => setCelebrating(null)}
        />
      )}
    </MotionConfig>
    </PrefsContext.Provider>
  );
}

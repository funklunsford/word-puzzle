import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { PrefsContext, applyPalette, followSystemMotion, loadPrefs, motionConfig, savePrefs, useReduceMotion, type Prefs } from './prefs';
import { LETTERS, recipe, type Placement, type TileId } from './glyphs';
import { STEP_LIMIT, recognize, slotKey, wordDistance } from './strokes';
import { dataUrl } from './data';
import type { Need, Puzzle } from './maze';
import { payStep, walkSteps, type InkPots } from './inkpots';
import { clue, doorsFrom, hintSays, nextHintLevel, nextStep, type Doors, type HintLevel, type NextStep } from './hints';
import { FLAGS, loadFlags, saveFlags, type Flag } from './flags';
import { hasStarted } from './hardcore';
import { easyDayFor, easyDays, easyIndex, isEasyDay, loadDifficulty, saveDifficulty, type Difficulty } from './easycore';
import { COARSE, useMedia } from './useMedia';
import { InkDrop } from './components/maze/InkDrop';
import { InkPot } from './components/maze/InkPot';
import { centerOf, useInkFlights } from './components/maze/InkFlights';
import { Definition, type Definitions } from './components/maze/Definition';
import { Masthead } from './components/maze/Masthead';
import { HowToCard } from './components/maze/HowToCard';
import { BoardGhost, CoachTip, useArrowTo, useCoach } from './components/maze/Coach';
import { GearIcon, Settings } from './components/maze/Settings';
import { HintIcon, ResetIcon, UndoIcon } from './components/maze/StepIcons';
import { ShareSheet } from './components/maze/ShareSheet';
import type { ShareResult } from './share';
import { followSystemTheme, loadTheme, saveTheme, type ThemeChoice } from './theme';
import { Celebration, inkSources } from './celebration/Celebration';
import { dayFor, dayNumber, daysFor, loadDaily, localDate } from './daily/daily';
import { CELL_W, WordEditor } from './components/maze/WordEditor';
import { loadLetters, type WordLength } from './letters';
import { Glyph, GlyphWord } from './components/Glyph';
import { dailyRecord, formatTime } from './stats';
import { scoreName } from './golf';
import { keepWin, loadResult, type Result } from './results';
import { SAMPLE } from './tutorial';
import { isFirstVisit, loadOnboarded, saveOnboarded } from './onboarding';
import { AD_SLOTS, BANNER, RAIL_H, loadAdSense, railWidth } from './ads';
import { AdSlot } from './components/AdSlot';

/** A puzzle's ink pots: where they are, the best score with them, and a route that gets it. */
type PotPlan = Omit<InkPots, 'bound'>;

/** A puzzle, with its ink pots (used when that modifier is on). */
interface Pick {
  puzzle: Puzzle;
  inkPots: PotPlan;
  /** A daily's date (pool puzzles have none). */
  date?: string;
  /** An Easycore daily (see src/easycore.ts): its results and record are kept apart from the classic ones. */
  easy?: boolean;
  /** How to play's sample puzzle (see src/tutorial.ts): coached, played as Classic, and it keeps nothing. */
  sample?: boolean;
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
}

/**
 * A pool of puzzles (see scripts/mazes.ts), fetched the first time it's needed: the one the dailies
 * are chosen from, which only the freshPuzzle flag and dev's New start & goal play from, so a visit
 * doesn't load it; or Easycore's, which its days come from. (One that didn't load is asked for again.)
 */
const pools = new Map<string, Promise<Pick[]>>();
function loadPool(file: string): Promise<Pick[]> {
  if (!pools.has(file))
    pools.set(
      file,
      fetch(dataUrl(file))
        .then((r) => r.json() as Promise<{ puzzles: Pick[] }>)
        .then((p) => p.puzzles)
        .catch(() => {
          pools.delete(file);
          return [];
        }),
    );
  return pools.get(file)!;
}
/** The pool a game plays from: Easycore's, or the dailies' at its word length. */
const poolFile = (letters: WordLength, easy: boolean) => (easy ? 'pool-5-easy.json' : letters === 5 ? 'pool-5.json' : 'pool.json');
/** Easycore's puzzle for `date`, from its pool (none if the pool didn't load). */
const easyPick = (pool: Pick[], date: string): Pick | null => (pool.length ? { ...pool[easyIndex(date, pool.length)], date, easy: true } : null);

/** How to play's sample puzzle, as a puzzle to play: no date, so no result, record or done mark (see keepWin), and no ink pots. */
const SAMPLE_PICK: Pick = {
  puzzle: { start: SAMPLE.start, goal: SAMPLE.goal, best: SAMPLE.best, path: SAMPLE.path },
  inkPots: { pots: [], best: SAMPLE.best, walk: SAMPLE.path },
  sample: true,
};

/** A random puzzle from the pool, other than the one being played (the maze's own puzzle if there's no pool). */
function pickPuzzle(pool: Pick[], data: MazeData, current?: Puzzle): Pick {
  const from = pool.length ? pool : [{ puzzle: data.puzzle, inkPots: data.inkPots, onRoute: data.onRoute }];
  const options = from.length > 1 ? from.filter((p) => p.puzzle.start !== current?.start || p.puzzle.goal !== current?.goal) : from;
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

/** A path's steps, for sharing: where each began, the word it made, and its strokes. */
const stepsOf = (trail: Visit[]): ShareResult['steps'] => trail.slice(1).map((v) => ({ from: v.from ?? v.word, to: v.word, cost: v.cost }));

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
  /** Free trips back to a word already visited, for the score card's stats. */
  const [backs, setBacks] = useState(0);
  /** When the first stroke went in (the clock starts there), and how long the solve took. */
  const startedAt = useRef<number | null>(null);
  const [seconds, setSeconds] = useState<number | null>(null);
  /** The door just walked through (cost 0 when it led back to a word already visited). */
  const [lastDoor, setLastDoor] = useState<(Visit & { back: boolean; pot: boolean }) | null>(null);
  const [hoverTile, setHoverTile] = useState<TileId | null>(null);
  /** A lowest-stroke route is shown, once the puzzle's solved (after the win, or from the "Solved today" note). */
  const [reveal, setReveal] = useState(false);
  // Hints, for the word the player is in: first the next word's meaning, then the letters to
  // change, then the word to make (see src/hints.ts). They're free, but each ask counts as a hint
  // (the win message, the stats and the share card say how many).
  const [hint, setHint] = useState<{ room: string; level: HintLevel; step: NextStep | null; meaning: string | null } | null>(null);
  const hintRef = useRef(hint);
  hintRef.current = hint;
  const [hintsUsed, setHintsUsed] = useState(0);
  const [defs, setDefs] = useState<Definitions | null>(null);
  /** A word in Your path whose definition is shown under it (tap a word to look it up). */
  const [peek, setPeek] = useState<string | null>(null);
  // The difficulty (Settings): Easycore, Classic or Hardcore. Easycore takes the easycore flag and
  // the 5-letter game; without them a stored Easycore plays Classic (see src/easycore.ts).
  const [difficulty, setDifficulty] = useState<Difficulty>(loadDifficulty);
  const easyOn = flags.easycore && letters === 5;
  const mode: Difficulty = difficulty === 'easy' && !easyOn ? 'classic' : difficulty;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  // Settings (the gear): light or dark, the player's choice or the device's.
  const [settings, setSettings] = useState(false);
  const gearBtn = useRef<HTMLButtonElement>(null);
  const [theme, setTheme] = useState<ThemeChoice>(loadTheme);
  const themeRef = useRef(theme);
  themeRef.current = theme;
  useEffect(() => followSystemTheme(() => themeRef.current), []);
  // The rest of the settings: the stroke colours, motion, the letter guide, definitions.
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  useEffect(() => followSystemMotion(() => prefsRef.current.motion), []);
  // public/boot.js set the stroke colours before the first paint, unless a browser kept a copy from before it did.
  useEffect(() => applyPalette(prefsRef.current.palette), []);
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
  // Opened by itself on a first visit, it offers the sample puzzle (see src/onboarding.ts); closing it
  // there, any way, skips the sample. From the ? button it offers the sample again.
  const [firstVisit, setFirstVisit] = useState(() => isFirstVisit(seenHelp(), loadOnboarded(), new URLSearchParams(location.search).has('help')));
  const firstRef = useRef(firstVisit);
  firstRef.current = firstVisit;
  const [sampled, setSampled] = useState(() => loadOnboarded() === 'done');
  const helpBtn = useRef<HTMLButtonElement>(null);
  const helpClose = useRef<HTMLButtonElement>(null);
  const closeHelp = useCallback(() => {
    setHelp(false);
    helpBtn.current?.focus();
    if (firstRef.current) saveOnboarded('skipped');
    setFirstVisit(false);
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
  // With the ads flag on, the AdSense script (only once real IDs are filled in, in src/ads.ts).
  useEffect(() => {
    if (flags.ads) loadAdSense();
  }, [flags.ads]);

  useEffect(() => {
    // The puzzle is picked before the first render: the day's puzzle for the player's own date
    // (Easycore's, at that difficulty), or with the freshPuzzle flag a random one from the pool.
    // ?day=YYYY-MM-DD plays an earlier day's (any day's, in development); Easycore has one for every
    // date from the first. (`live` drops a load that was superseded, e.g. by StrictMode running this
    // effect twice in development.)
    let live = true;
    const today = localDate();
    const asked = new URLSearchParams(location.search).get('day');
    const allowed = (date: string) => import.meta.env.DEV || date <= today;
    const days = daysFor(letters);
    const date = asked && days.includes(asked) && allowed(asked) ? asked : dayFor(today, days);
    easyDate.current = asked && isEasyDay(asked) && allowed(asked) ? asked : easyDayFor(today);
    const easy = mode === 'easy';
    const maze = letters === 5 ? 'mazes-5.json' : 'mazes.json';
    Promise.all([
      fetch(dataUrl(maze)).then((r) => r.json() as Promise<MazeData>),
      loadDaily(date, letters),
      flags.freshPuzzle ? loadPool(poolFile(letters, easy)) : null,
      easy ? loadPool(poolFile(letters, true)) : null,
    ]).then(([d, day, pool, easyPool]) => {
      if (!live) return;
      const pick: Pick = { puzzle: day.puzzle, inkPots: day.inkPots, need: day.need, tricky: day.tricky, date: day.date, onRoute: day.onRoute };
      // (Should Easycore's pool not load, the classic daily is played.)
      const easyDay = easyPool && easyPick(easyPool, easyDate.current);
      setData(d);
      setDaily(pick);
      setEasyDaily(easyDay);
      setCurrent(pool ? pickPuzzle(pool, d) : (easyDay ?? pick));
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
  /** Easycore's day (once its pool has loaded), and its date: the classic daily's, or any day asked for. */
  const [easyDaily, setEasyDaily] = useState<Pick | null>(null);
  const easyDate = useRef('');
  const puzzle = current?.puzzle;
  /** The puzzle's ink pots, when that modifier is on. */
  const potPlan = flags.inkPots ? (current?.inkPots ?? null) : null;
  const best = potPlan?.best ?? puzzle?.best ?? 0;
  const dict = useMemo(() => new Set(data?.words ?? []), [data]);
  /** How to play's sample puzzle is being played: coached, and played as Classic whatever the difficulty. */
  const sample = !!current?.sample;
  /** Hardcore: only words on a lowest-stroke route open, so every step must keep the player on par (see src/hardcore.ts). */
  const hardcore = mode === 'hard' && !sample;

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
    if (flag === 'freshPuzzle' && data) {
      if (next.freshPuzzle) loadPool(poolFile(letters, mode === 'easy')).then((pool) => setCurrent(pickPuzzle(pool, data, puzzle)));
      else setCurrent(mode === 'easy' ? easyDaily : daily);
    }
    // Easycore chosen comes and goes with its flag.
    if (flag === 'easycore' && difficulty === 'easy' && letters === 5) playMode(next.easycore);
  };

  /**
   * Plays a difficulty's daily, Easycore's (loading its pool the first time) or the classic one, or
   * with the freshPuzzle flag a random puzzle from its pool. A daily already solved today starts
   * with the result ("Solved today in…"), as on a return visit.
   */
  const playMode = (easy: boolean) => {
    if (!data) return;
    if (flags.freshPuzzle) {
      loadPool(poolFile(letters, easy)).then((pool) => setCurrent(pickPuzzle(pool, data, puzzle)));
      return;
    }
    if (!easy) return setCurrent(daily);
    if (easyDaily) return setCurrent(easyDaily);
    loadPool(poolFile(letters, true)).then((pool) => {
      const day = easyPick(pool, easyDate.current);
      if (!day) return; // didn't load: the classic daily goes on
      setEasyDaily(day);
      // (Unless the player has switched again while it loaded.)
      if (modeRef.current === 'easy') setCurrent(day);
    });
  };

  /** Each start of a puzzle (the coach starts the sample afresh on each). */
  const [run, setRun] = useState(0);
  const restart = useCallback(() => {
    if (!puzzle) return;
    setRun((r) => r + 1);
    setRoom(puzzle.start);
    setCells(cellsFor(puzzle.start));
    setHistory([]);
    setTrail([{ word: puzzle.start, cost: 0 }]);
    setSpent(0);
    setBacks(0);
    startedAt.current = null;
    setSeconds(null);
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

  /**
   * The difficulty is chosen in Settings (the Hardcore switch, without the easycore flag). To or from
   * Easycore plays that difficulty's daily. Turning Hardcore on starts a puzzle in progress over (no
   * stroke, word or hint carries into a hardcore result); turning it off lets the puzzle go on.
   */
  const changeDifficulty = (next: Difficulty) => {
    const now: Difficulty = next === 'easy' && !easyOn ? 'classic' : next;
    saveDifficulty(next);
    setDifficulty(next);
    // (In the sample, a difficulty chosen is a puzzle wanted: that difficulty's daily.)
    if ((now === 'easy') !== (mode === 'easy') || sample) {
      setRefused(null);
      playMode(now === 'easy');
      return;
    }
    const on = now === 'hard';
    if (on === hardcore) return;
    const over = on && hasStarted({ words: trail.length - 1, strokes: history.length, hints: hintsUsed });
    if (over) restart();
    setRefused(null);
    setNotice(on ? `Hardcore on${over ? ', so the puzzle starts over' : ''}: only lowest-stroke words count, and no hints.` : 'Hardcore off.');
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
  // Reaching the goal in the lowest possible strokes (an Ace) celebrates: confetti pops out of the
  // word. Each run is a fresh one, so Watch again starts it over even while it's still falling. In
  // development, ?perfect plays it at once (?perfect=1.2 holds it at 1.2 seconds).
  const perfect = won && spent <= best;
  const [celebrating, setCelebrating] = useState<{ run: number; freezeAt?: number } | null>(null);
  const celebrate = (freezeAt?: number) => setCelebrating((c) => ({ run: (c?.run ?? 0) + 1, freezeAt }));
  useEffect(() => {
    if (!won) return;
    if (perfect) celebrate();
    const took = startedAt.current ? (Date.now() - startedAt.current) / 1000 : 0;
    setSeconds(took);
    // The sample, played through: it's not offered by itself again, and keeps nothing else.
    if (current?.sample) {
      saveOnboarded('done');
      setSampled(true);
    }
    // A daily's result is kept, so coming back today shows it (the best one, if played again), and
    // today's leaves the mark a Puzzle Playlist on this origin would read. The playlist itself lives
    // on funklunsford.github.io, out of reach, so it ticks Strokes when you come back instead.
    const kept = current && keepWin(current, letters, { strokes: spent, best, hints: hintsUsed, hardcore, steps: stepsOf(trail), seconds: Math.round(took) });
    if (kept) setSaved(kept);
  }, [won]);
  /** Today's result from an earlier visit (or this one), if any. */
  const [saved, setSaved] = useState<Result | null>(null);
  useEffect(() => setSaved(current?.date ? loadResult(current.date, letters, current.easy) : null), [current?.date, current?.easy, letters]);
  /** The player's record over the dailies (Easycore's over its own), for the end of a daily (worked out again once its result is kept). */
  const record = useMemo(
    () =>
      current?.date ? dailyRecord(current.easy ? easyDays(current.date) : daysFor(letters), (d) => loadResult(d, letters, current.easy), current.date) : null,
    [current?.date, current?.easy, letters, saved],
  );
  /** The result being shared (the share sheet is open). */
  const [sharing, setSharing] = useState<ShareResult | null>(null);
  const shareBtn = useRef<HTMLButtonElement>(null);
  const share = (r: Result | null) => {
    if (!puzzle || !r) return;
    const date = current?.date;
    setSharing({ ...r, start: puzzle.start, goal: puzzle.goal, date, number: date ? dayNumber(date) : undefined, easycore: !!current?.easy });
  };
  const closeShare = useCallback(() => {
    setSharing(null);
    shareBtn.current?.focus();
  }, []);
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const at = (key: string) => (q.get(key) ? Number(q.get(key)) : undefined);
    if (import.meta.env.DEV && q.has('perfect')) celebrate(at('perfect'));
  }, []);
  const stepEdits = history.length;
  const locked = stepEdits >= STEP_LIMIT;

  const onEdit = useCallback(
    (next: Placement[][]): boolean => {
      if (won || locked) return false;
      startedAt.current ??= Date.now();
      // Playing again closes a route opened from the "Solved today" note, so the win offers it afresh.
      setReveal(false);
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
        setRoom(word);
        setCells(cellsFor(word));
        setHistory([]);
        // Going back to a word already visited is free, and it isn't listed again.
        if (trail.some((v) => v.word === word)) {
          setBacks((n) => n + 1);
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

  // How to play's sample puzzle, coached a tip at a time, with a ghost hand on the board showing the
  // next move (see Coach.tsx). The goal's tip points at the goal panel.
  const coach = useCoach({
    active: sample,
    run,
    won,
    locked,
    used: stepEdits,
    room,
    cells,
    visited: trail.map((v) => v.word),
    landings: trail.length - 1 + backs,
    lastDoor,
    goal: puzzle?.goal ?? '',
    doorsOf,
    dict,
    touch: coarse,
  });
  const goalRef = useRef<HTMLDivElement>(null);
  const editorBox = useRef<HTMLDivElement>(null);
  // Tips go in two places: right above the word (the goal, pointing up at it; the next move, pointing
  // down at its letter; a word made; solved, with the way on), and in the step line (the step's
  // strokes, pointing at its dots; out of strokes, pointing at Undo and Reset).
  const headTip = coach.tip === 'goal' || coach.tip === 'move' || coach.tip === 'word' || coach.tip === 'done';
  const lineTip = coach.tip === 'dots' || coach.tip === 'out';
  const headTipRef = useRef<HTMLDivElement>(null);
  const lineTipRef = useRef<HTMLDivElement>(null);
  const arrowDeps = [coach.tip, coach.move?.cell, width, height, compact];
  const headArrow = useArrowTo(
    headTipRef,
    () => (coach.tip === 'goal' ? goalRef.current : coach.tip === 'move' && coach.move ? boardRef.current?.querySelectorAll('.cell')[coach.move.cell] : null),
    arrowDeps,
  );
  const lineArrow = useArrowTo(
    lineTipRef,
    () => (coach.tip === 'dots' ? document.querySelector('.step-meter .pips') : coach.tip === 'out' ? [...document.querySelectorAll('.controls .step-btn')].slice(0, 2) : null),
    arrowDeps,
  );
  // A tip in the step line pushes the dots down: on a short screen (1280 × 800) past the fold, so they're
  // brought into view with it.
  useEffect(() => {
    if (lineTip) document.querySelector('.step-meter')?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
  }, [lineTip && coach.tip, reduce]);
  /** The sample, from How to play's card: afresh, even when it's being played already. */
  const startSample = () => {
    setHelp(false);
    setFirstVisit(false);
    if (current === SAMPLE_PICK) restart();
    else setCurrent(SAMPLE_PICK);
  };
  /** From the sample to today's puzzle, at the player's difficulty: Skip, or Play today's puzzle once it's solved. */
  const leaveSample = () => {
    saveOnboarded(won ? 'done' : 'skipped');
    playMode(mode === 'easy');
  };

  if (!data || !puzzle || !room) return <div className="maze loading">Loading…</div>;

  /** The daily at this difficulty (for Dev to go back to). */
  const modeDaily = mode === 'easy' ? easyDaily : daily;
  // The main column (score, board, step controls) with the path card beside it when there's room.
  const columnW = letters === 5 ? COLUMN_W_5 : COLUMN_W;
  const side = width >= (letters === 5 ? SIDE_MIN_5 : SIDE_MIN);
  const column = Math.min(width - 32, columnW);
  // Ads (the ads flag): a banner over the header on phones, and a rail either side of the game
  // where both fit beside it at its full width (see railWidth). Tablets and middle widths get none.
  const banner = flags.ads && compact;
  const rail = flags.ads && side ? railWidth(width, columnW, SIDE_W) : 0;
  // Board padding, the gaps between letter tiles (10 px) and their own padding (12 px) come off
  // before sizing the word, whose letters are CELL_W units wide each.
  const n = puzzle.start.length;
  const unit = Math.max(13, Math.min(32, (column - 36 - 10 * (n - 1) - 12 * n) / (CELL_W * n)));
  const visited = new Set(trail.map((v) => v.word));
  const shownHint = hint && hint.room === room && !won ? hint : null;
  const askHint = () => {
    // No hints in hardcore, and nothing more once the word itself has been shown.
    if (!data || !puzzle || won || hardcore || shownHint?.level === 3) return;
    // The latest thing asked for wins the step line.
    setRefused(null);
    setNotice(null);
    // The search takes a moment on a phone: show the hint once it's ready, without blocking the tap.
    window.setTimeout(() => {
      // From the latest hint, so two quick asks show two levels, as they're counted.
      const h = hintRef.current;
      const shown = h && h.room === room ? h : null;
      if (shown?.level === 3) return;
      const step = shown ? shown.step : nextStep(doorsOf!, room, puzzle.goal, visited);
      // The next word's meaning, as a clue (none when it has no definition, or they didn't load).
      const def = step && defs?.[step.next];
      const meaning = shown ? shown.meaning : step && def ? clue(step.next, def) : null;
      const next = { room, step, meaning, level: (step && nextHintLevel(shown?.level ?? null, !!meaning)) || 3 };
      hintRef.current = next;
      setHint(next);
      // Each ask is a hint: the meaning, the letters and the word count one each.
      setHintsUsed((n) => n + 1);
    }, 0);
  };
  const hintText = shownHint ? (shownHint.step ? hintSays(shownHint.step, shownHint.level, shownHint.meaning) : 'No hint from here.') : null;
  // In hardcore, only the words that would open: visited ones (free) and the route's next on par.
  const reach = hardcore && current?.onRoute ? roomExits.filter((x) => visited.has(x.word) || current.onRoute![x.word] === spent + x.cost) : roomExits;
  const found = reach.filter((x) => visited.has(x.word)).length;
  const lettersWithTile = hoverTile ? new Set(Object.keys(LETTERS).filter((ch) => recipe(ch).has(hoverTile))) : null;
  const potsLeft = (potPlan?.pots ?? []).filter((p) => !visited.has(p));
  const potsNear = won ? [] : potsLeft.filter((p) => wordDistance(room, p) <= STEP_LIMIT);
  const banked = Math.max(0, ink - inFlight);
  const used = spent + stepEdits;
  /** The game so far: words made and the costliest step (shown at the end), free trips back, ink spent. */
  const made = trail.length - 1;
  const biggest = Math.max(0, ...trail.slice(1).map((v) => v.cost + (v.used ?? 0)));
  const inkSpent = trail.reduce((t, v) => t + (v.used ?? 0), 0);

  // The step after a door opens, until the next stroke: confirm it (completion feedback).
  const justOpened = !won && !stepEdits && !!lastDoor;

  // A lowest-stroke route, only once the puzzle's solved: the path card's chips, each with its
  // step's strokes (with ink pots, as the game charges them), under the total.
  const route = potPlan?.walk ?? puzzle.path;
  const bestRoute = reveal && (
    <div className="best-route">
      <span className="label" id="route-label">
        Lowest-stroke route · {best} strokes
      </span>
      <ol className="route" aria-labelledby="route-label">
        <li>
          <GlyphWord word={route[0]} size={14} />
        </li>
        {walkSteps(route, potPlan?.pots ?? []).map((s, i) => (
          <li key={i}>
            <span className="cost">+{s.cost}</span>
            {!!s.used && (
              <span className="ink-used" aria-label={`${s.used} paid in ink`}>
                <InkDrop size={9} />
                {s.used}
              </span>
            )}
            <GlyphWord word={s.word} size={14} />
            {potPlan?.pots.includes(s.word) && <InkPot full={false} size={13} />}
          </li>
        ))}
      </ol>
    </div>
  );

  return (
    <PrefsContext.Provider value={prefs}>
    <MotionConfig reducedMotion={motionConfig(prefs.motion)}>
      <div
        className={`maze${side ? ' side' : ''}${compact ? ' compact' : ''}${letters === 5 ? ' five' : ''}${banner ? ' ad-top' : ''}${rail ? ' rails' : ''}`}
        style={
          side ? { gridTemplateColumns: rail ? `${rail}px minmax(0, ${columnW}px) ${SIDE_W}px ${rail}px` : `minmax(0, ${columnW}px) ${SIDE_W}px` } : undefined
        }
      >
        <Masthead
          // A short screen (a phone on its side) gets the slim wordmark too, leaving room for the game.
          compact={compact || height < 500}
          actions={
            // The game's buttons in one bar: How to play and settings (hardcore is a setting).
            <div className="toolbar">
              <button ref={helpBtn} className="tool-btn help-btn" aria-label="How to play" aria-haspopup="dialog" aria-expanded={help} onClick={() => setHelp(true)}>
                ?
              </button>
              <button ref={gearBtn} className="tool-btn gear-btn" aria-label="Settings" aria-haspopup="dialog" aria-expanded={settings} onClick={() => setSettings(true)}>
                <GearIcon />
              </button>
            </div>
          }
          dateline={
            sample
              ? 'Sample puzzle'
              : current?.date &&
                `No. ${dayNumber(current.date)}${current.easy ? ' · Easycore' : ''} · ${new Date(`${current.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}`
          }
        />

        <main className="column">
          <section className="scorecard">
            <div ref={goalRef} className={`goal-panel${won ? ' reached' : ''}${coach.tip === 'goal' ? ' pointed' : ''}`}>
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
            {/* How the game's going: free returns and ink paid, when there are any. The words made,
                hints taken and biggest step wait for the end of the game (the owner's call). */}
            {(backs > 0 || inkSpent > 0) && (
              <ul className="score-stats" aria-label="This game so far">
                {backs > 0 && (
                  <li>
                    <strong>{backs}</strong> free {backs === 1 ? 'return' : 'returns'}
                  </li>
                )}
                {inkSpent > 0 && (
                  <li>
                    <strong>{inkSpent}</strong> paid in ink
                  </li>
                )}
              </ul>
            )}
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
                  {/* Touch screens and mouse play differently (tap vs click; a finger double-taps to turn, a mouse swipes), so each gets its own. */}
                  <HowToCard
                    touch={coarse}
                    compact={compact}
                    firstVisit={firstVisit}
                    // The sample's words are 5 letters; and it's not offered over a puzzle in progress, which it would lose.
                    canSample={letters === 5 && (sample || won || !hasStarted({ words: trail.length - 1, strokes: history.length, hints: hintsUsed }))}
                    sampled={sampled}
                    easycore={easyOn}
                    inkPots={!!potPlan}
                    closeRef={helpClose}
                    onClose={closeHelp}
                    onSample={startSample}
                    onSkip={closeHelp}
                  />
                </motion.section>
              </motion.div>
            )}
          </AnimatePresence>

          <section
            className="board"
            ref={boardRef}
            onPointerDownCapture={sample ? coach.busy : undefined}
            onPointerUpCapture={sample ? coach.rest : undefined}
            onPointerCancelCapture={sample ? coach.rest : undefined}
          >
            <div className="board-head">
              <span className="label">You are in</span>
              {sample ? (
                // The sample's coach, right above the word: the goal (pointing up at it), each move (at its letter), a word made.
                <div className="coach-slot" ref={headTipRef}>
                  {coach.text && headTip && coach.tip !== 'done' && (
                    <CoachTip text={coach.text} point={coach.tip === 'goal' ? 'up' : 'down'} arrowX={headArrow} onClose={coach.close} />
                  )}
                  {/* Solved: on to today's puzzle (the sample kept nothing to share or count). */}
                  {coach.text && coach.tip === 'done' && (
                    <CoachTip text={coach.text} point="none">
                      <button className="pill coach-go" onClick={leaveSample}>
                        Play today's puzzle
                      </button>
                    </CoachTip>
                  )}
                </div>
              ) : (
                // The word's meaning sits right above it, and changes as each new word is made.
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
              )}
            </div>
            {sample && !won && (
              <button className="pill quiet skip-sample" onClick={leaveSample} aria-label="Skip the sample puzzle">
                Skip
              </button>
            )}
            {/* The editor alone, so the sample's ghost hand is measured against it. */}
            <div className="board-editor" ref={editorBox}>
              <WordEditor
                cells={cells}
                unit={unit}
                compact={compact}
                disabled={won || locked}
                hinted={shownHint && shownHint.level >= 2 ? shownHint.step?.letters : undefined}
                room={room}
                onEdit={onEdit}
                onHoverTile={setHoverTile}
                onMiss={(why) =>
                  setNotice(
                    why === 'turn'
                      ? `That fits there turned the other way: ${coarse ? 'turn it in the tray first' : 'swipe as you drop it'}.`
                      : "That stroke doesn't fit in that letter.",
                  )
                }
                // A turn the ghost shows is drawn on the stroke itself: the editor hides its own ink meanwhile.
                ghosted={coach.ghost?.ghost.kind === 'turn' && !reduce ? `${coach.ghost.cell}|${slotKey(coach.ghost.ghost.at)}` : undefined}
              />
              {sample && <BoardGhost box={editorBox} move={coach.ghost} cells={cells} touch={coarse} still={reduce} compact={compact} />}
            </div>
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
                <span className="nowrap">
                  {' '}
                  · {scoreName(spent, best)}
                  {spent <= best && ' ⭐'}
                </span>
                {hardcore && <span className="nowrap"> · hardcore</span>}
                {current?.easy && <span className="nowrap"> · easycore</span>}
              </p>
              {/* The sample's way on is in the coach's tip, over the word: no stats, record or share for it. */}
              {!sample && (
                <>
                  {/* This game's stats, then (for a daily) the player's record over them. */}
                  <dl className="result-stats" aria-label="This game">
                    <div>
                      <dt>{spent <= best ? 'lowest possible' : 'over the lowest'}</dt>
                      <dd>{spent <= best ? best : `+${spent - best}`}</dd>
                    </div>
                    <div>
                      <dt>words made</dt>
                      <dd>{made}</dd>
                    </div>
                    <div>
                      <dt>biggest step</dt>
                      <dd>+{biggest}</dd>
                    </div>
                    {seconds !== null && (
                      <div>
                        <dt>time</dt>
                        <dd>{formatTime(seconds)}</dd>
                      </div>
                    )}
                    <div>
                      <dt>{backs === 1 ? 'free return' : 'free returns'}</dt>
                      <dd>{backs}</dd>
                    </div>
                    <div>
                      <dt>{hintsUsed === 1 ? 'hint' : 'hints'}</dt>
                      <dd>{hintsUsed}</dd>
                    </div>
                  </dl>
                  {record && record.solved > 0 && (
                    <>
                      <span className="label" id="record-label">
                        {current?.easy ? 'Your Easycore dailies' : 'Your dailies'}
                      </span>
                      <dl className="result-stats record" aria-labelledby="record-label">
                        <div>
                          <dt>dailies solved</dt>
                          <dd>{record.solved}</dd>
                        </div>
                        <div>
                          <dt>aces</dt>
                          <dd>{record.perfect}</dd>
                        </div>
                        <div>
                          <dt>streak</dt>
                          <dd>{record.streak}</dd>
                        </div>
                        <div>
                          <dt>best streak</dt>
                          <dd>{record.bestStreak}</dd>
                        </div>
                      </dl>
                    </>
                  )}
                  <div className="pill-row">
                    <button
                      ref={shareBtn}
                      className="pill"
                      aria-haspopup="dialog"
                      onClick={() => share({ strokes: spent, best, hints: hintsUsed, hardcore, steps: stepsOf(trail) })}
                    >
                      Share
                    </button>
                    {spent <= best && !reduce && (
                      <button className="pill quiet" onClick={() => celebrate()}>
                        Watch again
                      </button>
                    )}
                    <button className="pill quiet" aria-expanded={reveal} onClick={() => setReveal((r) => !r)}>
                      {reveal ? 'Hide' : 'See'} the lowest-stroke route
                    </button>
                  </div>
                  {bestRoute}
                  {current?.date && <p className="result-next">A new puzzle comes at midnight.</p>}
                </>
              )}
            </section>
          ) : (
          <section className="controls" aria-label="This step">
            {saved && stepEdits === 0 && trail.length === 1 && (
              <>
                <p className="solved-before">
                  Solved today in {saved.strokes}
                  {saved.strokes <= saved.best ? ' · perfect ⭐' : ''}. Play it again any time,{' '}
                  <button ref={shareBtn} className="link-btn" aria-haspopup="dialog" onClick={() => share(saved)}>
                    share it
                  </button>
                  , or{' '}
                  <button className="link-btn" aria-expanded={reveal} onClick={() => setReveal((r) => !r)}>
                    {reveal ? 'hide' : 'see'} the lowest-stroke route
                  </button>
                  .
                </p>
                {bestRoute}
              </>
            )}
            <div className="pill-row">
              <button className="pill step-btn" onClick={undo} disabled={!history.length}>
                <UndoIcon />
                Undo
              </button>
              {/* Back to the start of this step (the word the step began on). */}
              <button className="pill step-btn" onClick={resetStep} disabled={!history.length}>
                <ResetIcon />
                Reset
              </button>
              {/* No hints in hardcore: the button gives way to a quiet note. */}
              {hardcore ? (
                <span className="no-hints">No hints</span>
              ) : (
                <button className="pill step-btn hint-btn" onClick={askHint} disabled={won || shownHint?.level === 3}>
                  <HintIcon />
                  Hint
                </button>
              )}
            </div>
            {/* In the sample the coach has the step line (the step's strokes, out of strokes), unless
                the player's just been told something else (a stroke that doesn't fit, a hint). */}
            {sample && !notice && !(hintText && !locked) && coach.text && lineTip ? (
              <div className="coach-line" ref={lineTipRef}>
                <CoachTip text={coach.text} point={coach.tip === 'dots' ? 'down' : 'up'} arrowX={lineArrow} onClose={coach.close} />
              </div>
            ) : (
              <p aria-live="polite" className={`step-status${refused ? ' out' : hintText && !locked ? ' hinted' : locked ? ' out' : justOpened ? ' opened' : ''}`}>
                {refused
                  ? `Hardcore: ${refused} is off the lowest-stroke route.`
                  : notice
                  ? notice
                  : hintText && !locked
                  ? hintText
                  : sample
                  ? null
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
            )}
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
          </div>
          {import.meta.env.DEV && (
            <div className="dev-tools">
              <span className="label">Dev</span>
              {current?.need && (
                <span className="maze-kind">
                  This maze: {current.tricky ? 'tricky' : 'obvious'}, {NEEDS[current.need]}
                </span>
              )}
              <button className="pill quiet" onClick={() => loadPool(poolFile(letters, mode === 'easy')).then((pool) => setCurrent(pickPuzzle(pool, data, puzzle)))}>
                New start & goal
              </button>
              {modeDaily && current !== modeDaily ? (
                <button className="pill quiet" onClick={() => setCurrent(modeDaily)}>
                  Play the daily ({modeDaily.puzzle.start} → {modeDaily.puzzle.goal})
                </button>
              ) : null}
              <button className="pill quiet" onClick={() => celebrate()}>
                Preview confetti
              </button>
              {(Object.keys(FLAGS) as Flag[]).map((f) => (
                <label key={f} className="flag">
                  <input type="checkbox" checked={flags[f]} onChange={() => toggleFlag(f)} /> {FLAGS[f].label}
                </label>
              ))}
            </div>
          )}
        </aside>
        {/* The ads come last, so the keyboard and screen readers reach the game first (the grid
            draws them in their places). A rail's key has its width: a filled ad can't be resized. */}
        {banner && <AdSlot className="ad-banner" slot={AD_SLOTS.banner} width={BANNER.w} height={BANNER.h} />}
        {rail > 0 && <AdSlot key={`left-${rail}`} className="ad-rail left" label="Advertisement, left" slot={AD_SLOTS.railLeft} width={rail} height={RAIL_H} />}
        {rail > 0 && <AdSlot key={`right-${rail}`} className="ad-rail right" label="Advertisement, right" slot={AD_SLOTS.railRight} width={rail} height={RAIL_H} />}
      </div>
      <AnimatePresence>
        {settings && (
          <Settings
            theme={theme}
            onTheme={chooseTheme}
            prefs={prefs}
            onPrefs={changePrefs}
            difficulty={mode}
            onDifficulty={changeDifficulty}
            easycore={easyOn}
            onClose={closeSettings}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>{sharing && <ShareSheet result={sharing} onClose={closeShare} />}</AnimatePresence>
      {inkFlights}
      {celebrating && (
        <Celebration key={celebrating.run} from={wordInk} freezeAt={celebrating.freezeAt} onClose={() => setCelebrating(null)} />
      )}
    </MotionConfig>
    </PrefsContext.Provider>
  );
}

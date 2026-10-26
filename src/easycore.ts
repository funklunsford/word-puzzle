// Easycore (Settings → Difficulty, behind the easycore flag): a daily of its own for middle and early
// high school players, shorter than the classic one (lowest 5–8 strokes over 2–3 steps, against
// 12–15 over 4–8) and built from simpler words, with the same rules, hints and scoring.
//
// Its puzzles come from a pool of their own (public/pool-5-easy.json; see scripts/mazes.ts --easy),
// one a date: the pool in a seeded random order, indexed by the daily's number, and a new order each
// time round, so no puzzle comes back until every one has been played. From PAR_RULE_FROM
// (2026-10-28) it passes over the puzzles with a word a player must find to make Par (MUST_FIND), so
// each date from then takes the next kept puzzle in the order, and a round is the 802 kept ones. It's
// numbered and dated like the classic daily (src/daily/daily.ts) and has its own results and record.
// The pool's order and length decide every date's puzzle, past ones too, so once it ships it stays as
// it is.
//
// The difficulty setting is kept here too: Easycore, Classic or Hardcore (whose rules are in
// src/hardcore.ts).

import { LAUNCH, PAR_RULE_FROM, dayNumber } from './daily/daily';
import mustFindList from './easycore-must-find.json';
import { seededRandom } from './maze';

/** Easycore, Classic or Hardcore. */
export type Difficulty = 'easy' | 'classic' | 'hard';

const KEY = 'strokes:difficulty';
/** Where Hardcore's switch was kept before the setting ('1' for on). Still written, so the two agree. */
const HARDCORE_KEY = 'strokes:hardcore';

/** The difficulty kept in this browser: Classic unless chosen (or Hardcore was on before the setting). Storage can be missing or blocked. */
export function loadDifficulty(): Difficulty {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'easy' || saved === 'classic' || saved === 'hard') return saved;
    return localStorage.getItem(HARDCORE_KEY) === '1' ? 'hard' : 'classic';
  } catch {
    return 'classic';
  }
}

export function saveDifficulty(difficulty: Difficulty) {
  try {
    localStorage.setItem(KEY, difficulty);
    localStorage.setItem(HARDCORE_KEY, difficulty === 'hard' ? '1' : '0');
  } catch {
    // storage blocked: this visit only
  }
}

/** Seeds the order Easycore's puzzles are played in (plus one for each time round the pool). */
const ORDER_SEED = 2026;

/** 0 to size − 1 in a seeded random order. */
function shuffled(size: number, seed: number): number[] {
  const random = seededRandom(seed);
  const order = Array.from({ length: size }, (_, i) => i);
  for (let i = size - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/**
 * The pool's puzzles with a word a player must find to make Par (see mustFind in src/difficulty.ts),
 * by their place in the pool: 298 of its 1,100. Worked out ahead, so the browser needn't search the
 * maze for each; a test keeps it in step with the pool and the maze.
 */
export const MUST_FIND: ReadonlySet<number> = new Set(mustFindList);

/**
 * Which of a pool of `size` puzzles is Easycore's on `date`: the pool in a seeded random order, one
 * a date, and a new order each time round. From PAR_RULE_FROM, the puzzles in `skip` (MUST_FIND
 * unless given) are passed over: each date takes the next puzzle in the orders that isn't skipped.
 * So dates before it keep their puzzles, nothing comes back within a round, and a round is shorter.
 */
export function easyIndex(date: string, size: number, skip: ReadonlySet<number> = MUST_FIND): number {
  const day = dayNumber(date) - 1;
  const from = dayNumber(PAR_RULE_FROM) - 1;
  const order = (round: number) => shuffled(size, ORDER_SEED + round);
  // The puzzles each round keeps (with none kept, nothing is skipped).
  const kept = size - [...skip].filter((i) => i >= 0 && i < size).length;
  if (day < from || !kept) {
    const round = Math.floor(day / size);
    return order(round)[day - round * size];
  }
  // From the switch-over: the rest of its round, then each round after it, without the skipped ones.
  const first = Math.floor(from / size);
  const rest = order(first)
    .slice(from - first * size)
    .filter((i) => !skip.has(i));
  const k = day - from - rest.length;
  if (k < 0) return rest[day - from];
  return order(first + 1 + Math.floor(k / kept)).filter((i) => !skip.has(i))[k % kept];
}

/** Whether `date` (YYYY-MM-DD) is a real date with an Easycore puzzle: every one from the first daily's. */
export function isEasyDay(date: string): boolean {
  const t = Date.parse(`${date}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(t) && new Date(t).toISOString().startsWith(date) && date >= LAUNCH;
}

/** The Easycore day to play on `today`: that date's (every date has one), or the first, for a clock behind it. */
export const easyDayFor = (today: string) => (today < LAUNCH ? LAUNCH : today);

/** Every Easycore date up to `upTo`, oldest first, for the record of dailies. */
export function easyDays(upTo: string): string[] {
  const days: string[] = [];
  for (let t = Date.parse(`${LAUNCH}T00:00:00Z`); ; t += 86_400_000) {
    const date = new Date(t).toISOString().slice(0, 10);
    if (date > upTo) return days;
    days.push(date);
  }
}

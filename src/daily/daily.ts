// The daily puzzle: one a day, the same for everyone on that date in their own time zone.
//
// Each day is a puzzle file, {DATE}.json, loaded only when needed (written by `npm run daily`, see
// scripts/daily.ts). The 5-letter game's days are in src/daily/days-5 (`npm run daily -- --letters 5`),
// the 4-letter game's in src/daily/days. (Its one day scene, 2026-10-06.ts, no longer plays: an Ace
// gets the confetti, and nothing else celebrates.)

import type { KeptDifficulty } from '../difficulty';
import type { WordLength } from '../letters';
import { seededRandom, type Need, type Puzzle } from '../maze';

export interface DailyPuzzle {
  date: string;
  puzzle: Puzzle;
  /** Where the ink pots are, and the best with them (for the inkPots modifier). */
  inkPots: { pots: string[]; best: number; walk: string[] };
  need: Need;
  tricky: boolean;
  /** How tricky it is (see src/difficulty.ts); days chosen before 2026-10-07 don't say. */
  difficulty?: KeptDifficulty;
  /** Words on a lowest-stroke route, with their strokes from the start (see routeWords): hardcore mode keeps to them. */
  onRoute: Record<string, number>;
}

const puzzles = import.meta.glob<DailyPuzzle>('./days/*.json', { import: 'default' });
const puzzles5 = import.meta.glob<DailyPuzzle>('./days-5/*.json', { import: 'default' });

const dateOf = (path: string) => path.slice(path.lastIndexOf('/') + 1).replace(/\.\w+$/, '');

/** Every date with a puzzle, oldest first. */
export const DAYS = Object.keys(puzzles).map(dateOf).sort();
/** Every date with a 5-letter puzzle (the desktop game), oldest first. */
export const DAYS_5 = Object.keys(puzzles5).map(dateOf).sort();
export const daysFor = (letters: WordLength) => (letters === 5 ? DAYS_5 : DAYS);

/** The first daily; puzzle numbers count from it. */
export const LAUNCH = '2026-10-06';

/**
 * The first date whose dailies, classic and Easycore, have no word a player must find to make Par
 * (see mustFind in src/difficulty.ts). Earlier days stay as they were.
 */
export const PAR_RULE_FROM = '2026-10-28';

/**
 * The first date whose classic dailies have at least FIRST_STEPS easy first steps (see firstSteps in
 * src/difficulty.ts). Easycore's are as they were, and so are earlier days.
 */
export const FIRST_STEP_FROM = '2026-10-30';

/**
 * From MUST_FIND_FROM, about one classic daily in three (MUST_FIND_SHARE, 35%; 15% until 2026-10-29) is a
 * puzzle with a word a player must find to make Par (see mustFind in src/difficulty.ts), the owner's
 * call: the par rule made every day forgiving, and some days should hang on a word. Every other day has none, as from
 * PAR_RULE_FROM. Which days is drawn from the date alone (its own draw, apart from the picker's), so
 * the picker, its check-in and the tests agree. Easycore's are as they were.
 */
export const MUST_FIND_FROM = '2026-10-30';
export const MUST_FIND_SHARE = 0.35;

/** Whether `date`'s classic daily is one with a word a player must find to make Par (MUST_FIND_SHARE of days from MUST_FIND_FROM). */
export function mustFindDay(date: string): boolean {
  if (date < MUST_FIND_FROM) return false;
  const seed = [...`must find ${date}`].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);
  return seededRandom(seed)() < MUST_FIND_SHARE;
}

/**
 * From SIMILAR_FROM, no classic daily's start or goal is like a start or goal of the SIMILAR_DAYS days
 * before it (the owner's call: CLAMP the day after CRAMP feels like a repeat). Like means one letter
 * apart (CLAMP, CRAMP) or ending in the same three letters (SPILL, DRILL). Earlier days stay as they were.
 */
export const SIMILAR_FROM = '2026-11-01';
export const SIMILAR_DAYS = 3;

/** Whether two words of a length are alike (see SIMILAR_FROM): one letter apart, or the same last three letters. */
export function similarWords(a: string, b: string): boolean {
  let apart = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) apart++;
  return apart <= 1 || a.slice(-3) === b.slice(-3);
}

/** A date as YYYY-MM-DD, in the player's own time zone. */
export const localDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** The puzzle to play on `today`: that date's, else the latest before it (else the first, for a clock behind it). */
export function dayFor(today: string, days: readonly string[] = DAYS): string {
  let pick = days[0];
  for (const d of days) if (d <= today) pick = d;
  return pick;
}

/** The puzzle's number: #1 on LAUNCH, counting every day since. */
export const dayNumber = (date: string) => Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${LAUNCH}T00:00:00Z`)) / 86_400_000) + 1;

export const loadDaily = (date: string, letters: WordLength = 4) => (letters === 5 ? puzzles5[`./days-5/${date}.json`] : puzzles[`./days/${date}.json`])();

// The daily puzzle: one a day, the same for everyone on that date in their own time zone.
//
// Each day is a puzzle file, {DATE}.json, loaded only when needed (written by `npm run daily`, see
// scripts/daily.ts). The 5-letter game's days are in src/daily/days-5 (`npm run daily -- --letters 5`),
// the 4-letter game's in src/daily/days. (Its one day scene, 2026-10-06.ts, no longer plays: an Ace
// gets the confetti, and nothing else celebrates.)

import type { KeptDifficulty } from '../difficulty';
import type { WordLength } from '../letters';
import type { Need, Puzzle } from '../maze';

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

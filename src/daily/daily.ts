// The daily puzzle: one a day, the same for everyone on that date in their own time zone.
//
// Each day is two files in src/daily/days, both loaded only when needed:
// - {DATE}.json: the puzzle (written by `npm run daily`, see scripts/daily.ts);
// - {DATE}.ts: its win celebration (a CelebrationModule, see src/celebration/scene.ts).

import type { CelebrationModule } from '../celebration/scene';
import type { Need, Puzzle } from '../maze';

export interface DailyPuzzle {
  date: string;
  puzzle: Puzzle;
  /** Where the ink pots are, and the best with them (for the inkPots modifier). */
  inkPots: { pots: string[]; best: number; walk: string[] };
  need: Need;
  tricky: boolean;
}

const puzzles = import.meta.glob<DailyPuzzle>('./days/*.json', { import: 'default' });
const scenes = import.meta.glob<CelebrationModule>('./days/*.ts');

const dateOf = (path: string) => path.slice(path.lastIndexOf('/') + 1).replace(/\.\w+$/, '');

/** Every date with a puzzle, oldest first. */
export const DAYS = Object.keys(puzzles).map(dateOf).sort();

/** The first daily; puzzle numbers count from it. */
export const LAUNCH = '2026-10-06';

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

export const loadDaily = (date: string) => puzzles[`./days/${date}.json`]();

/** The day's celebration, loaded when it plays (undefined if the day has none). */
export const celebrationFor = (date: string): (() => Promise<CelebrationModule>) | undefined => scenes[`./days/${date}.ts`];

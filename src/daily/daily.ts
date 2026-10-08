// The daily puzzle: one a day, the same for everyone on that date in their own time zone.
//
// Each day is two files in src/daily/days, both loaded only when needed:
// - {DATE}.json: the puzzle (written by `npm run daily`, see scripts/daily.ts);
// - {DATE}.ts: its win celebration (a CelebrationModule, see src/celebration/scene.ts).
// The desktop game's 5-letter days are in src/daily/days-5 (`npm run daily -- --letters 5`): a
// puzzle file each, and no celebration of their own (a Perfect gets the confetti, then the goal word).

import type { CelebrationModule } from '../celebration/scene';
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
const scenes = import.meta.glob<CelebrationModule>('./days/*.ts');

const dateOf = (path: string) => path.slice(path.lastIndexOf('/') + 1).replace(/\.\w+$/, '');

/** Every date with a puzzle, oldest first. */
export const DAYS = Object.keys(puzzles).map(dateOf).sort();
/** Every date with a 5-letter puzzle (the desktop game), oldest first. */
export const DAYS_5 = Object.keys(puzzles5).map(dateOf).sort();
export const daysFor = (letters: WordLength) => (letters === 5 ? DAYS_5 : DAYS);

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

export const loadDaily = (date: string, letters: WordLength = 4) => (letters === 5 ? puzzles5[`./days-5/${date}.json`] : puzzles[`./days/${date}.json`])();

/** The day's celebration, loaded when it plays (undefined if the day has none). */
export const celebrationFor = (date: string): (() => Promise<CelebrationModule>) | undefined => scenes[`./days/${date}.ts`];

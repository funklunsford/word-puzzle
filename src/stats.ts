// The end of a game's stats: the player's record over the dailies, worked out from the results this
// browser keeps (one per daily solved, the best of them), so replaying a day never counts it twice.
// A daily solved on a later day (from Past puzzles) counts as solved, but a streak counts only days
// solved on their own date.

import type { WordLength } from './letters';

/** Where a daily's result is kept: the 4- and 5-letter games keep theirs apart, and Easycore's dailies theirs. */
export const resultKey = (date: string, letters: WordLength, easy = false) => `strokes:result${letters === 5 ? '5' : ''}${easy ? 'e' : ''}:${date}`;

/** A daily's kept result, as far as the record needs it. */
export interface Solved {
  strokes: number;
  best: number;
  /** The player's date when it was first solved (results kept before 2026-10-26 have none: they count as on the day). */
  on?: string;
}

export interface DailyRecord {
  /** Dailies solved, and how many of them in the lowest possible strokes. */
  solved: number;
  perfect: number;
  /**
   * Dailies solved on the day in a row, up to and including `upTo`'s; while `upTo`'s isn't solved
   * yet, the run up to the day before (it can still go on).
   */
  streak: number;
  /** The longest run of dailies solved on the day in a row. */
  bestStreak: number;
}

/** Whether a daily was solved on its own date, for the streak (a result with no date counts as on the day). */
export const onTheDay = (day: string, r: Solved) => !r.on || r.on === day;

/** The record over `days` (every daily, in order), from each one's result if it was solved. */
export function dailyRecord(days: readonly string[], resultOf: (date: string) => Solved | null, upTo: string): DailyRecord {
  let solved = 0;
  let perfect = 0;
  let run = 0;
  let bestStreak = 0;
  let streak = 0;
  for (const day of days) {
    if (day > upTo) break;
    const r = resultOf(day);
    if (r) {
      solved++;
      if (r.strokes <= r.best) perfect++;
    }
    if (r && onTheDay(day, r)) {
      run++;
      bestStreak = Math.max(bestStreak, run);
    } else if (day === upTo) {
      // Not solved on the day (yet): the streak is the run up to it.
      streak = run;
      break;
    } else run = 0;
    if (day === upTo) streak = run;
  }
  return { solved, perfect, streak, bestStreak };
}

/** A time as m:ss (h:mm:ss from an hour). */
export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const [h, m, sec] = [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60];
  const pad = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

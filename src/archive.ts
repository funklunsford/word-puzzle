// Past puzzles (the calendar in the header): every daily so far at the difficulty being played, the
// classic ones or Easycore's, newest first and never one still to come, each with how the player did.
// Tapping one plays it, as ?day= does.

import { dayFor, dayNumber, daysFor } from './daily/daily';
import { easyDayFor } from './easycore';
import type { WordLength } from './letters';
import type { Solved } from './stats';

/** Today's daily, as the game plays it: the latest up to the player's date (Easycore has one every date). */
export const todaysDaily = (today: string, letters: WordLength, easy: boolean) => (easy ? easyDayFor(today) : dayFor(today, daysFor(letters)));

/** How a daily went: not played, part-way (a game kept to carry on), solved, or solved in the lowest possible strokes. */
export type How = 'new' | 'started' | 'solved' | 'ace';

export interface PastDay {
  date: string;
  number: number;
  /** Today's daily. */
  today: boolean;
  how: How;
  /** Its best solve's strokes, once solved. */
  strokes?: number;
}

/**
 * The dailies to choose from, newest first: every one of `days` (oldest first) up to today's
 * (`todays`), with its result if it's solved, else whether it's part-way. A daily solved and being
 * played again shows its result.
 */
export function pastDays(days: readonly string[], todays: string, resultOf: (date: string) => Solved | null, started: (date: string) => boolean): PastDay[] {
  return days
    .filter((date) => date <= todays)
    .reverse()
    .map((date) => {
      const r = resultOf(date);
      const how: How = r ? (r.strokes <= r.best ? 'ace' : 'solved') : started(date) ? 'started' : 'new';
      return { date, number: dayNumber(date), today: date === todays, how, ...(r && { strokes: r.strokes }) };
    });
}

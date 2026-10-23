// What a win leaves in this browser: a daily's result (so coming back today shows it, and the record
// counts it), and for today's daily the Puzzle Playlist's done mark. A pool puzzle and the sample
// puzzle (How to play's) leave nothing.

import type { ShareResult } from './share';
import type { WordLength } from './letters';
import { resultKey } from './stats';
import { easyDayFor } from './easycore';
import { dayFor, daysFor, localDate } from './daily/daily';

/** A daily's result, kept in this browser so a return visit shows it. */
export interface Result {
  strokes: number;
  best: number;
  hints: number;
  hardcore: boolean;
  /** Each step's words and strokes, for the share grid. */
  steps: ShareResult['steps'];
  /** How long it took, from the first stroke (results kept before the stats have none). */
  seconds?: number;
}

/** A daily's kept result (see resultKey: Easycore's are kept apart). */
export const loadResult = (date: string, letters: WordLength, easy = false): Result | null => {
  try {
    const r = JSON.parse(localStorage.getItem(resultKey(date, letters, easy)) ?? 'null');
    // (Results kept before the grid have only each step's strokes: they share without it.)
    return r && { ...r, steps: Array.isArray(r.steps) ? r.steps.filter((s: unknown) => typeof s === 'object') : [] };
  } catch {
    return null;
  }
};

/** The puzzle a win was on: a daily has a date (Easycore's are kept apart); the sample says so. */
export interface Played {
  date?: string;
  easy?: boolean;
  sample?: boolean;
}

/**
 * Keep a win: for a daily, its result if it's the best of the day's (fewer strokes, or as few with
 * fewer hints), and for today's daily the done mark a Puzzle Playlist on this origin reads (see its
 * src/firstParty.ts); not for an earlier day. The result now kept, or null if this one didn't better
 * it, or it's not a daily: the sample puzzle and pool puzzles keep nothing.
 */
export function keepWin(played: Played, letters: WordLength, result: Result, now = new Date()): Result | null {
  const { date, easy = false } = played;
  if (!date || played.sample) return null;
  const today = localDate(now);
  if (date === (easy ? easyDayFor(today) : dayFor(today, daysFor(letters)))) {
    try {
      localStorage.setItem(`puzzle-done:strokes:${today}`, JSON.stringify({ at: now.getTime() }));
    } catch {
      // storage blocked: the playlist won't know
    }
  }
  const before = loadResult(date, letters, easy);
  if (before && !(result.strokes < before.strokes || (result.strokes === before.strokes && result.hints < before.hints))) return null;
  try {
    localStorage.setItem(resultKey(date, letters, easy), JSON.stringify(result));
  } catch {
    // storage blocked: shown this visit only
  }
  return result;
}

// A first visit: How to play opens by itself (the seen-help flag, as before), and offers a sample
// puzzle on the real board, coached a tip at a time (its moves are planned in src/tutorial.ts). A
// flag kept in this browser says the sample's been played through or skipped, so it's offered by
// itself only once; How to play's card offers it again any time.

import { STEP_LIMIT } from './strokes';

const KEY = 'strokes:onboarded';

/** The sample played through, or skipped (closing the first visit's card skips it too). */
export type Onboarded = 'done' | 'skipped';

export function loadOnboarded(): Onboarded | null {
  try {
    const kept = localStorage.getItem(KEY);
    return kept === 'done' || kept === 'skipped' ? kept : null;
  } catch {
    return null;
  }
}

/** Keep how the sample went. Once played through it stays so: skipping it later doesn't undo that. */
export function saveOnboarded(how: Onboarded) {
  try {
    if (how === 'skipped' && localStorage.getItem(KEY) === 'done') return;
    localStorage.setItem(KEY, how);
  } catch {
    // storage blocked: offered again next visit
  }
}

/**
 * Whether How to play opens as a first visit's, offering the sample: it opens by itself because this
 * browser hasn't seen it (or `?help` asks for it), and the sample hasn't been played or skipped. A
 * returning player, who's seen How to play before, never gets the sample unless they ask for it.
 */
export const isFirstVisit = (seenHelp: boolean, onboarded: Onboarded | null, asked = false) => (!seenHelp || asked) && !onboarded;

// ---------- The coach ----------

/**
 * The sample's tips: the goal; the next move (the ghost hand shows it); the step's strokes; a word
 * made; out of strokes; solved.
 */
export type Tip = 'goal' | 'move' | 'dots' | 'word' | 'out' | 'done';

export interface CoachState {
  won: boolean;
  /** The step's strokes are all used, and no word made. */
  locked: boolean;
  /** Strokes used this step. */
  used: number;
  /** Any stroke made yet in the sample. */
  started: boolean;
  /** Words landed on so far, free returns too (each gets its own tip), and whether one just was (nothing done since). */
  words: number;
  landed: boolean;
  /** Tips done with: closed, timed out, or moved on from. A word's tip is `word` and its count (word1). */
  done: ReadonlySet<string>;
}

/**
 * The one tip to show now, so they never pile up: solved; else out of strokes; else the word just
 * made; else, after the first stroke, the step's strokes; else, before any, the goal; else the next move.
 */
export function coachTip(s: CoachState): Tip | null {
  if (s.won) return 'done';
  if (s.locked) return s.done.has('out') ? null : 'out';
  if (s.landed && !s.done.has(`word${s.words}`)) return 'word';
  if (s.used > 0 && !s.done.has('dots')) return 'dots';
  if (!s.started && !s.done.has('goal')) return 'goal';
  return 'move';
}

/** How long a tip waits, left alone, before the coach moves on to the next move (ms): a quarter quicker than at first (4, 6 and 5 s). */
export const TIP_TIME: Partial<Record<Tip, number>> = { goal: 3000, dots: 4500, word: 3750 };

/** What a tip says (the next move's line comes from the plan: see sayMove). */
export function tipText(tip: Exclude<Tip, 'move'>, { start, goal, word = '', cost = 0, back = false }: { start: string; goal: string; word?: string; cost?: number; back?: boolean }): string {
  if (tip === 'goal') return `Goal: turn ${start} into ${goal}.`;
  if (tip === 'dots') return `A step can use up to ${STEP_LIMIT} strokes. Make a real word to finish it.`;
  if (tip === 'word') return back ? `Back in ${word}: free, you've been here before. Now on to ${goal}.` : `${word}: a real word! That step cost ${cost}. Now on to ${goal}.`;
  if (tip === 'out') return 'Out of strokes for this step. Undo or Reset to try another way.';
  return "You've got it! Now today's puzzle.";
}

/** The move tip with nothing to show: off the route mid-step, or (rarely) a word the ghost can't lead from. */
export const strayText = (used: number, next?: string) => (used ? 'Not quite. Undo or Reset to try another way.' : next ? `Make ${next} next.` : null);

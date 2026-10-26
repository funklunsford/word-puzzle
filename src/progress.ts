// Save and resume: a daily left part-way (another puzzle opened, the page reloaded or closed) is kept
// in this browser, one game per date and difficulty, and coming back to that puzzle carries on
// exactly where it was. A win clears it, as Restart does; How to play's sample and pool puzzles keep
// none.
//
// A save is the board as it stands (Progress) and what it's of (SaveOf: the puzzle as it was begun,
// so a save that no longer fits is dropped). Storage can hold anything, so every field is checked as
// it's loaded. A new field goes in four places: `Progress` and its check in CHECKS here (with a
// default in LATER, for saves made before it), and in MazeApp, where the save is built (`progress`)
// and set back (`setGame`).

import { useCallback, useEffect, useRef } from 'react';
import { TILE_IDS, type Placement } from './glyphs';
import type { HintLevel, NextStep } from './hints';
import type { WordLength } from './letters';
import type { Difficulty } from './easycore';
import { validMoves, type Move } from './moves';
import { STEP_LIMIT } from './strokes';

/** A word reached on the way. */
export interface Visit {
  word: string;
  /** Strokes charged for reaching it (after any ink). */
  cost: number;
  /** Ink spent on that step. */
  used?: number;
  /** The word the step started from (going back is free, so it isn't always the word before it). */
  from?: string;
  /** What each of its strokes did, for the result card. */
  moves?: Move[];
}

/** The hint showing, for the word it was asked in (see src/hints.ts). */
export interface ShownHint {
  room: string;
  level: HintLevel;
  step: NextStep | null;
  meaning: string | null;
}

/** A game part-way: everything the board needs to carry on exactly where it was. */
export interface Progress {
  /** The word the player's in, and its letters as they are, part-way through a step. */
  room: string;
  cells: Placement[][];
  /** The letters before each of this step's strokes: Undo goes back through them, and there's one per stroke used. */
  history: Placement[][][];
  /** Every word visited, once each, in the order first reached, with what reaching it cost. */
  trail: Visit[];
  spent: number;
  /** Free returns to a word already visited. */
  backs: number;
  /** Free strokes banked from ink pots. */
  ink: number;
  hintsUsed: number;
  hint: ShownHint | null;
  /** Time played so far, from the first stroke (none before it). Time away doesn't count. */
  seconds: number | null;
}

/** What a save is of: where it's kept, and the puzzle as the game began it. */
export interface SaveOf {
  key: string;
  start: string;
  goal: string;
  best: number;
  /** Ink pots on: they change what each step costs. */
  inkPots: boolean;
}

/** Where a daily's game part-way is kept: one per difficulty, as Classic and Hardcore play the same dailies by different rules. */
export const progressKey = (date: string, letters: WordLength, difficulty: Difficulty) =>
  `strokes:progress${letters === 5 ? '5' : ''}${difficulty === 'easy' ? 'e' : difficulty === 'hard' ? 'h' : ''}:${date}`;

// ---------- Checking a save ----------

type Check = (v: unknown, letters: number) => boolean;
const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isCount = (v: unknown) => Number.isInteger(v) && (v as number) >= 0;
const isNumber = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
const isWord: Check = (v, letters) => typeof v === 'string' && v.length === letters && /^[A-Z]+$/.test(v);
const isLook = (v: unknown) => isRecord(v) && isNumber(v.len) && (v.keep === 'start' || v.keep === 'end') && (v.over === undefined || isNumber(v.over));
const isPlacement = (v: unknown) =>
  isRecord(v) && TILE_IDS.includes(v.tile as Placement['tile']) && isNumber(v.x) && isNumber(v.y) && (v.rot === undefined || isNumber(v.rot)) && (v.look === undefined || isLook(v.look));
const isCells: Check = (v, letters) => Array.isArray(v) && v.length === letters && v.every((cell) => Array.isArray(cell) && cell.every(isPlacement));
const isVisit: Check = (v, letters) =>
  isRecord(v) &&
  isWord(v.word, letters) &&
  isCount(v.cost) &&
  (v.used === undefined || isCount(v.used)) &&
  (v.from === undefined || isWord(v.from, letters)) &&
  (v.moves === undefined || !!validMoves(v.moves, letters));
const isStep: Check = (v, letters) =>
  isRecord(v) && isWord(v.next, letters) && isCount(v.cost) && isCount(v.remaining) && Array.isArray(v.letters) && v.letters.every((i) => isCount(i) && i < letters);
const isHint: Check = (v, letters) =>
  v === null ||
  (isRecord(v) && isWord(v.room, letters) && [1, 2, 3].includes(v.level as number) && (v.step === null || isStep(v.step, letters)) && (v.meaning === null || typeof v.meaning === 'string'));

/** Each field's check, for a puzzle of words `letters` long (every field must have one). */
const CHECKS: { [K in keyof Progress]-?: Check } = {
  room: isWord,
  cells: isCells,
  history: (v, letters) => Array.isArray(v) && v.length <= STEP_LIMIT && v.every((cells) => isCells(cells, letters)),
  trail: (v, letters) => Array.isArray(v) && v.length > 0 && v.every((visit) => isVisit(visit, letters)),
  spent: isCount,
  backs: isCount,
  ink: isCount,
  hintsUsed: isCount,
  hint: isHint,
  seconds: (v) => v === null || (isNumber(v) && (v as number) >= 0),
};

/** What a field added later is in a save made before it. */
const LATER: Partial<Progress> = {};

/**
 * A kept save, if it's sound and of this puzzle as `of` begins it (the same start, goal, lowest
 * strokes and ink pots): each field as CHECKS says, and the whole game too. It begins at the start,
 * visits each word once, the player's in one of them short of the goal, and the strokes add up.
 */
export function parseProgress(raw: unknown, of: SaveOf): Progress | null {
  if (!isRecord(raw) || raw.start !== of.start || raw.goal !== of.goal || raw.best !== of.best || raw.inkPots !== of.inkPots) return null;
  const letters = of.start.length;
  const game: Record<string, unknown> = {};
  for (const field of Object.keys(CHECKS) as (keyof Progress)[]) {
    const v = field in raw ? raw[field] : LATER[field];
    if (!CHECKS[field](v, letters)) return null;
    game[field] = v;
  }
  const p = game as unknown as Progress;
  const words = p.trail.map((v) => v.word);
  if (words[0] !== of.start || new Set(words).size !== words.length || !words.includes(p.room) || p.room === of.goal) return null;
  if (p.spent !== p.trail.reduce((sum, v) => sum + v.cost, 0)) return null;
  return p;
}

// ---------- Keeping it ----------

/** The game kept for `of`, if there's a sound one. Storage can be missing or blocked. */
export function loadProgress(of: SaveOf): Progress | null {
  try {
    return parseProgress(JSON.parse(localStorage.getItem(of.key) ?? 'null'), of);
  } catch {
    return null;
  }
}

export function saveProgress(of: SaveOf, p: Progress) {
  const { key, ...puzzle } = of;
  try {
    localStorage.setItem(key, JSON.stringify({ ...puzzle, ...p }));
  } catch {
    // storage blocked or full: this visit only
  }
}

export function clearProgress(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // storage blocked: nothing kept
  }
}

/** Whether a daily has a game kept part-way: a quick look, for Past puzzles (it's checked in full when it's played). */
export function hasProgress(key: string): boolean {
  try {
    const kept = JSON.parse(localStorage.getItem(key) ?? 'null');
    return isRecord(kept) && Array.isArray(kept.trail);
  } catch {
    return false;
  }
}

/**
 * Keeps the game being played (`of`) as it changes, or clears it when there's nothing to keep
 * (`progress` null: not started, or won); and again when the page is hidden or left, so the time
 * played (`seconds`, read then) is up to date. The function returned keeps it at once, for leaving
 * it for another puzzle.
 */
export function useKeptProgress(of: SaveOf | null, progress: Omit<Progress, 'seconds'> | null, seconds: () => number | null) {
  const latest = useRef({ of, progress, seconds });
  latest.current = { of, progress, seconds };
  const keep = useCallback(() => {
    const { of, progress, seconds } = latest.current;
    if (!of) return;
    if (progress) saveProgress(of, { ...progress, seconds: seconds() });
    else clearProgress(of.key);
  }, []);
  useEffect(keep, [of, progress, keep]);
  useEffect(() => {
    const hidden = () => document.visibilityState === 'hidden' && keep();
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('pagehide', keep);
    return () => {
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('pagehide', keep);
    };
  }, [keep]);
  return keep;
}

import { LETTERS, recipe, type TileId } from './glyphs';

export const MIN_LENGTH = 4;
export const PANGRAM_BONUS = 25;

export interface Board {
  id: string;
  tiles: TileId[];
  center: TileId;
  spicy: TileId;
  pangrams: string[];
  /** Non-center tiles that only ever appear alongside another one ("T>O"), from the generator. */
  tied?: string[];
  /** Every valid word for this board (already filtered to use the center tile). */
  words: string[];
}

export interface Play {
  word: string;
  score: number;
  base: number;
  spicy: boolean;
  pangram: boolean;
}

export interface GameState {
  spicy: TileId | null;
  plays: Play[];
  score: number;
}

export function tilesFor(word: string): Set<TileId> {
  const tiles = new Set<TileId>();
  for (const ch of word) for (const t of recipe(ch).keys()) tiles.add(t);
  return tiles;
}

export function strokeCount(word: string): number {
  return [...word].reduce((n, ch) => n + LETTERS[ch].parts.length, 0);
}

export function playableLetters(tiles: Iterable<TileId>): Set<string> {
  const have = new Set(tiles);
  return new Set(Object.keys(LETTERS).filter((ch) => [...recipe(ch).keys()].every((t) => have.has(t))));
}

export function newGame(board: Board): GameState {
  return { spicy: board.spicy, plays: [], score: 0 };
}

export type Check = { ok: true; tiles: Set<TileId> } | { ok: false; reason: string };

export function check(state: GameState, board: Board, word: string): Check {
  const playable = playableLetters(board.tiles);
  for (const ch of word) if (!playable.has(ch)) return { ok: false, reason: `${ch} can't be built from these strokes` };
  if (word.length < MIN_LENGTH) return { ok: false, reason: `At least ${MIN_LENGTH} letters` };
  const tiles = tilesFor(word);
  if (!tiles.has(board.center)) return { ok: false, reason: 'Must use the gold tile' };
  if (state.plays.some((p) => p.word === word)) return { ok: false, reason: 'Already found' };
  if (!board.words.includes(word)) return { ok: false, reason: 'Not in word list' };
  return { ok: true, tiles };
}

function nextSpicy(board: Board, current: TileId | null): TileId | null {
  const pool = board.tiles.filter((t) => t !== board.center);
  if (!pool.length) return null;
  const start = current ? pool.indexOf(current) : -1;
  return pool[(start + 1) % pool.length];
}

export function play(state: GameState, board: Board, word: string): { state: GameState; play: Play } | { error: string } {
  const c = check(state, board, word);
  if (!c.ok) return { error: c.reason };

  const base = strokeCount(word);
  const spicy = state.spicy !== null && c.tiles.has(state.spicy);
  const pangram = board.tiles.every((t) => c.tiles.has(t));
  let score = base;
  if (spicy) score *= 2;
  if (pangram) score += PANGRAM_BONUS;

  const result: Play = { word, score, base, spicy, pangram };
  return {
    play: result,
    state: {
      spicy: nextSpicy(board, state.spicy),
      plays: [...state.plays, result],
      score: state.score + score,
    },
  };
}

/** Words not found yet. */
export function remainingWords(state: GameState, board: Board): string[] {
  const found = new Set(state.plays.map((p) => p.word));
  return board.words.filter((w) => !found.has(w));
}

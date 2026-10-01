import { LETTERS, recipe, type TileId } from './glyphs';

export const CHARGES = 5;
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
  smushed: TileId[];
  pangram: boolean;
}

export interface GameState {
  maxCharges: number;
  charges: Partial<Record<TileId, number>>;
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

export function newGame(board: Board, startCharges = CHARGES): GameState {
  const charges: GameState['charges'] = {};
  for (const t of board.tiles) if (t !== board.center) charges[t] = startCharges;
  return { maxCharges: startCharges, charges, spicy: board.spicy, plays: [], score: 0 };
}

export function chargesLeft(state: GameState, board: Board, tile: TileId): number {
  return tile === board.center ? Infinity : (state.charges[tile] ?? 0);
}

export type Check = { ok: true; tiles: Set<TileId> } | { ok: false; reason: string };

/** Problems that are visible while the word is still being typed. */
export function checkPartial(state: GameState, board: Board, word: string): string | null {
  const playable = playableLetters(board.tiles);
  for (const ch of word) if (!playable.has(ch)) return `${ch} can't be built from these strokes`;
  for (const t of tilesFor(word)) if (chargesLeft(state, board, t) <= 0) return 'Uses a tile that is smushed';
  return null;
}

export function check(state: GameState, board: Board, word: string): Check {
  const partial = checkPartial(state, board, word);
  if (partial) return { ok: false, reason: partial };
  if (word.length < MIN_LENGTH) return { ok: false, reason: `At least ${MIN_LENGTH} letters` };
  const tiles = tilesFor(word);
  if (!tiles.has(board.center)) return { ok: false, reason: 'Must use the gold tile' };
  if (state.plays.some((p) => p.word === word)) return { ok: false, reason: 'Already found' };
  if (!board.words.includes(word)) return { ok: false, reason: 'Not in word list' };
  return { ok: true, tiles };
}

function nextSpicy(board: Board, charges: GameState['charges'], current: TileId | null): TileId | null {
  const pool = board.tiles.filter((t) => t !== board.center);
  const start = current ? pool.indexOf(current) : -1;
  for (let i = 1; i <= pool.length; i++) {
    const t = pool[(start + i) % pool.length];
    if ((charges[t] ?? 0) > 0) return t;
  }
  return null;
}

export function play(state: GameState, board: Board, word: string): { state: GameState; play: Play } | { error: string } {
  const c = check(state, board, word);
  if (!c.ok) return { error: c.reason };

  const charges = { ...state.charges };
  const smushed: TileId[] = [];
  for (const t of c.tiles) {
    if (t === board.center) continue;
    charges[t] = (charges[t] ?? 0) - 1;
    if (charges[t] === 0) smushed.push(t);
  }

  const base = strokeCount(word);
  const spicy = state.spicy !== null && c.tiles.has(state.spicy);
  const pangram = board.tiles.every((t) => c.tiles.has(t));
  let score = base;
  if (spicy) score *= 2;
  if (smushed.length) score *= 2;
  if (pangram) score += PANGRAM_BONUS;

  const result: Play = { word, score, base, spicy, smushed, pangram };
  return {
    play: result,
    state: {
      ...state,
      charges,
      spicy: nextSpicy(board, charges, state.spicy),
      plays: [...state.plays, result],
      score: state.score + score,
    },
  };
}

/** Words that could still be played given current charges. */
export function remainingWords(state: GameState, board: Board): string[] {
  const found = new Set(state.plays.map((p) => p.word));
  return board.words.filter(
    (w) => !found.has(w) && [...tilesFor(w)].every((t) => chargesLeft(state, board, t) > 0),
  );
}

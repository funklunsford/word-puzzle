// How to play's moves (see HowToShow and HowToTry): a word step, CRUMB → GRUMP, shown and then
// tried, and a turn to try. Kept apart from the components so a test can check every move can still
// be done with the game's rules.

import { LETTERS, TRAY_TURN, type Placement, type TileId } from './glyphs';
import { STEP_LIMIT, recognize, slotKey, slotsFor } from './strokes';

export type Say = { touch: string; mouse: string };

/** A move to show: carry a stroke (from the tray, or from its spot) to a spot; turn one on its spot; or remove one. */
export type Ghost =
  | { kind: 'carry'; tile: TileId; from: Placement | 'tray'; to: Placement }
  | { kind: 'turn'; at: Placement }
  | { kind: 'remove'; at: Placement };

/** A move in a word: which letter it's in (from the left), and the move there. */
export interface WordMove {
  cell: number;
  ghost: Ghost;
}

export interface Step {
  /** The word to start from (a letter, for the turn), and the one to make. */
  start: string;
  goal: string;
  /** Said once the goal is made. */
  done: string;
  /** Said once the letters have gone another way, or can't make the goal in a step's strokes. */
  stray: string;
  /** What to do next, and the move to show, from the letters as they are with `used` strokes spent (null: off the track). */
  next: (cells: Placement[][], used: number) => { say: Say; move: WordMove } | null;
}

/** The practice's tray: a long bar, a bar, a chevron and an arc (the bar is the one the steps use). */
export const TRAY: readonly TileId[] = ['LV', 'H', 'BV', 'C'];

/** A word's letters as strokes, as the game lays them out. */
export const wordCells = (word: string): Placement[][] => [...word].map((ch) => LETTERS[ch].parts.map((p) => ({ ...p })));

/** The word the letters make (or don't: a letter that isn't one is left out). */
export const spell = (cells: Placement[][]) => cells.map((c) => recognize(c) ?? '?').join('');

const same = (say: string): Say => ({ touch: say, mouse: say });
/** Where to drop `tile` in `content` to make `goal` (if one drop does it). */
const spotFor = (content: Placement[], tile: TileId, goal: string) => slotsFor(content, tile).find((s) => recognize([...content, s.placement]) === goal)?.placement;
/** A lone stroke turned round from how it sits in its letter (V upside down, C facing right). */
const isTurned = (content: Placement[], tile: TileId) => content.length === 1 && content[0].tile === tile && (content[0].rot ?? 0) === 180;

/** The cell after a move is done as shown. */
export function applyGhost(content: Placement[], g: Ghost): Placement[] {
  if (g.kind === 'carry') return [...content.filter((p) => p !== g.from), g.to];
  if (g.kind === 'turn') return content.map((p) => (p === g.at ? { ...p, rot: ((p.rot ?? 0) + 180) % 360 } : p));
  return content.filter((p) => p !== g.at);
}

/** The word after a move is done as shown. */
export const applyMove = (cells: Placement[][], m: WordMove) => cells.map((c, i) => (i === m.cell ? applyGhost(c, m.ghost) : c));

// ---------- Planning a move ----------
// The ghost shows the first move of a shortest way to a letter, worked out with the editor's own
// rules: a stroke goes only where it grows towards a letter.

const norm = (r = 0) => ((r % 360) + 360) % 360;
const keyOf = (content: Placement[]) => content.map((p) => slotKey(p)).sort().join(' ');

/**
 * Where a stroke from the tray lands, as the editor puts it there: on a spot that takes it only one
 * way it turns to fit as it arrives (the bar stands up as G's chin); on a spot that takes it several
 * ways it lands the way it sits in the tray (anything else is placed, then turned).
 */
export function trayDrops(content: Placement[], tile: TileId): Placement[] {
  const slots = slotsFor(content, tile).map((s) => s.placement);
  const ways = (q: Placement) => slots.filter((s) => s.x === q.x && s.y === q.y).length;
  return slots.filter((q) => ways(q) === 1 || norm(q.rot) === norm(TRAY_TURN[tile]));
}

/** Every move the editor allows from `content`, with the tray's strokes as they sit in it. */
function movesFrom(content: Placement[], tray: readonly TileId[]): Ghost[] {
  const out: Ghost[] = [];
  for (const p of content) {
    out.push({ kind: 'remove', at: p });
    const rest = content.filter((q) => q !== p);
    const slots = slotsFor(rest, p.tile).map((s) => s.placement);
    // Turned on its spot (a stroke alone in its cell keeps its own x; see the editor's turnedInPlace).
    const alone = content.length === 1;
    if (slots.some((q) => (alone || q.x === p.x) && q.y === p.y && norm(q.rot) === norm((p.rot ?? 0) + 180))) out.push({ kind: 'turn', at: p });
    for (const to of slots) if (slotKey(to) !== slotKey(p)) out.push({ kind: 'carry', tile: p.tile, from: p, to });
  }
  for (const tile of tray) for (const to of trayDrops(content, tile)) out.push({ kind: 'carry', tile, from: 'tray', to });
  return out;
}

/**
 * Breadth first from `content`, up to `depth` moves: for each letter reached, the first move of a
 * shortest way to it, and how many moves that way takes.
 */
function reachable(content: Placement[], tray: readonly TileId[], depth: number): Map<string, { first: Ghost; moves: number }> {
  const found = new Map<string, { first: Ghost; moves: number }>();
  const seen = new Set([keyOf(content)]);
  let frontier: { content: Placement[]; first: Ghost | null }[] = [{ content, first: null }];
  for (let d = 1; d <= depth; d++) {
    const next: typeof frontier = [];
    for (const f of frontier)
      for (const g of movesFrom(f.content, tray)) {
        const after = applyGhost(f.content, g);
        const k = keyOf(after);
        if (seen.has(k)) continue;
        seen.add(k);
        const first = f.first ?? g;
        const ch = recognize(after);
        if (ch && !found.has(ch)) found.set(ch, { first, moves: d });
        next.push({ content: after, first });
      }
    frontier = next;
  }
  return found;
}

/** The first move of a shortest way from `content` to the letter `goal` (within a step's strokes), or null. */
export function planTo(content: Placement[], goal: string, tray: readonly TileId[]): Ghost | null {
  if (recognize(content) === goal) return null;
  return reachable(content, tray, STEP_LIMIT).get(goal)?.first ?? null;
}

/**
 * The way from `cells` to the word `goal`: the first move (in the leftmost letter still to change)
 * and the strokes it takes in all. Each letter is made on its own: no stroke is carried from one
 * letter to another, which the word step here doesn't need. Null if a letter can't be made in a step.
 */
export function planWord(cells: Placement[][], goal: string, tray: readonly TileId[]): { move: WordMove | null; left: number } | null {
  let move: WordMove | null = null;
  let left = 0;
  for (let i = 0; i < cells.length; i++) {
    if (recognize(cells[i]) === goal[i]) continue;
    const way = reachable(cells[i], tray, STEP_LIMIT).get(goal[i]);
    if (!way) return null;
    move ??= { cell: i, ghost: way.first };
    left += way.moves;
  }
  return { move, left };
}

/** "an R", "a B": the letter's name, as said aloud. */
export const withArticle = (letter: string) => `${'AEFHILMNORSX'.includes(letter) ? 'an' : 'a'} ${letter}`;

/** What to say for a move towards `goal` (every stroke is just a stroke: the ghost shows which). */
export function sayMove(g: Ghost, goal: string): Say {
  const make = `Make ${withArticle(goal)}:`;
  if (g.kind === 'carry') return same(g.from === 'tray' ? `${make} drag the stroke shown in from the tray.` : `${make} drag the stroke shown to its new spot.`);
  // (A mouse swipes the stroke the way it should point, as the ghost shows; a finger double-taps it.)
  if (g.kind === 'turn') return { touch: `${make} double-tap the stroke shown to turn it.`, mouse: `${make} swipe the stroke shown to turn it.` };
  return { touch: `${make} tap the stroke shown to remove it.`, mouse: `${make} click the stroke shown to remove it.` };
}

// ---------- The steps ----------

/**
 * A whole word step, CRUMB → GRUMP (2 strokes): a bar onto the C makes G (it stands up as it lands),
 * and the B's bottom stroke comes off, leaving P. How to play shows it, then the player makes it.
 */
const WORD_STEP: Step = {
  start: 'CRUMB',
  goal: 'GRUMP',
  done: "That's GRUMP: a real word. Every step works like that.",
  stray: `Not quite: that won't make GRUMP in ${STEP_LIMIT} strokes.`,
  next: (cells, used) => {
    const plan = planWord(cells, 'GRUMP', TRAY);
    if (!plan?.move || used + plan.left > STEP_LIMIT) return null;
    const { cell, ghost } = plan.move;
    // The first move, or the one left.
    const lead = plan.left > 1 ? 'Your turn: ' : 'Now ';
    const from = recognize(cells[cell]);
    if (from === 'C' && ghost.kind === 'carry') return { say: same(`${lead}drag the bar from the tray onto the C to make G.`), move: plan.move };
    if (from === 'B' && ghost.kind === 'remove')
      return { say: { touch: `${lead}tap the B's bottom stroke to remove it: B becomes P.`, mouse: `${lead}click the B's bottom stroke to remove it: B becomes P.` }, move: plan.move };
    return { say: sayMove(ghost, 'GRUMP'[cell]), move: plan.move };
  },
};

/** Turning, the least obvious move: V turned over, then a bar across it, makes A. */
const TURN_STEP: Step = {
  start: 'V',
  goal: 'A',
  done: "An A: turned over, then crossed. That's all there is to it!",
  stray: 'Not quite.',
  next: ([c]) => {
    if (recognize(c) === 'V')
      return { say: { touch: 'Now a turn: double-tap the V to turn it over.', mouse: 'Now a turn: swipe the V up to turn it over.' }, move: { cell: 0, ghost: { kind: 'turn', at: c[0] } } };
    const to = isTurned(c, 'BV') ? spotFor(c, 'H', 'A') : undefined;
    return to ? { say: same('Now drag a bar across it to make A.'), move: { cell: 0, ghost: { kind: 'carry', tile: 'H', from: 'tray', to } } } : null;
  },
};

/** The practice: the word step, then a turn. */
export const TUTORIAL: Step[] = [WORD_STEP, TURN_STEP];

/** A step's moves as the practice plans them from its start, each with the letters before and after (the demo plays these). */
export function stepMoves(step: Step): { move: WordMove; before: Placement[][]; after: Placement[][] }[] {
  const out: { move: WordMove; before: Placement[][]; after: Placement[][] }[] = [];
  let cells = wordCells(step.start);
  for (let used = 0; spell(cells) !== step.goal && used < STEP_LIMIT; used++) {
    const plan = step.next(cells, used);
    if (!plan) break;
    const after = applyMove(cells, plan.move);
    out.push({ move: plan.move, before: cells, after });
    cells = after;
  }
  return out;
}

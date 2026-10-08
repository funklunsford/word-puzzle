// How to play's practice moves (see HowToTry): five letters to make, each teaching a move. Kept
// apart from the component so a test can check every step can still be done with the game's rules.

import { TILES, TRAY_TURN, type Placement, type TileId } from './glyphs';
import { STEP_LIMIT, recognize, slotKey, slotsFor } from './strokes';

export type Say = { touch: string; mouse: string };

/** A move to show: carry a stroke (from the tray, or from its spot) to a spot; turn one on its spot; or remove one. */
export type Ghost =
  | { kind: 'carry'; tile: TileId; from: Placement | 'tray'; to: Placement }
  | { kind: 'turn'; at: Placement }
  | { kind: 'remove'; at: Placement };

export interface Step {
  start: string;
  goal: string;
  /** Said once the goal letter is made. */
  done: string;
  /** What to do next, and the move to show, from the cell as it is (null: off the track). */
  next: (content: Placement[]) => { say: Say; ghost: Ghost } | null;
}

const same = (say: string): Say => ({ touch: say, mouse: say });
/** Where to drop `tile` in `content` to make `goal` (if one drop does it). */
const spotFor = (content: Placement[], tile: TileId, goal: string) => slotsFor(content, tile).find((s) => recognize([...content, s.placement]) === goal)?.placement;
/** A lone stroke turned round from how it sits in its letter (V upside down, C facing right). */
const isTurned = (content: Placement[], tile: TileId) => content.length === 1 && content[0].tile === tile && (content[0].rot ?? 0) === 180;

/** Add a stroke, move one, turn a V and a C (then add to each), remove one. A step that starts from the last one's letter carries on with it. */
export const TUTORIAL: Step[] = [
  {
    start: 'I',
    goal: 'T',
    done: "That's a T.",
    next: (c) => {
      const to = recognize(c) === 'I' ? spotFor(c, 'H', 'T') : undefined;
      return to ? { say: same('Drag the bar from the tray onto the top of the I to make T.'), ghost: { kind: 'carry', tile: 'H', from: 'tray', to } } : null;
    },
  },
  {
    start: 'T',
    goal: 'L',
    done: 'Now it’s an L.',
    next: (c) => {
      const bar = recognize(c) === 'T' ? c.find((p) => p.tile === 'H') : undefined;
      const to = bar && spotFor(c.filter((p) => p !== bar), 'H', 'L');
      return bar && to ? { say: same('Drag that bar down to the foot: T becomes L.'), ghost: { kind: 'carry', tile: 'H', from: bar, to } } : null;
    },
  },
  {
    start: 'V',
    goal: 'A',
    done: 'An A: turned over, then crossed.',
    next: (c) => {
      if (recognize(c) === 'V')
        return { say: { touch: 'Double-tap the V to turn it over.', mouse: 'Double-click the V to turn it over.' }, ghost: { kind: 'turn', at: c[0] } };
      const to = isTurned(c, 'BV') ? spotFor(c, 'H', 'A') : undefined;
      return to ? { say: same('Now drag a bar across it to make A.'), ghost: { kind: 'carry', tile: 'H', from: 'tray', to } } : null;
    },
  },
  {
    start: 'C',
    goal: 'D',
    done: 'A D: turned around, then a long bar.',
    next: (c) => {
      if (recognize(c) === 'C')
        return { say: { touch: 'Double-tap the C to turn it around.', mouse: 'Double-click the C to turn it around.' }, ghost: { kind: 'turn', at: c[0] } };
      const to = isTurned(c, 'C') ? spotFor(c, 'LV', 'D') : undefined;
      return to ? { say: same('Now drag a long bar onto its left side to make D.'), ghost: { kind: 'carry', tile: 'LV', from: 'tray', to } } : null;
    },
  },
  {
    start: 'E',
    goal: 'F',
    done: "F. That's all there is to it!",
    next: (c) => {
      const bars = recognize(c) === 'E' ? c.filter((p) => p.tile === 'H') : [];
      const at = bars.reduce<Placement | undefined>((low, p) => (!low || p.y > low.y ? p : low), undefined);
      return at
        ? { say: { touch: 'Tap the bottom bar to remove it: E becomes F.', mouse: 'Click the bottom bar to remove it: E becomes F.' }, ghost: { kind: 'remove', at } }
        : null;
    },
  },
];

/** The cell after a move is done as shown. */
export function applyGhost(content: Placement[], g: Ghost): Placement[] {
  if (g.kind === 'carry') return [...content.filter((p) => p !== g.from), g.to];
  if (g.kind === 'turn') return content.map((p) => (p === g.at ? { ...p, rot: ((p.rot ?? 0) + 180) % 360 } : p));
  return content.filter((p) => p !== g.at);
}

// ---------- More practice ----------
// After the five moves, How to play offers more letters: from the letter just made to another a move
// or two away, with the ghost showing the first move of a shortest way there (worked out with the
// editor's own rules: a stroke goes only where it grows towards a letter).

const norm = (r = 0) => ((r % 360) + 360) % 360;
const keyOf = (content: Placement[]) => content.map((p) => slotKey(p)).sort().join(' ');

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
  // From the tray, only the way the stroke sits there: anything else is placed, then turned.
  for (const tile of tray)
    for (const s of slotsFor(content, tile)) if (norm(s.placement.rot) === norm(TRAY_TURN[tile])) out.push({ kind: 'carry', tile, from: 'tray', to: s.placement });
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

/** Letters a move or two from `content` (not the one it is), for the next practice letter. */
export function practiceGoals(content: Placement[], tray: readonly TileId[]): string[] {
  const here = recognize(content);
  return [...reachable(content, tray, 2)].filter(([ch]) => ch !== here).map(([ch]) => ch);
}

const name = (tile: TileId) => TILES[tile].name.toLowerCase();
/** "an R", "a B": the letter's name, as said aloud. */
export const withArticle = (letter: string) => `${'AEFHILMNORSX'.includes(letter) ? 'an' : 'a'} ${letter}`;

/** What to say for a move towards `goal`. */
export function sayMove(g: Ghost, goal: string): Say {
  const make = `Make ${withArticle(goal)}:`;
  if (g.kind === 'carry')
    return same(g.from === 'tray' ? `${make} drag the ${name(g.tile)} in from the tray.` : `${make} drag the ${name(g.tile)} to its new spot.`);
  if (g.kind === 'turn') return { touch: `${make} double-tap the ${name(g.at.tile)} to turn it.`, mouse: `${make} double-click the ${name(g.at.tile)} to turn it.` };
  return { touch: `${make} tap the ${name(g.at.tile)} to remove it.`, mouse: `${make} click the ${name(g.at.tile)} to remove it.` };
}

/** A practice step: from `start` (the letter just made) to `goal`, guided move by move. */
export function practiceStep(start: string, goal: string, tray: readonly TileId[]): Step {
  return {
    start,
    goal,
    done: `That's ${withArticle(goal)}.`,
    next: (c) => {
      const g = planTo(c, goal, tray);
      return g ? { say: sayMove(g, goal), ghost: g } : null;
    },
  };
}

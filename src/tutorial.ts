// How to play's sample puzzle (see HowToCard, and the coach in MazeApp): its words, and the moves the
// coach's ghost hand shows, planned with the editor's own rules. Kept apart from the components so a
// test can check every move can still be made, and that the sample's route is still the lowest.

import { LETTERS, TILE_IDS, TRAY_TURN, type Placement, type TileId } from './glyphs';
import { EMPTY_CELL_X, STEP_LIMIT, editsLeft, recognize, slotKey, slotsFor } from './strokes';
import { restingTurn } from './turns';

/**
 * The sample puzzle: everyday words, 2 steps and 5 strokes at the lowest. A bar onto the C and a curve
 * onto the I make JUDGE; then the J's curve comes off and two bars go on, for FUDGE. It's no daily's:
 * no daily or pool puzzle has either of its steps (a test checks), and it has no other lowest route.
 */
export const SAMPLE = { start: 'JUICE', goal: 'FUDGE', best: 5, path: ['JUICE', 'JUDGE', 'FUDGE'] };

/** A move to show: carry a stroke (from the tray, or from its spot) to a spot; turn one on its spot; or remove one. */
export type Ghost =
  | { kind: 'carry'; tile: TileId; from: Placement | 'tray'; to: Placement }
  | { kind: 'turn'; at: Placement; to: Placement }
  | { kind: 'remove'; at: Placement };

/** A move in a word: the letter it's in (from the left), and the move there. A stroke carried from another letter says which (`from`). */
export interface WordMove {
  cell: number;
  from?: number;
  ghost: Ghost;
}

/** A word's letters as strokes, as the game lays them out. */
export const wordCells = (word: string): Placement[][] => [...word].map((ch) => LETTERS[ch].parts.map((p) => ({ ...p })));

/** The word the letters spell, or null while one of them isn't a letter. */
export function spell(cells: Placement[][]): string | null {
  const letters = cells.map(recognize);
  return letters.every(Boolean) ? letters.join('') : null;
}

const norm = (r = 0) => ((r % 360) + 360) % 360;
const same = (a: Placement, b: Placement) => slotKey(a) === slotKey(b);
const without = (content: Placement[], p: Placement) => {
  const i = content.findIndex((q) => same(q, p));
  return i < 0 ? content : [...content.slice(0, i), ...content.slice(i + 1)];
};

/** The letters after a move is made as shown (as the editor makes it: a turned stroke keeps its place in its letter, a placed one goes last). */
export function applyMove(cells: Placement[][], m: WordMove): Placement[][] {
  const g = m.ghost;
  return cells.map((c, i) => {
    if (g.kind === 'remove') return i === m.cell ? without(c, g.at) : c;
    if (g.kind === 'turn') return i === m.cell ? c.map((q) => (same(q, g.at) ? g.to : q)) : c;
    let next = g.from !== 'tray' && i === (m.from ?? m.cell) ? without(c, g.from) : c;
    if (i === m.cell) next = [...next, g.to];
    return next;
  });
}

/** One placement per spot: the only way round it fits there, or the way `settle` picks from several. */
function landings(slots: Placement[], settle: (ways: number[]) => number): Placement[] {
  const spots = new Map<string, Placement[]>();
  for (const q of slots) spots.set(`${q.x},${q.y}`, [...(spots.get(`${q.x},${q.y}`) ?? []), q]);
  return [...spots.values()].map((ways) => {
    if (ways.length === 1) return ways[0];
    const way = settle(ways.map((q) => q.rot ?? 0));
    return ways.find((q) => norm(q.rot) === norm(way))!;
  });
}

/**
 * Where a stroke from the tray lands on each spot of `content`, as the editor puts it there: turned
 * to fit a spot that takes it only one way (a bar stands up as G's chin, the big curve turns round
 * for D), and on a spot that takes it several ways, the way it sits in the tray (see restingTurn).
 */
export const trayLands = (content: Placement[], tile: TileId): Placement[] =>
  landings(
    slotsFor(content, tile).map((s) => s.placement),
    (ways) => restingTurn({ ways, held: TRAY_TURN[tile], tile, fromLetter: false, intoEmpty: !content.length }),
  );

/** Shown first when moves tie: a remove, then a stroke from the tray (bars first), a carry, a turn; then the leftmost letter. */
const rank = (m: WordMove) =>
  m.ghost.kind === 'remove' ? 0 : m.ghost.kind === 'turn' ? 3 : m.ghost.from !== 'tray' ? 2 : m.ghost.tile === 'H' || m.ghost.tile === 'LV' ? 1 : 1.5;

/**
 * Every move the editor allows in the letters `letters` (indexes into `cells`), each landing the way
 * the editor lands it with no swipe: under a finger (`touch`), a stroke carried into an empty letter
 * lands the way the tray starts it (see restingTurn); a mouse's lands the way it's held.
 */
function movesIn(cells: Placement[][], letters: number[], touch: boolean): WordMove[] {
  const out: WordMove[] = [];
  for (const c of letters) {
    const content = cells[c];
    for (const p of content) {
      out.push({ cell: c, ghost: { kind: 'remove', at: p } });
      const rest = without(content, p);
      // Its own letter's spots: a stroke alone in its letter is offered them at its own x (see the editor's start).
      const dx = rest.length ? 0 : p.x - EMPTY_CELL_X;
      const own = slotsFor(rest, p.tile).map((s) => ({ ...s.placement, x: Math.round((s.placement.x + dx) * 100) / 100 }));
      // Turned on its spot, to the next way round that fits there (see the editor's turnedInPlace): shown only as a half turn.
      const turns = own
        .filter((q) => q.x === p.x && q.y === p.y && norm(q.rot) !== norm(p.rot))
        .sort((a, b) => norm(norm(a.rot) - norm(p.rot)) - norm(norm(b.rot) - norm(p.rot)));
      if (turns[0] && norm(turns[0].rot) === norm((p.rot ?? 0) + 180)) out.push({ cell: c, ghost: { kind: 'turn', at: p, to: turns[0] } });
      // Moved within its letter (not one alone in it: every spot there is its own spot, shifted).
      const held = (fromLetter: boolean, intoEmpty: boolean) => (ways: number[]) => restingTurn({ ways, held: p.rot ?? 0, tile: p.tile, fromLetter, intoEmpty });
      if (rest.length)
        for (const to of landings(own, held(false, false))) if (to.x !== p.x || to.y !== p.y) out.push({ cell: c, ghost: { kind: 'carry', tile: p.tile, from: p, to } });
      // Or into another letter that's changing.
      for (const d of letters)
        if (d !== c)
          for (const to of landings(
            slotsFor(cells[d], p.tile).map((s) => s.placement),
            held(touch, !cells[d].length),
          ))
            out.push({ cell: d, from: c, ghost: { kind: 'carry', tile: p.tile, from: p, to } });
    }
    for (const tile of TILE_IDS) for (const to of trayLands(content, tile)) out.push({ cell: c, ghost: { kind: 'carry', tile, from: 'tray', to } });
  }
  return out.sort((a, b) => rank(a) - rank(b) || a.cell - b.cell);
}

/**
 * The fewest moves the editor needs from `cells` to the word `target`, within `budget` strokes, or
 * null. Only the letters that differ change. A word on the way would end the step there (`stops`
 * says which words do: real ones, and the word the step began on, which takes the step back), so
 * none is allowed. Searched a stroke deeper at a time, cut short where even the strokes the letters
 * lack can't make it.
 */
export function planStep(cells: Placement[][], target: string, budget: number, { touch, stops }: { touch: boolean; stops: (word: string) => boolean }): WordMove[] | null {
  const letters = cells.map((_, i) => i).filter((i) => recognize(cells[i]) !== target[i]);
  if (!letters.length) return [];
  const goal = letters.map((i) => target[i]);
  const left = (cs: Placement[][]) => editsLeft(letters.map((i) => cs[i]), goal);
  for (let depth = Math.max(1, left(cells)); depth <= budget; depth++) {
    const seen = new Set<string>();
    const search = (cs: Placement[][], d: number): WordMove[] | null => {
      if (letters.every((i) => recognize(cs[i]) === target[i])) return [];
      if (d === 0 || left(cs) > d) return null;
      const key = `${d}|${letters.map((i) => cs[i].map((p) => slotKey(p)).sort().join(' ')).join('/')}`;
      if (seen.has(key)) return null;
      seen.add(key);
      for (const m of movesIn(cs, letters, touch)) {
        const next = applyMove(cs, m);
        const word = spell(next);
        if (word && word !== target && stops(word)) continue;
        const rest = search(next, d - 1);
        if (rest) return [m, ...rest];
      }
      return null;
    };
    const plan = search(cells, depth);
    if (plan) return plan;
  }
  return null;
}

/**
 * The coach's next move from the letters as they are, with `used` of the step's strokes gone: towards
 * the first of `targets` (the sample's next word, then any other on a lowest remaining route) it can
 * still make in the strokes left. Null when none can be made from here.
 */
export function coachPlan(cells: Placement[][], targets: string[], used: number, opts: { touch: boolean; stops: (word: string) => boolean }) {
  for (const target of targets) {
    const moves = planStep(cells, target, STEP_LIMIT - used, opts);
    if (moves?.length) return { target, moves };
  }
  return null;
}

// ---------- What the coach says ----------

const ORDINALS = ['1st', '2nd', '3rd', '4th', '5th'];
/** The tray's strokes by their look (in a letter, a curve or a V is just that: see NAMES). */
const TRAY_NAMES: Record<TileId, string> = { LV: 'long bar', H: 'bar', LD: 'slash', LB: 'backslash', SB: 'tail', BV: 'V', SC: 'small V', C: 'big curve', P: 'small curve' };
const NAMES: Record<TileId, string> = { ...TRAY_NAMES, SC: 'V', C: 'curve', P: 'curve' };

/** "the C", or "the 2nd letter" where it isn't a letter yet, or its letter is in the word twice. */
function letterRef(cells: Placement[][], cell: number) {
  const ch = recognize(cells[cell]);
  return ch && cells.filter((c) => recognize(c) === ch).length === 1 ? `the ${ch}` : `the ${ORDINALS[cell]} letter`;
}

/** "the J's curve", "the E's bottom bar": a stroke in a letter, placed by where it is when the letter has two of its kind. */
function strokeRef(cells: Placement[][], cell: number, p: Placement) {
  const owner = letterRef(cells, cell);
  const kind = cells[cell].filter((q) => NAMES[q.tile] === NAMES[p.tile]);
  let where = '';
  if (kind.length > 1) {
    const ys = [...new Set(kind.map((q) => q.y))].sort((a, b) => a - b);
    if (ys.length === kind.length) where = p.y === ys[0] ? 'top ' : p.y === ys[ys.length - 1] ? 'bottom ' : 'middle ';
    else where = p.x <= Math.min(...kind.map((q) => q.x)) ? 'left ' : 'right ';
  }
  return `${owner}'s ${where}${NAMES[p.tile]}`;
}

/** What to do for a move, in a line: "Drag the bar from the tray onto the C to make G." A finger taps and double-taps; a mouse clicks and swipes. */
export function sayMove(cells: Placement[][], m: WordMove, touch: boolean): string {
  const g = m.ghost;
  const made = recognize(applyMove(cells, m)[m.cell]);
  const makes = made && made !== recognize(cells[m.cell]) ? ` to make ${made}` : '';
  if (g.kind === 'remove') return `${touch ? 'Tap' : 'Click'} ${strokeRef(cells, m.cell, g.at)} to remove it.`;
  if (g.kind === 'turn') return `${touch ? 'Double-tap' : 'Swipe'} ${strokeRef(cells, m.cell, g.at)} to turn it${makes}.`;
  const onto = cells[m.cell].length ? `onto ${letterRef(cells, m.cell)}` : `into ${letterRef(cells, m.cell)}`;
  if (g.from === 'tray') return `Drag the ${TRAY_NAMES[g.tile]} from the tray ${onto}${makes}.`;
  const what = strokeRef(cells, m.from ?? m.cell, g.from);
  return m.from === undefined || m.from === m.cell ? `Drag ${what} to its new spot${makes}.` : `Drag ${what} ${onto}${makes}.`;
}

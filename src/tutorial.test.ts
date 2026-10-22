import { describe, expect, it } from 'vitest';
import maze5Json from '../public/mazes-5.json';
import { LETTERS, TRAY_TURN, type Placement } from './glyphs';
import { STEP_LIMIT, oneWayCost, recognize, slotKey, slotsFor } from './strokes';
import { TRAY, TUTORIAL, applyGhost, applyMove, planTo, sayMove, spell, stepMoves, trayDrops, wordCells, type Ghost } from './tutorial';

const fresh = (letter: string) => LETTERS[letter].parts.map((p) => ({ ...p }));
const norm = (r = 0) => ((r % 360) + 360) % 360;
const words = new Set((maze5Json as { words: string[] }).words);
const [WORD, TURN] = TUTORIAL;

/**
 * Whether the editor lets `g` be done in a letter: a stroke carried (from the tray, or from its spot)
 * lands on a spot it fits; one from the tray lands the way it sits there, unless the spot takes it only
 * one way, when it turns to fit as it arrives; a turn turns a stroke on its spot; a removal takes a
 * stroke that's there.
 */
function allowed(content: Placement[], g: Ghost): boolean {
  if (g.kind === 'remove') return content.includes(g.at);
  if (g.kind === 'turn') {
    if (!content.includes(g.at)) return false;
    const rest = content.filter((p) => p !== g.at);
    const rot = norm((g.at.rot ?? 0) + 180);
    // (A stroke alone in its letter turns where it is: the editor offers it the spots at its own x.)
    return slotsFor(rest, g.at.tile).some((s) => (!rest.length || s.placement.x === g.at.x) && s.placement.y === g.at.y && norm(s.placement.rot) === rot);
  }
  if (g.from !== 'tray' && !content.includes(g.from)) return false;
  const spots = slotsFor(g.from === 'tray' ? content : content.filter((p) => p !== g.from), g.tile).map((s) => s.placement);
  if (!spots.some((s) => slotKey(s) === slotKey(g.to))) return false;
  const ways = spots.filter((s) => s.x === g.to.x && s.y === g.to.y).length;
  return g.from !== 'tray' || ways === 1 || norm(g.to.rot) === norm(TRAY_TURN[g.tile]);
}

/** CRUMB with the B made P first (its bottom stroke taken off), on the player's own. */
function crump() {
  const crumb = wordCells('CRUMB');
  const bowl = crumb[4].find((p) => p.tile === 'P' && p.y === 1.5)!;
  return applyMove(crumb, { cell: 4, ghost: { kind: 'remove', at: bowl } });
}

/** Follow a step from `cells` by doing each move it shows, counting strokes; the letters it ends on. */
function follow(step: typeof WORD, cells: Placement[][], used = 0) {
  for (; spell(cells) !== step.goal; used++) {
    expect(used, `${step.start} → ${step.goal}`).toBeLessThan(STEP_LIMIT);
    const plan = step.next(cells, used);
    expect(plan, `${step.start} → ${step.goal}, at ${spell(cells)}`).not.toBeNull();
    expect(allowed(cells[plan!.move.cell], plan!.move.ghost), JSON.stringify(plan!.move)).toBe(true);
    cells = applyMove(cells, plan!.move);
  }
  return { cells, used };
}

describe("How to play's word step, shown and then tried", () => {
  it('goes from one real word to another', () => {
    expect(WORD.start).toBe('CRUMB');
    expect(WORD.goal).toBe('GRUMP');
    expect(words.has(WORD.start) && words.has(WORD.goal)).toBe(true);
  });

  it("shows it as the game would make it: each move one the editor allows, ending on GRUMP in the step's lowest strokes", () => {
    const moves = stepMoves(WORD);
    expect(moves.map((m) => spell(m.after))).toEqual(['GRUMB', 'GRUMP']);
    expect(moves.length).toBeLessThanOrEqual(STEP_LIMIT);
    expect(moves.length).toBe(oneWayCost('CRUMB', 'GRUMP'));
    for (const { move, before, after } of moves) {
      expect(allowed(before[move.cell], move.ghost), JSON.stringify(move)).toBe(true);
      // Only that letter changes.
      before.forEach((c, i) => i !== move.cell && expect(after[i]).toBe(c));
    }
    // The bar from the tray stands up as G's chin; then the B's bottom stroke comes off.
    expect(moves[0].move).toMatchObject({ cell: 0, ghost: { kind: 'carry', tile: 'H', from: 'tray', to: { tile: 'H', rot: 90 } } });
    expect(moves[1].move).toMatchObject({ cell: 4, ghost: { kind: 'remove', at: { tile: 'P', y: 1.5 } } });
    // Neither word on the way is one the game would stop at.
    expect(words.has('GRUMB') || words.has('CRUMP')).toBe(false);
  });

  it('is made in the practice by doing the moves it shows, either letter first', () => {
    expect(follow(WORD, wordCells('CRUMB'))).toMatchObject({ used: 2 });
    // The B made P first: the bar is shown next.
    expect(spell(crump())).toBe('CRUMP');
    expect(follow(WORD, crump(), 1)).toMatchObject({ used: 2 });
  });

  it('says each move plainly, for touch and for a mouse', () => {
    const [bar, bowl] = stepMoves(WORD);
    expect(WORD.next(bar.before, 0)!.say).toEqual({
      touch: 'Your turn: drag the bar from the tray onto the C to make G.',
      mouse: 'Your turn: drag the bar from the tray onto the C to make G.',
    });
    expect(WORD.next(bowl.before, 1)!.say).toEqual({
      touch: "Now tap the B's bottom stroke to remove it: B becomes P.",
      mouse: "Now click the B's bottom stroke to remove it: B becomes P.",
    });
    expect(WORD.next(crump(), 1)!.say.touch).toBe('Now drag the bar from the tray onto the C to make G.');
    expect(WORD.done).toBe("That's GRUMP: a real word. Every step works like that.");
  });

  it("says Not quite once the letters can't make GRUMP in the step's strokes", () => {
    const crumb = wordCells('CRUMB');
    // R's tail taken off: putting it back as well makes 4.
    const tail = crumb[1].find((p) => p.tile === 'SB')!;
    expect(WORD.next(applyMove(crumb, { cell: 1, ghost: { kind: 'remove', at: tail } }), 1)).toBeNull();
    // An arc dropped on the C makes O: taking it off again as well makes 4.
    const o = planTo(crumb[0], 'O', TRAY)!;
    expect(o).toMatchObject({ kind: 'carry', from: 'tray', tile: 'C' });
    expect(WORD.next(applyMove(crumb, { cell: 0, ghost: o }), 1)).toBeNull();
    // Out of strokes.
    expect(WORD.next(crumb, 2)).toBeNull();
    expect(WORD.stray).toBe("Not quite: that won't make GRUMP in 3 strokes.");
  });
});

describe("How to play's turn", () => {
  it('turns a V over, then crosses it to make A, as the editor allows', () => {
    expect(stepMoves(TURN).map((m) => m.move.ghost.kind)).toEqual(['turn', 'carry']);
    expect(follow(TURN, [fresh('V')])).toMatchObject({ used: 2 });
    expect(TURN.done).toBe("An A: turned over, then crossed. That's all there is to it!");
  });

  it('teaches turning with a swipe on a mouse, and a double-tap on a touch screen', () => {
    const plan = TURN.next([fresh('V')], 0)!;
    expect(plan.move.ghost.kind).toBe('turn');
    expect(plan.say).toEqual({ touch: 'Now a turn: double-tap the V to turn it over.', mouse: 'Now a turn: swipe the V up to turn it over.' });
  });

  it('shows the bar for A however the V was turned: in place, or dropped back on the empty cell’s spot', () => {
    for (const x of [1, 0.5]) {
      const turned = [{ tile: 'BV' as const, x, y: 1, rot: 180 }];
      const plan = TURN.next([turned], 1);
      expect(plan?.move.ghost.kind).toBe('carry');
      expect(recognize(applyGhost(turned, plan!.move.ghost))).toBe('A');
    }
  });

  it('says so when the letter has gone another way', () => {
    expect(TURN.next([fresh('L')], 1)).toBeNull();
    expect(TURN.next([[]], 1)).toBeNull();
  });
});

describe('planning a move', () => {
  it('drops a stroke from the tray where the editor would: turned to fit a spot that takes it one way, else as it sits in the tray', () => {
    // A bar stands up as G's chin, the only way the C takes it.
    expect(trayDrops(fresh('C'), 'H')).toEqual([{ tile: 'H', x: 1, y: 1.5, rot: 90 }]);
    expect(planTo(fresh('C'), 'G', TRAY)).toEqual({ kind: 'carry', tile: 'H', from: 'tray', to: { tile: 'H', x: 1, y: 1.5, rot: 90 } });
    // An empty letter takes the chevron as V or upside down: from the tray it's V (turned after, if need be).
    expect(trayDrops([], 'BV').map((p) => p.rot)).toEqual([0]);
    expect(planTo([], 'V', TRAY)).toMatchObject({ kind: 'carry', tile: 'BV', from: 'tray', to: { rot: 0 } });
  });

  it('says a move it plans in general terms, naming the letter to make (and every stroke just a stroke)', () => {
    expect(sayMove({ kind: 'carry', tile: 'SB', from: 'tray', to: { tile: 'SB', x: 0, y: 0 } }, 'R').mouse).toBe('Make an R: drag the stroke shown in from the tray.');
    expect(sayMove({ kind: 'remove', at: { tile: 'H', x: 0, y: 0 } }, 'B').touch).toBe('Make a B: tap the stroke shown to remove it.');
    expect(sayMove({ kind: 'turn', at: { tile: 'BV', x: 1, y: 1 } }, 'A')).toEqual({
      touch: 'Make an A: double-tap the stroke shown to turn it.',
      mouse: 'Make an A: swipe the stroke shown to turn it.',
    });
  });
});

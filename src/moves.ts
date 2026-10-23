// What each stroke of a step did, for the result card: added from the tray, removed, moved within its
// letter, carried to another letter, or turned on its spot. The editor reports only the letters after
// each stroke, so it's worked out from the letters before and after.

import type { Placement } from './glyphs';
import { slotKey } from './strokes';

export type MoveKind = 'add' | 'remove' | 'move' | 'carry' | 'turn';
/** The kinds in the order the card lists them. */
export const MOVE_KINDS: MoveKind[] = ['add', 'remove', 'move', 'carry', 'turn'];

/** A stroke's move: what it did, and the letter it was in (`at`, from the left); a carried one says where it went (`to`). */
export interface Move {
  kind: MoveKind;
  at: number;
  to?: number;
}

/** What one stroke did, from the letters before it to the letters after (null if nothing changed). */
export function moveOf(before: Placement[][], after: Placement[][]): Move | null {
  const gone: { at: number; p: Placement }[] = [];
  const came: { at: number; p: Placement }[] = [];
  // The strokes of `a` with no match in `b`, by slot (where and how turned), letter by letter.
  const unmatched = (a: Placement[][], b: Placement[][], into: { at: number; p: Placement }[]) =>
    a.forEach((cell, at) => {
      const left = (b[at] ?? []).map((p) => slotKey(p));
      for (const p of cell) {
        const i = left.indexOf(slotKey(p));
        if (i >= 0) left.splice(i, 1);
        else into.push({ at, p });
      }
    });
  unmatched(before, after, gone);
  unmatched(after, before, came);
  if (!gone.length && !came.length) return null;
  if (!gone.length) return { kind: 'add', at: came[0].at };
  if (!came.length) return { kind: 'remove', at: gone[0].at };
  // A stroke that left one slot for another: the same tile, where there's one.
  const from = gone.find((g) => came.some((c) => c.p.tile === g.p.tile)) ?? gone[0];
  const to = came.find((c) => c.p.tile === from.p.tile) ?? came[0];
  if (from.at !== to.at) return { kind: 'carry', at: from.at, to: to.at };
  const still = Math.abs(from.p.x - to.p.x) < 0.005 && Math.abs(from.p.y - to.p.y) < 0.005;
  return { kind: still ? 'turn' : 'move', at: from.at };
}

/** A step's moves, from the letters at its start through the letters after each stroke. */
export function movesOf(states: Placement[][][]): Move[] {
  const moves: Move[] = [];
  for (let i = 1; i < states.length; i++) {
    const m = moveOf(states[i - 1], states[i]);
    if (m) moves.push(m);
  }
  return moves;
}

/** Moves kept with a result, if they're sound for a word of `letters` letters (kept results can be anything). */
export function validMoves(moves: unknown, letters: number): Move[] | undefined {
  if (!Array.isArray(moves)) return undefined;
  const ok = (n: unknown) => Number.isInteger(n) && (n as number) >= 0 && (n as number) < letters;
  const valid = moves.every((m) => m && MOVE_KINDS.includes(m.kind) && ok(m.at) && (m.kind !== 'carry' || ok(m.to)));
  return valid ? (moves as Move[]) : undefined;
}

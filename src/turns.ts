// Which way a stroke lands on a spot that fits it more than one way (a chevron as V or Λ, an arc as
// C or reversed, a bowl as P's or S's top, flat or a cup), when nothing turns it as it's placed: under
// a finger, since phones don't swipe to turn (a mouse's swipe does).
//
// It lands the way it's held, except that a stroke carried out of one letter into an empty one lands
// the way the tray starts it. Held, D's arc would land reversed, and making a C from it would cost a
// double-tap more than a swipe does; this way no step between maze words costs more than with a swipe
// (the rotation plan, on branch rotation-plan, counted 22 five-letter steps and 10 pool puzzles that
// would otherwise cost a stroke more).

import { TRAY_TURN, type TileId } from './glyphs';

const norm = (deg: number) => ((deg % 360) + 360) % 360;
const apart = (a: number, b: number) => Math.abs(norm(a - b + 180) - 180);

export function restingTurn({ ways, held, tile, fromLetter, intoEmpty }: { ways: number[]; held: number; tile: TileId; fromLetter: boolean; intoEmpty: boolean }): number {
  const start = TRAY_TURN[tile];
  if (fromLetter && intoEmpty && ways.some((w) => apart(w, start) === 0)) return ways.find((w) => apart(w, start) === 0)!;
  return ways.reduce((a, b) => (apart(b, held) < apart(a, held) ? b : a));
}

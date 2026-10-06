// How to play's practice moves (see HowToTry): five letters to make, each teaching a move. Kept
// apart from the component so a test can check every step can still be done with the game's rules.

import type { Placement, TileId } from './glyphs';
import { recognize, slotsFor } from './strokes';

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

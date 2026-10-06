// Hints: the next word on a cheapest remaining route to the goal, from the word the player is in.

import { STEP_LIMIT, wordDistance } from './strokes';

export interface NextStep {
  /** The word to make next. */
  next: string;
  /** What that step costs (0 when it goes back to a visited word). */
  cost: number;
  /** Strokes still needed from here at best, that step included. */
  remaining: number;
  /** Which letters that step changes (indexes into the word). */
  letters: number[];
}

/** A word's doors: the words one step (at most STEP_LIMIT strokes) away, with each step's cost. */
export type Doors = (word: string) => [string, number][];

/** Doors worked out from the word list (each step's cost searched; see wordDistance). The game uses the maze's own, shipped with it. */
export const doorsFrom =
  (words: string[]): Doors =>
  (word) =>
    doors(word, words);

/** Words one step (at most STEP_LIMIT strokes) from `word`, with the step's cost. A cheap letter count rules most out first. */
function doors(word: string, words: string[]): [string, number][] {
  const out: [string, number][] = [];
  for (const w of words) {
    if (w === word) continue;
    let diff = 0;
    for (let k = 0; k < w.length && diff <= STEP_LIMIT; k++) if (w[k] !== word[k]) diff++;
    if (diff > STEP_LIMIT) continue;
    const c = wordDistance(word, w);
    if (c <= STEP_LIMIT) out.push([w, c]);
  }
  return out;
}

/**
 * The best next step from `room` towards `goal`. Going back to a visited word is free, as in the
 * game. Searches outward from the goal (steps cost the same both ways) until it reaches the room,
 * so it only looks at words at most as far from the goal as the room is.
 */
export function nextStep(doorsOf: Doors, room: string, goal: string, visited: Set<string>): NextStep | null {
  if (room === goal) return null;
  const enter = (w: string, c: number) => (visited.has(w) && w !== goal ? 0 : c);
  const dist = new Map<string, number>([[goal, 0]]);
  const done = new Set<string>();
  const queue: [number, string][] = [[0, goal]];
  while (queue.length) {
    // A small graph: picking the nearest from a sorted queue is quick enough.
    queue.sort((a, b) => a[0] - b[0]);
    const [d, v] = queue.shift()!;
    if (done.has(v)) continue;
    done.add(v);
    if (v === room) break;
    for (const [u, c] of doorsOf(v)) {
      if (done.has(u)) continue;
      const du = d + enter(v, c); // the player steps u → v
      if (du < (dist.get(u) ?? Infinity)) {
        dist.set(u, du);
        queue.push([du, u]);
      }
    }
  }
  const best = dist.get(room);
  if (best === undefined || !done.has(room)) return null;
  // The room's doors that lie on a cheapest route; prefer new words over going back.
  const options = doorsOf(room)
    .map(([w, c]) => ({ w, cost: enter(w, c), after: dist.get(w) }))
    .filter((o) => done.has(o.w) && o.after !== undefined && o.cost + o.after === best)
    .sort((a, b) => Number(visited.has(a.w)) - Number(visited.has(b.w)) || a.cost - b.cost);
  const pick = options[0];
  if (!pick) return null;
  return { next: pick.w, cost: pick.cost, remaining: best, letters: [...pick.w].flatMap((ch, k) => (ch !== room[k] ? [k] : [])) };
}

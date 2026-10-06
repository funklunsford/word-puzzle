import { describe, expect, it } from 'vitest';
import mazeJson from '../public/mazes.json';
import { nextStep, type Doors } from './hints';
import { buildGraph, solve } from './maze';
import { wordDistance } from './strokes';

const { words, puzzles } = mazeJson as unknown as { words: string[]; puzzles: { puzzle: { start: string; goal: string; best: number } }[] };
const adj = buildGraph(words);
const doorsOf: Doors = (w) => adj[words.indexOf(w)].map((e): [string, number] => [words[e.to], e.cost]);
const best = (a: string, b: string) => (a === b ? 0 : solve(words, adj, a, b)!.best);

describe('the maze shipped with the game', () => {
  it("lists every word's doors, as the word graph has them", () => {
    const shipped = (mazeJson as unknown as { doors: number[][] }).doors;
    expect(shipped.length).toBe(words.length);
    shipped.forEach((flat, i) => {
      const listed = Array.from({ length: flat.length / 2 }, (_, k) => `${flat[2 * k]}:${flat[2 * k + 1]}`).sort();
      expect(listed, words[i]).toEqual(adj[i].map((e) => `${e.to}:${e.cost}`).sort());
    });
  });
});

describe('hints', () => {
  it('suggests a next word on a shortest route, from the start and from words off the route', () => {
    for (const { puzzle: p } of puzzles.slice(0, 6)) {
      // From the start, and from a couple of the start's other doors.
      const rooms = [p.start, ...adj[words.indexOf(p.start)].slice(0, 2).map((e) => words[e.to])];
      for (const room of rooms) {
        if (room === p.goal) continue;
        const h = nextStep(doorsOf, room, p.goal, new Set())!;
        const label = `${room} → ${p.goal}`;
        expect(h.remaining, label).toBe(best(room, p.goal));
        expect(wordDistance(room, h.next) + best(h.next, p.goal), label).toBe(h.remaining);
        expect(h.letters, label).toEqual([...h.next].flatMap((ch, k) => (ch !== room[k] ? [k] : [])));
      }
    }
  });

  it('counts going back to a visited word as free, as the game does', () => {
    const p = puzzles[0].puzzle;
    const first = nextStep(doorsOf, p.start, p.goal, new Set([p.start]))!;
    // Having stepped on to the hinted word, the rest costs what's left, never more.
    const then = nextStep(doorsOf, first.next, p.goal, new Set([p.start, first.next]))!;
    expect(then.remaining).toBe(first.remaining - first.cost);
    // From a word next to the start (start visited), the start costs nothing to go back to.
    const side = words[adj[words.indexOf(p.start)][0].to];
    const h = nextStep(doorsOf, side, p.goal, new Set([p.start, side]))!;
    expect(h.remaining).toBeLessThanOrEqual(best(p.start, p.goal));
  });

  it('has nothing to suggest at the goal', () => {
    const p = puzzles[0].puzzle;
    expect(nextStep(doorsOf, p.goal, p.goal, new Set())).toBeNull();
  });
});

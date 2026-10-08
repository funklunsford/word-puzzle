import { describe, expect, it } from 'vitest';
import mazeJson from '../public/mazes.json';
import maze5Json from '../public/mazes-5.json';
import { STRATEGIES, distancesFrom, findPockets, isTricky, keep, measure, parChance, type KeptDifficulty } from './difficulty';
import { isObvious, type Graph, type Need, type Puzzle } from './maze';
import { wordDistance } from './strokes';

type MazeJson = { words: string[]; doors: number[][]; puzzles: { puzzle: Puzzle; need: Need; tricky: boolean; difficulty: KeptDifficulty }[] };
// The maze's own doors, as shipped (scripts/mazes.ts builds them).
const doorsOf = (m: MazeJson): Graph => m.doors.map((flat) => Array.from({ length: flat.length / 2 }, (_, k) => ({ to: flat[2 * k], cost: flat[2 * k + 1] })));
const maze = mazeJson as unknown as MazeJson;
const { words } = maze;
const adj = doorsOf(maze);
const pockets = findPockets(adj);

/** A graph from undirected edges, every door costing 1. */
const graph = (n: number, edges: [number, number][]): Graph => {
  const g: Graph = Array.from({ length: n }, () => []);
  for (const [a, b] of edges) g[a].push({ to: b, cost: 1 }), g[b].push({ to: a, cost: 1 });
  return g;
};

describe('findPockets', () => {
  it('finds the parts that hang off the core by a single word, and leaves out what is cut off', () => {
    // A ring 0-1-2-3 (the core), a chain 3-4-5 hanging off 3, a lone 6 off 1, and 7-8 on their own.
    const { pocketOf, sizes } = findPockets(
      graph(9, [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 0],
        [3, 4],
        [4, 5],
        [1, 6],
        [7, 8],
      ]),
    );
    expect([...pocketOf]).toEqual([-1, -1, -1, -1, 0, 0, 1, -1, -1]);
    expect(sizes).toEqual([2, 1]);
  });

  it('keeps a second loop in the core, and a loop that hangs off one word as a pocket', () => {
    // Two rings joined at word 2 (0-1-2 and 2-3-4-5): the bigger is the core, the smaller a pocket.
    const { pocketOf, sizes } = findPockets(
      graph(6, [
        [0, 1],
        [1, 2],
        [2, 0],
        [2, 3],
        [3, 4],
        [4, 5],
        [5, 2],
      ]),
    );
    expect([...pocketOf]).toEqual([0, 0, -1, -1, -1, -1]);
    expect(sizes).toEqual([2]);
  });

  it('finds pockets all over the real maze, each only reachable through one word', () => {
    expect(pockets.sizes.length).toBeGreaterThan(100);
    for (let p = 0; p < pockets.sizes.length; p++) {
      const inside = words.map((_, i) => i).filter((i) => pockets.pocketOf[i] === p);
      const ways = new Set(inside.flatMap((i) => adj[i].map((e) => e.to)).filter((v) => pockets.pocketOf[v] !== p));
      expect(ways.size, inside.map((i) => words[i]).join(' ')).toBe(1);
    }
  });
});

describe('a puzzle the straightforward way solves', () => {
  it('is obvious to the rules of thumb, needing no look ahead', () => {
    // WILL → WILT is one step that leaves fewer letters wrong and looks cheapest.
    const p: Puzzle = { start: 'WILL', goal: 'WILT', best: wordDistance('WILL', 'WILT'), path: ['WILL', 'WILT'] };
    const d = measure(words, adj, p, pockets);
    expect(d.depth).toBe(1);
    expect(d.obvious).toEqual([STRATEGIES.letters, STRATEGIES.strokes]);
    expect(isTricky(d)).toBe(false);
  });
});

describe.each([
  { letters: 4, maze, words, adj, pockets },
  { letters: 5, maze: maze5Json as unknown as MazeJson, words: (maze5Json as unknown as MazeJson).words, adj: doorsOf(maze5Json as unknown as MazeJson), pockets: findPockets(doorsOf(maze5Json as unknown as MazeJson)) },
])('the $letters-letter puzzle pool', ({ maze, words, adj, pockets }) => {
  it('is all tricky, and every puzzle passes a pocket', () => {
    for (const { puzzle } of maze.puzzles) {
      const d = measure(words, adj, puzzle, pockets);
      const label = `${puzzle.start} → ${puzzle.goal}`;
      expect(d.obvious, label).toEqual([]);
      expect(isObvious(words, adj, puzzle.start, puzzle.goal, puzzle.best), label).toBe(false);
      expect(d.depth, label).toBeGreaterThan(1);
      expect(d.pocketsBeside, label).toBeGreaterThan(0);
    }
  }, 30_000);

  it('keeps each puzzle’s difficulty as measured, par chance included', () => {
    for (const { puzzle, difficulty } of maze.puzzles) expect(keep(measure(words, adj, puzzle, pockets), parChance(words, adj, puzzle)), `${puzzle.start} → ${puzzle.goal}`).toEqual(difficulty);
  }, 60_000);

  it('only calls a door a trap when it leads off every lowest route, and counts what it loses', () => {
    for (const { puzzle, difficulty } of maze.puzzles) {
      const fromStart = distancesFrom(adj, words.indexOf(puzzle.start));
      const toGoal = distancesFrom(adj, words.indexOf(puzzle.goal));
      for (const t of difficulty.traps) {
        const [at, door] = [words.indexOf(t.at), words.indexOf(t.door)];
        const label = `${puzzle.start} → ${puzzle.goal}: ${t.at} → ${t.door}`;
        expect(fromStart[at] + toGoal[at], label).toBe(puzzle.best);
        expect(fromStart[door] + toGoal[door], label).toBeGreaterThan(puzzle.best);
        expect(t.loses, label).toBe(wordDistance(t.at, t.door) + toGoal[door] - toGoal[at]);
        if (t.pocket) expect(pockets.pocketOf[door], label).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('scores the same puzzle the same every time, between never and always', () => {
    const { puzzle } = maze.puzzles[0];
    const a = parChance(words, adj, puzzle);
    expect(parChance(words, adj, puzzle)).toBe(a);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThanOrEqual(1);
  });
});

import { describe, expect, it } from 'vitest';
import mazeJson from '../public/mazes.json';
import maze5Json from '../public/mazes-5.json';
import {
  STRATEGIES,
  distancesFrom,
  findPockets,
  goalSide,
  isTricky,
  isTrickyBothWays,
  keep,
  measure,
  meetDepth,
  parChance,
  planChance,
  planningDepth,
  reversed,
  searchEffort,
  walkChance,
  type KeptDifficulty,
} from './difficulty';
import { isObvious, type Graph, type Need, type Puzzle } from './maze';
import { strokeDiff, wordDistance } from './strokes';

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

/** A graph from undirected edges with costs. */
const weighted = (n: number, edges: [number, number, number][]): Graph => {
  const g: Graph = Array.from({ length: n }, () => []);
  for (const [a, b, cost] of edges) g[a].push({ to: b, cost }), g[b].push({ to: a, cost });
  return g;
};

describe('goalSide', () => {
  it('maps every word a few doors back from the goal, with the fewest strokes in that many doors', () => {
    // 0 is the goal; 2 is one door from it at 3 strokes, or two doors at 2; 3 is three doors back.
    const adj = weighted(4, [
      [0, 1, 1],
      [1, 2, 1],
      [0, 2, 3],
      [2, 3, 2],
    ]);
    expect(Object.fromEntries(goalSide(adj, 0, 1))).toEqual({ 0: 0, 1: 1, 2: 3 });
    expect(Object.fromEntries(goalSide(adj, 0, 2))).toEqual({ 0: 0, 1: 1, 2: 2, 3: 5 });
    expect(Object.fromEntries(goalSide(adj, 0, 3))).toEqual({ 0: 0, 1: 1, 2: 2, 3: 4 });
  });
});

describe('working back from the goal', () => {
  // TILE → TAME: TIDE is the right step, but LAME looks much closer to TAME, and it's a dead end.
  const words = ['TILE', 'TIDE', 'LAME', 'TAME'];
  const adj = weighted(4, [
    [0, 1, 1],
    [1, 3, 1],
    [0, 2, 1],
  ]);
  const puzzle: Puzzle = { start: 'TILE', goal: 'TAME', best: 2, path: ['TILE', 'TIDE', 'TAME'] };

  it('starts from a trap', () => {
    expect(strokeDiff('LAME', 'TAME')).toBeLessThan(strokeDiff('TIDE', 'TAME'));
  });

  it('defeats a player who leans towards the goal, not one who has mapped a door back from it', () => {
    const forward = walkChance(words, adj, puzzle);
    expect(forward.par).toBeLessThan(0.1);
    expect(walkChance(words, adj, puzzle, { target: 'meet', steps: 1, sure: true }).par).toBe(1);
  });

  it('needs a step of look-ahead going forward, none after working back', () => {
    expect(planningDepth(words, adj, puzzle)).toBe(2);
    expect(meetDepth(words, adj, puzzle, 1)).toBe(1);
  });

  it('is found by a planner who looks back from the goal first, and rarely by one who only looks forward', () => {
    expect(planChance(words, adj, puzzle, 'meet', { budget: 2 }).par).toBe(1);
    expect(planChance(words, adj, puzzle, 'backward', { budget: 2 }).par).toBe(1);
    expect(planChance(words, adj, puzzle, 'forward', { budget: 2 }).par).toBeLessThan(0.1);
  });

  it('turns the puzzle round', () => {
    expect(reversed(puzzle)).toEqual({ start: 'TAME', goal: 'TILE', best: 2, path: ['TAME', 'TIDE', 'TILE'] });
  });
});

describe('searchEffort', () => {
  it('counts the words a search from both ends must look at before it can be sure of par', () => {
    // A chain of three 3-stroke doors, MILD → TILE in 9: from each end, the words less than halfway
    // whose far end looks under par from there.
    const words = ['MILD', 'WILD', 'WILE', 'TILE'];
    const adj = weighted(4, [
      [0, 1, 3],
      [1, 2, 3],
      [2, 3, 3],
    ]);
    const must = (w: string, strokes: number, far: string) => 2 * strokes < 9 && strokes + strokeDiff(w, far) < 9;
    const expected = [must('MILD', 0, 'TILE'), must('WILD', 3, 'TILE'), must('TILE', 0, 'MILD'), must('WILE', 3, 'MILD')].filter(Boolean).length;
    expect(expected).toBeGreaterThan(0);
    expect(searchEffort(words, adj, { start: 'MILD', goal: 'TILE', best: 9, path: words })).toBe(expected);
  });

  it('is the same either way round', () => {
    for (const { puzzle } of maze.puzzles.slice(0, 20)) expect(searchEffort(words, adj, reversed(puzzle)), `${puzzle.start} → ${puzzle.goal}`).toBe(searchEffort(words, adj, puzzle));
  });
});

describe('walkChance', () => {
  const maze5 = maze5Json as unknown as MazeJson;
  const adj5 = doorsOf(maze5);
  it('is parChance’s walker: the same par rate, puzzle by puzzle, and near misses never change it', () => {
    for (const [m, a] of [
      [maze, adj],
      [maze5, adj5],
    ] as const) {
      for (const { puzzle, difficulty } of m.puzzles.slice(0, 15)) {
        const label = `${puzzle.start} → ${puzzle.goal}`;
        expect(walkChance(m.words, a, puzzle).par, label).toBe(difficulty.parChance);
        const near = walkChance(m.words, a, puzzle, { slack: 2 });
        expect(near.par, label).toBe(difficulty.parChance);
        expect(near.near1, label).toBeGreaterThanOrEqual(near.par);
        expect(near.near2, label).toBeGreaterThanOrEqual(near.near1);
      }
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
    expect(isTrickyBothWays(d, measure(words, adj, reversed(p), pockets))).toBe(false);
  });
});

// Each pool's rule (scripts/mazes.ts): at 4 letters a pocket beside the route; at 5, holding out
// against working back from the goal (meet depth 2 or more).
describe.each([
  { letters: 4, maze, words, adj, pockets, rule: 'pocket' },
  { letters: 5, maze: maze5Json as unknown as MazeJson, words: (maze5Json as unknown as MazeJson).words, adj: doorsOf(maze5Json as unknown as MazeJson), pockets: findPockets(doorsOf(maze5Json as unknown as MazeJson)), rule: 'meet' },
])('the $letters-letter puzzle pool', ({ maze, words, adj, pockets, rule }) => {
  it(`is all tricky, and every puzzle keeps the pool's rule (${rule})`, () => {
    for (const { puzzle } of maze.puzzles) {
      const d = measure(words, adj, puzzle, pockets);
      const label = `${puzzle.start} → ${puzzle.goal}`;
      expect(d.obvious, label).toEqual([]);
      expect(isObvious(words, adj, puzzle.start, puzzle.goal, puzzle.best), label).toBe(false);
      expect(d.depth, label).toBeGreaterThan(1);
      if (rule === 'pocket') expect(d.pocketsBeside, label).toBeGreaterThan(0);
      else expect(meetDepth(words, adj, puzzle), label).toBeGreaterThanOrEqual(2);
    }
  }, 60_000);

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

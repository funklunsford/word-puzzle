import { describe, expect, it } from 'vitest';
import mazeJson from '../public/mazes.json';
import maze5Json from '../public/mazes-5.json';
import { ONE_STROKE, POOL_MIX, PUZZLE_SHAPE, PUZZLE_SHAPES, buildGraph, classifyNeed, hubStep, isObvious, randomPuzzle, solve, steppingStone, type Need } from './maze';
import { STEP_LIMIT, wordDistance } from './strokes';

const { words, puzzle } = mazeJson as { words: string[]; puzzle: { start: string; goal: string; best: number; path: string[] } };
const adj = buildGraph(words);

/** Small seeded generator so the test is repeatable. */
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Words connected to the biggest group of rooms (the main maze). */
function mainMaze() {
  const comp = new Array<number>(words.length).fill(-1);
  const sizes: number[] = [];
  for (let i = 0; i < words.length; i++) {
    if (comp[i] >= 0) continue;
    const stack = [i];
    comp[i] = sizes.length;
    let n = 0;
    while (stack.length) {
      const u = stack.pop()!;
      n++;
      for (const { to } of adj[u]) if (comp[to] < 0) (comp[to] = sizes.length, stack.push(to));
    }
    sizes.push(n);
  }
  const main = sizes.indexOf(Math.max(...sizes));
  return words.filter((_, i) => comp[i] === main);
}

describe('maze graph', () => {
  it('keeps words with G, J, U and Y reachable (they used to be cut off)', () => {
    const main = new Set(mainMaze());
    expect(main.size / words.length).toBeGreaterThanOrEqual(0.85);
    for (const ch of 'GJUY') {
      const withIt = words.filter((w) => w.includes(ch));
      const share = withIt.filter((w) => main.has(w)).length / withIt.length;
      expect(share, `${ch}: ${Math.round(share * 100)}% of its words are in the main maze`).toBeGreaterThanOrEqual(0.6);
    }
  });

  it('solves the fixed puzzle the same way the script did', () => {
    expect(solve(words, adj, puzzle.start, puzzle.goal)).toEqual(puzzle);
  });

  it('random puzzles have a real route within the target shape', () => {
    const random = mulberry32(7);
    for (let n = 0; n < 5; n++) {
      const p = randomPuzzle(words, adj, random);
      expect(p.path[0]).toBe(p.start);
      expect(p.path.at(-1)).toBe(p.goal);
      expect(p.path.length - 1).toBeGreaterThanOrEqual(PUZZLE_SHAPE.steps[0]);
      expect(p.path.length - 1).toBeLessThanOrEqual(PUZZLE_SHAPE.steps[1]);
      expect(p.best).toBeGreaterThanOrEqual(PUZZLE_SHAPE.best[0]);
      expect(p.best).toBeLessThanOrEqual(PUZZLE_SHAPE.best[1]);
      let sum = 0;
      for (let i = 1; i < p.path.length; i++) {
        const c = wordDistance(p.path[i - 1], p.path[i]);
        expect(c).toBeLessThanOrEqual(STEP_LIMIT);
        sum += c;
      }
      expect(sum).toBe(p.best);
    }
  });
});

type PoolJson = { words: string[]; puzzle: { start: string; goal: string; best: number; path: string[] }; puzzles: { puzzle: { start: string; goal: string; best: number; path: string[] }; need: Need; tricky: boolean }[] };

describe('the puzzle pool', () => {
  it('treats C, I and V, the one-stroke letters, as the hubs', () => {
    expect([...ONE_STROKE].sort()).toEqual(['C', 'I', 'V']);
  });

  it('mixes what puzzles need from C, I and V as planned, so not every maze needs them', () => {
    const pool = (mazeJson as unknown as PoolJson).puzzles;
    for (const need of ['none', 'letter', 'stone'] as Need[]) {
      expect(pool.filter((x) => x.need === need).length / pool.length, need).toBeCloseTo(POOL_MIX.need[need], 2);
    }
  });
});

describe.each([
  { letters: 4, json: mazeJson as unknown as PoolJson },
  { letters: 5, json: maze5Json as unknown as PoolJson },
])('the $letters-letter puzzle pool', ({ letters, json }) => {
  const pool = json.puzzles;
  const poolWords = json.words;
  const poolAdj = letters === 4 ? adj : buildGraph(poolWords);
  const [lo, hi] = PUZZLE_SHAPES[letters].best;

  it('spreads its lowest strokes evenly across its range', () => {
    expect(pool.length).toBeGreaterThanOrEqual(300);
    for (const { puzzle } of pool) expect(puzzle.best).toBeGreaterThanOrEqual(lo), expect(puzzle.best).toBeLessThanOrEqual(hi);
    const mean = pool.reduce((t, x) => t + x.puzzle.best, 0) / pool.length;
    expect(mean).toBeCloseTo((lo + hi) / 2, 1);
    const per = (b: number) => pool.filter((x) => x.puzzle.best === b).length;
    for (let b = lo; b <= hi; b++) expect(per(b)).toBe(pool.length / (hi - lo + 1));
  });

  it('tags each puzzle truly, and stores a shortest route that shows it', () => {
    for (const { puzzle: p, need } of pool) {
      const label = `${p.start} → ${p.goal}`;
      expect(p.start.length, label).toBe(letters);
      expect(classifyNeed(poolWords, poolAdj, p.start, p.goal, p.best).need, label).toBe(need);
      expect([p.path[0], p.path.at(-1)], label).toEqual([p.start, p.goal]);
      expect(p.path.slice(1).reduce((t, w, i) => t + wordDistance(p.path[i], w), 0), label).toBe(p.best);
      const steps = p.path.slice(1).map((w, i) => [p.path[i], w]);
      if (need === 'none') expect(steps.some(([a, b]) => hubStep(a, b)), label).toBe(false);
      if (need === 'letter') expect(p.path.slice(1, -1).some((w) => steppingStone(w, p.start, p.goal)), label).toBe(false);
    }
  }, 60_000);

  it('has no obvious puzzles: the straightforward approach never makes par (src/difficulty.test.ts checks the rest)', () => {
    for (const { puzzle: p, tricky } of pool) {
      expect(tricky, `${p.start} → ${p.goal}`).toBe(true);
      expect(isObvious(poolWords, poolAdj, p.start, p.goal, p.best), `${p.start} → ${p.goal}`).toBe(false);
    }
  });

  it('solves its reference puzzle the same way the script did', () => {
    expect(solve(poolWords, poolAdj, json.puzzle.start, json.puzzle.goal)).toEqual(json.puzzle);
  });
});

describe('isObvious', () => {
  it('calls a puzzle obvious when moving straight towards the goal makes par, and tricky otherwise', () => {
    // Every step of this route changes a letter into the goal's: anyone would find it.
    const plain = randomPuzzleWhere((p) => p.path.every((w, i) => i === 0 || [...w].filter((ch, k) => ch !== p.goal[k]).length < [...p.path[i - 1]].filter((ch, k) => ch !== p.goal[k]).length));
    expect(isObvious(words, adj, plain.start, plain.goal, plain.best)).toBe(true);
  });
});

/** The first random puzzle (from a fixed seed) that satisfies `test`. */
function randomPuzzleWhere(test: (p: ReturnType<typeof randomPuzzle>) => boolean) {
  const random = mulberry32(3);
  for (;;) {
    const p = randomPuzzle(words, adj, random);
    if (test(p)) return p;
  }
}

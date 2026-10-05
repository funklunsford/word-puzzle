import { describe, expect, it } from 'vitest';
import mazeJson from '../public/mazes.json';
import { PUZZLE_SHAPE, buildGraph, randomPuzzle, solve } from './maze';
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

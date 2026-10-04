import { describe, expect, it } from 'vitest';
import mazeJson from '../public/mazes.json';
import { buildGraph, randomPuzzle, solve } from './maze';
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

describe('maze graph', () => {
  it('solves the fixed puzzle the same way the script did', () => {
    expect(solve(words, adj, puzzle.start, puzzle.goal)).toEqual(puzzle);
  });

  it('random puzzles have a real route within the target shape', () => {
    const random = mulberry32(7);
    for (let n = 0; n < 5; n++) {
      const p = randomPuzzle(words, adj, random);
      expect(p.path[0]).toBe(p.start);
      expect(p.path.at(-1)).toBe(p.goal);
      expect(p.path.length - 1).toBeGreaterThanOrEqual(4);
      expect(p.path.length - 1).toBeLessThanOrEqual(7);
      expect(p.best).toBeGreaterThanOrEqual(10);
      expect(p.best).toBeLessThanOrEqual(20);
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

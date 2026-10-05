import { describe, expect, it } from 'vitest';
import mazeJson from '../public/mazes.json';
import everydayText from '../data/everyday-4.txt?raw';
import definitionsJson from '../public/definitions.json';
import { payStep, placePots, potRoute, potValues, scoreWalk } from './inkpots';
import { buildGraph, randomPuzzle, seededRandom } from './maze';
import { STEP_LIMIT, wordDistance } from './strokes';
import { parseWordList } from './wordlist';

const { words, puzzle, inkPots } = mazeJson as {
  words: string[];
  puzzle: { start: string; goal: string; best: number; path: string[] };
  inkPots: { pots: string[]; best: number; walk: string[] };
};
const adj = buildGraph(words);

describe('ink pot scoring', () => {
  it('pays for a step with banked ink first, a stroke per drop', () => {
    expect(payStep(3, 0)).toEqual({ paid: 3, used: 0 });
    expect(payStep(3, 1)).toEqual({ paid: 2, used: 1 });
    expect(payStep(1, 2)).toEqual({ paid: 0, used: 1 });
  });

  it('charges only steps to new words, and banks ink from a pot on its first visit', () => {
    // WILD → WILL (2) → WILD (back: free) → WILL (free) → WILE (1, paid by WILL's ink) → VILE (1)
    const walk = ['WILD', 'WILL', 'WILD', 'WILL', 'WILE', 'VILE'];
    const cost = (w: string[]) => w.slice(1).reduce((t, x, i) => t + wordDistance(w[i], x), 0);
    expect(scoreWalk(walk, [])).toBe(cost(['WILD', 'WILL', 'WILE', 'VILE']));
    expect(scoreWalk(walk, ['WILL'])).toBe(scoreWalk(walk, []) - 1);
  });
});

/** A route is playable: valid steps, from the start, ending the moment it reaches the goal. */
function expectPlayable(walk: string[], start: string, goal: string) {
  expect(walk[0]).toBe(start);
  expect(walk.indexOf(goal)).toBe(walk.length - 1);
  for (let i = 1; i < walk.length; i++) expect(wordDistance(walk[i - 1], walk[i]), `${walk[i - 1]} → ${walk[i]}`).toBeLessThanOrEqual(STEP_LIMIT);
}

describe('ink pot solver', () => {
  it("reproduces the fixed puzzle's pots, best and route, which scores what it claims", () => {
    const r = potRoute(words, adj, puzzle.start, puzzle.goal, inkPots.pots);
    expect(r.best).toBe(inkPots.best);
    expect(r.walk).toEqual(inkPots.walk);
    expect(r.best).toBe(r.bound); // all banked ink gets spent
    expect(scoreWalk(r.walk, inkPots.pots)).toBe(inkPots.best);
    expect(inkPots.best).toBeLessThanOrEqual(puzzle.best);
    expectPlayable(r.walk, puzzle.start, puzzle.goal);
  });

  it('places a saving, a break-even and a costly pot off the best path where it can, and solves random puzzles exactly', () => {
    const random = seededRandom(3);
    for (let n = 0; n < 6; n++) {
      const p = randomPuzzle(words, adj, random);
      const pots = placePots(words, adj, p.start, p.goal, p.best, p.path, random);
      const value = potValues(adj, words.indexOf(p.start), words.indexOf(p.goal), p.best);
      // A sparse corner of the maze can have no saving or break-even spot (BREW → SLED has only
      // costly ones), so there may be fewer than three pots, but never none when there's a spot.
      const spots = words.filter((w, i) => Math.abs(value[i]) <= 1 && !p.path.includes(w));
      expect(pots.length).toBeLessThanOrEqual(3);
      if (spots.length) expect(pots.length, `${p.start} → ${p.goal}`).toBeGreaterThanOrEqual(1);
      for (const pot of pots) expect(p.path).not.toContain(pot);
      expect(pots.map((x) => value[words.indexOf(x)]).every((v) => v >= -1 && v <= 1)).toBe(true);
      const r = potRoute(words, adj, p.start, p.goal, pots);
      expect(r.best).toBe(r.bound);
      expect(r.best).toBeLessThanOrEqual(p.best);
      expect(r.best).toBeGreaterThanOrEqual(p.best - pots.length);
      expectPlayable(r.walk, p.start, p.goal);
    }
  });
});

describe('puzzle pool (one is picked on each load)', () => {
  const { puzzles } = mazeJson as unknown as {
    puzzles: { puzzle: { start: string; goal: string; best: number; path: string[] }; inkPots: { pots: string[]; best: number; walk: string[] } }[];
  };
  const everyday = new Set(parseWordList(everydayText));

  it('holds hundreds of distinct puzzles that start and end on everyday words', () => {
    expect(puzzles.length).toBeGreaterThanOrEqual(300);
    expect(new Set(puzzles.map((p) => `${p.puzzle.start}-${p.puzzle.goal}`)).size).toBe(puzzles.length);
    const defs = definitionsJson as unknown as Record<string, string[]>;
    for (const { puzzle } of puzzles) {
      for (const w of [puzzle.start, puzzle.goal]) {
        expect(everyday.has(w), w).toBe(true);
        // A base form: not an inflection of another word, not a past tense, not archaic, not a plural.
        expect(defs[w].length, w).toBe(2);
        expect(defs[w][1], w).not.toMatch(/\(past of|old-fashioned/);
        expect(w, w).not.toMatch(/[^S]S$/);
      }
    }
  });

  it("gives every puzzle a real best route, and pots that score what they claim", () => {
    for (const { puzzle: p, inkPots: ink } of puzzles) {
      expectPlayable(p.path, p.start, p.goal);
      expect(p.path.slice(1).reduce((t, w, i) => t + wordDistance(p.path[i], w), 0), `${p.start} → ${p.goal}`).toBe(p.best);
      expectPlayable(ink.walk, p.start, p.goal);
      expect(scoreWalk(ink.walk, ink.pots)).toBe(ink.best);
      expect(ink.best).toBeLessThanOrEqual(p.best);
    }
  });
});

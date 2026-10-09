import { describe, expect, it } from 'vitest';
import mazeJson from '../public/mazes.json';
import maze5Json from '../public/mazes-5.json';
import defs4 from '../public/definitions.json';
import defs5 from '../public/definitions-5.json';
import type { Def } from './components/maze/Definition';
import { clue, hintSays, nextHintLevel, nextStep, type Doors, type NextStep } from './hints';
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

describe('what a hint shows, ask by ask', () => {
  const step: NextStep = { next: 'CALM', cost: 2, remaining: 6, letters: [1, 3] };

  it("gives the next word's meaning, then the letters to change, then the word", () => {
    expect(nextHintLevel(null, true)).toBe(1);
    expect(nextHintLevel(1, true)).toBe(2);
    expect(nextHintLevel(2, true)).toBe(3);
    expect(nextHintLevel(3, true)).toBeNull();
    const meaning = clue('CALM', ['v.', 'make calm or still']);
    expect(hintSays(step, 1, meaning)).toBe('Hint: the next word means “make ___ or still” (verb).');
    expect(hintSays(step, 2, meaning)).toBe('Hint: change the 2nd and 4th letters, to a word meaning “make ___ or still” (verb).');
    expect(hintSays(step, 3, meaning)).toBe('Hint: make CALM next (2 strokes).');
  });

  it('starts at the letters for a word with no definition', () => {
    expect(nextHintLevel(null, false)).toBe(2);
    expect(hintSays(step, 2, null)).toBe('Hint: change the 2nd and 4th letters.');
    expect(nextHintLevel(2, false)).toBe(3);
  });

  it('names any of five letters, and lists three', () => {
    expect(hintSays({ ...step, letters: [4] }, 2, null)).toBe('Hint: change the 5th letter.');
    expect(hintSays({ ...step, letters: [0, 2, 4] }, 2, null)).toBe('Hint: change the 1st, 3rd and 5th letters.');
    expect(hintSays({ ...step, cost: 0 }, 3, null)).toBe('Hint: make CALM next (free).');
  });

  it('blanks the word out of its own definition, with its base form and endings', () => {
    expect(clue('COOL', ['v.', 'make cool or cooler'])).toBe('“make ___ or ___er” (verb)');
    expect(clue('CALMS', ['v.', 'make calm or still', 'calm'])).toBe('“make ___ or still” (verb)');
    expect(clue('CONE', ['n.', 'any cone-shaped artifact'])).toBe('“any ___-shaped artifact” (noun)');
    // Other words that only start the same way are left alone.
    expect(clue('CATS', ['n.', 'animals that catch mice', 'cat'])).toBe('“animals that catch mice” (noun)');
    // Nor does the part of speech give it away.
    expect(clue('NOUN', ['n.', 'a content word'])).toBe('“a content word”');
  });

  it("never names a maze word in its clue, in either game's definitions", () => {
    for (const [maze, defs] of [
      [mazeJson, defs4],
      [maze5Json, defs5],
    ] as const) {
      for (const w of (maze as unknown as { words: string[] }).words) {
        const def = (defs as unknown as Record<string, Def>)[w];
        if (!def) continue;
        expect(clue(w, def).toUpperCase().split(/[^A-Z]+/), w).not.toContain(w);
      }
    }
  });
});

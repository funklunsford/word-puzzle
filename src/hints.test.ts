import { describe, expect, it } from 'vitest';
import mazeJson from '../public/mazes.json';
import maze5Json from '../public/mazes-5.json';
import poolText from '../public/pool.json?raw';
import pool5Text from '../public/pool-5.json?raw';
import defs4 from '../public/definitions.json';
import defs5 from '../public/definitions-5.json';
import type { Def } from './components/maze/Definition';
import { START_HINT, afterAsk, clue, earnHint, earnOutOfStrokes, hintAlong, hintGate, hintSays, hintStep, nextHintLevel, nextStep, type Doors, type HintGate, type HintLevel, type NextStep } from './hints';
import { seededRandom } from './maze';
import { buildGraph, solve } from './maze';
import { wordDistance } from './strokes';

const { words } = mazeJson as { words: string[] };
// The pool (scripts/mazes.ts) comes in as text: it's big, and type-checking it as JSON would be slow.
const { puzzles } = JSON.parse(poolText) as { puzzles: { puzzle: { start: string; goal: string; best: number } }[] };
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

describe('a hint off the route', () => {
  // A small maze: from START, SIDE is a dead end (on to GOAL only the long way, by FAR), and the
  // way on is BENCH. SIDE1 → SIDE2 goes further off.
  const graph: Record<string, [string, number][]> = {
    START: [['SIDES', 2], ['BENCH', 2], ['SIDE1', 1]],
    SIDES: [['START', 2], ['FARTS', 3]],
    SIDE1: [['START', 1], ['SIDE2', 1]],
    SIDE2: [['SIDE1', 1]],
    BENCH: [['START', 2], ['GOALS', 2]],
    FARTS: [['SIDES', 3], ['GOALS', 5]],
    GOALS: [['BENCH', 2], ['FARTS', 5]],
  };
  const doors: Doors = (w) => graph[w] ?? [];

  it("names the next new word, and the way back to it, where the route starts by going back", () => {
    const visited = new Set(['START', 'SIDES']);
    expect(nextStep(doors, 'SIDES', 'GOALS', visited)?.next).toBe('START'); // the route's own first step
    expect(hintStep(doors, 'SIDES', 'GOALS', visited)).toEqual({ next: 'BENCH', cost: 2, remaining: 4, letters: [0, 1, 2, 3, 4], via: ['START'] });
  });

  it('goes back through as many words as the route does', () => {
    const h = hintStep(doors, 'SIDE2', 'GOALS', new Set(['START', 'SIDE1', 'SIDE2']))!;
    expect([h.next, h.via]).toEqual(['BENCH', ['SIDE1', 'START']]);
  });

  it('is the plain next step on the route, with no way back', () => {
    expect(hintStep(doors, 'START', 'GOALS', new Set(['START']))).toEqual({ next: 'BENCH', cost: 2, remaining: 4, letters: [0, 1, 2, 3, 4] });
  });

  it('goes along when the player goes back the way it said, and ends otherwise', () => {
    const hint = { room: 'SIDE2', level: 2 as HintLevel, step: { next: 'BENCH', cost: 2, remaining: 4, letters: [0, 2], via: ['SIDE1', 'START'] } };
    expect(hintAlong(hint, 'SIDE2', 'SIDE1')).toEqual({ ...hint, room: 'SIDE1', step: { ...hint.step, via: ['START'] } });
    const { via: _, ...plain } = hint.step;
    expect(hintAlong(hint, 'SIDE2', 'START')).toEqual({ ...hint, room: 'START', step: plain }); // straight back to the end of the way
    expect(hintAlong(hint, 'SIDE2', 'BENCH')).toBeNull(); // the word itself, made: a new step
    expect(hintAlong(hint, 'SIDE2', 'SIDES')).toBeNull(); // somewhere else
    expect(hintAlong(hint, 'SIDE1', 'START')).toBeNull(); // a hint asked in another word
    expect(hintAlong({ ...hint, step: plain }, 'SIDE2', 'START')).toBeNull(); // no way back: moving on ends it
  });

  it('says where to go back to, then the step from there', () => {
    const step: NextStep = { next: 'BENCH', cost: 2, remaining: 4, letters: [0, 2], via: ['SIDE1', 'START'] };
    expect(hintSays(step, 1, '“a long seat”')).toBe('Hint: go back through SIDE1 to START (free), then make a word meaning “a long seat”.');
    expect(hintSays({ ...step, via: ['START'] }, 2, null)).toBe('Hint: go back to START (free), then change the 1st and 3rd letters.');
    expect(hintSays({ ...step, via: ['START'] }, 3, null)).toBe('Hint: go back to START (free), then make BENCH (2 strokes).');
  });

  it('on 5-letter puzzles, never names a word already made, and its route still solves at the best', () => {
    const { words: words5, doors: shipped } = maze5Json as unknown as { words: string[]; doors: number[][] };
    const at = new Map(words5.map((w, i) => [w, i]));
    const doors5: Doors = (w) => {
      const flat = shipped[at.get(w)!];
      return Array.from({ length: flat.length / 2 }, (_, k): [string, number] => [words5[flat[2 * k]], flat[2 * k + 1]]);
    };
    const { puzzles: pool5 } = JSON.parse(pool5Text) as { puzzles: { puzzle: { start: string; goal: string } }[] };
    const random = seededRandom(5);
    let back = 0;
    for (const { puzzle: p } of pool5.slice(0, 12))
      for (let trial = 0; trial < 6; trial++) {
        // Wander 1–3 new words off the start, then ask.
        const trail = [p.start];
        for (let k = 0; k <= trial % 3; k++) {
          const fresh = doors5(trail[trail.length - 1]).filter(([w]) => !trail.includes(w) && w !== p.goal);
          if (fresh.length) trail.push(fresh[Math.floor(random() * fresh.length)][0]);
        }
        const room = trail[trail.length - 1];
        const visited = new Set(trail);
        const h = hintStep(doors5, room, p.goal, visited)!;
        const label = `${trail.join(' → ')} (goal ${p.goal})`;
        expect(h.remaining, label).toBe(nextStep(doors5, room, p.goal, visited)!.remaining);
        expect(!visited.has(h.next) || h.next === p.goal, label).toBe(true);
        // The way back is through words made, door by door, and the step is a door of its last.
        let from = room;
        for (const w of h.via ?? []) {
          expect(visited.has(w), label).toBe(true);
          expect(doors5(from).some(([d]) => d === w), label).toBe(true);
          from = w;
        }
        expect(doors5(from).find(([d]) => d === h.next)?.[1], label).toBe(h.cost);
        if (h.via) back++;
        // From the word it names, the goal is the rest of the best away.
        if (h.next !== p.goal) expect(h.cost + nextStep(doors5, h.next, p.goal, new Set([...visited, h.next]))!.remaining, label).toBe(h.remaining);
      }
    expect(back).toBeGreaterThan(0); // some of these routes do start by going back
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

describe('earning hints', () => {
  // A game as MazeApp plays it: whether an earned hint is waiting, the word the player is in, and
  // how much of that step's hint is shown. Moving to any word ends the step's hint.
  const play = (hardcore = false) => {
    let earned = START_HINT;
    let shown: HintLevel | null = null;
    const game = {
      gate: (): HintGate => hintGate(earned, shown, hardcore),
      /** A new word made, or a free return (a word visited before). */
      reach(newWord: boolean) {
        earned = earnHint(earned, newWord, hardcore);
        shown = null;
        return game;
      },
      /** All of a step's strokes used in the word the player is in, without landing on a word. */
      outOfStrokes() {
        if (earnOutOfStrokes(game.gate())) earned = true;
        return game;
      },
      /** Asking, with a meaning to give: the level it shows, or null for none. */
      ask(): HintLevel | null {
        const after = afterAsk(game.gate(), earned);
        earned = after.earned;
        if (after.shows) shown = nextHintLevel(shown, true);
        return after.shows ? shown : null;
      },
    };
    return game;
  };

  it('waits at the start, for the first step', () => {
    const game = play();
    expect(game.gate()).toBe('ready');
    expect([game.ask(), game.gate()]).toEqual([1, 'open']);
  });

  it("is locked once the start's is used, until a new word: a free return earns none", () => {
    const game = play();
    game.ask();
    game.reach(false); // a free return (the start word's own hint ends with its step)
    expect(game.gate()).toBe('locked');
    expect(game.ask()).toBeNull();
    expect(game.reach(true).gate()).toBe('ready');
  });

  it("doesn't stack with the start's: an unused one and a new word, still one", () => {
    const game = play().reach(true);
    expect(game.ask()).toBe(1);
    game.reach(false);
    expect(game.gate()).toBe('locked');
  });

  it("doesn't stack: two new words, one hint", () => {
    const game = play().reach(true).reach(true);
    expect(game.gate()).toBe('ready');
    expect(game.ask()).toBe(1);
    game.reach(false);
    expect(game.gate()).toBe('locked');
  });

  it("gives all three of a step's levels for one earned hint, then no more", () => {
    const game = play().reach(true);
    expect([game.ask(), game.gate(), game.ask(), game.gate(), game.ask(), game.gate()]).toEqual([1, 'open', 2, 'open', 3, 'shown']);
    expect(game.ask()).toBeNull();
  });

  it('is locked again after moving on without a new word, back to a word asked in too', () => {
    const game = play().reach(true);
    game.ask();
    game.reach(false); // back to the start
    expect(game.gate()).toBe('locked');
    game.reach(false); // and back to the word asked in: its hint doesn't pick up where it was
    expect(game.gate()).toBe('locked');
    expect(game.ask()).toBeNull();
    game.reach(true);
    expect(game.gate()).toBe('ready');
  });

  it('earns one by running out of strokes when locked, so a word made only to earn one is never needed', () => {
    // The start's hint used, a new word's used too, then back to the start: locked.
    const game = play();
    game.ask();
    game.reach(true).ask();
    game.reach(false);
    expect(game.gate()).toBe('locked');
    expect(game.outOfStrokes().gate()).toBe('ready');
    expect([game.ask(), game.ask(), game.ask(), game.gate()]).toEqual([1, 2, 3, 'shown']);
  });

  it("doesn't earn one by running out of strokes with one waiting or this step's open, nor in hardcore", () => {
    // One waiting: still the one, and once it's used, the step's open, so nothing more is banked.
    const game = play();
    expect(game.outOfStrokes().ask()).toBe(1);
    game.outOfStrokes();
    game.reach(false);
    expect(game.gate()).toBe('locked');
    expect(earnOutOfStrokes('shown')).toBe(false);
    expect(play(true).outOfStrokes().gate()).toBe('none');
  });

  it('keeps an unused earned hint through free returns, until it is used', () => {
    const game = play().reach(true).reach(false).reach(false);
    expect(game.gate()).toBe('ready');
    expect(game.ask()).toBe(1);
  });

  it('has none in hardcore, earned or not', () => {
    const game = play(true).reach(true);
    expect(game.gate()).toBe('none');
    expect(game.ask()).toBeNull();
    expect(hintGate(true, null, true)).toBe('none');
    expect(earnHint(false, true, true)).toBe(false);
    // The start's hint ends with the first word made in hardcore, so turning it off leaves none waiting.
    expect(earnHint(true, true, true)).toBe(false);
    expect(earnHint(true, false, true)).toBe(true);
  });
});

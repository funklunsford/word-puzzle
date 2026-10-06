import { describe, expect, it } from 'vitest';
import mazeJson from '../../public/mazes.json';
import { potRoute } from '../inkpots';
import { PUZZLE_SHAPE, buildGraph, classifyNeed, isObvious, solve } from '../maze';
import { STEP_LIMIT, wordDistance } from '../strokes';
import { DAYS, LAUNCH, dayFor, dayNumber, localDate, type DailyPuzzle } from './daily';

const puzzles = import.meta.glob<DailyPuzzle>('./days/*.json', { eager: true, import: 'default' });
const days = Object.entries(puzzles).map(([path, day]) => ({ file: path.slice(path.lastIndexOf('/') + 1), day }));
const { words } = mazeJson as { words: string[] };
const adj = buildGraph(words);

describe('picking the day', () => {
  it("uses the player's own date, not UTC's", () => {
    // 11pm on 6 October where the player is: still the 6th, whatever UTC says.
    expect(localDate(new Date(2026, 9, 6, 23, 30))).toBe('2026-10-06');
    expect(localDate(new Date(2027, 0, 9, 0, 5))).toBe('2027-01-09');
  });

  it("plays the day's puzzle, else the latest before it, else the first", () => {
    const list = ['2026-10-06', '2026-10-07', '2026-10-09'];
    expect(dayFor('2026-10-07', list)).toBe('2026-10-07');
    expect(dayFor('2026-10-08', list)).toBe('2026-10-07');
    expect(dayFor('2026-12-25', list)).toBe('2026-10-09');
    expect(dayFor('2026-10-05', list)).toBe('2026-10-06');
  });

  it('numbers the days from the first, through daylight-saving changes', () => {
    expect(dayNumber(LAUNCH)).toBe(1);
    expect(dayNumber('2026-10-07')).toBe(2);
    expect(dayNumber('2027-10-06')).toBe(366);
  });
});

describe('the daily puzzles', () => {
  it('starts on the launch day, one file per date, named for it', () => {
    expect(DAYS[0]).toBe(LAUNCH);
    for (const { file, day } of days) expect(file).toBe(`${day.date}.json`);
  });

  it('never repeats a pair, either way round', () => {
    const pairs = days.map(({ day }) => [day.puzzle.start, day.puzzle.goal].sort().join('|'));
    expect(new Set(pairs).size).toBe(pairs.length);
  });

  for (const { day } of days) {
    const { start, goal, best, path } = day.puzzle;
    describe(`${day.date}: ${start} → ${goal}`, () => {
      it('still has the lowest strokes it says, by a route that works, with the current words', () => {
        expect(solve(words, adj, start, goal)?.best).toBe(best);
        expect(path[0]).toBe(start);
        expect(path[path.length - 1]).toBe(goal);
        let cost = 0;
        for (let i = 1; i < path.length; i++) {
          expect(words).toContain(path[i]);
          const step = wordDistance(path[i - 1], path[i]);
          expect(step).toBeLessThanOrEqual(STEP_LIMIT);
          cost += step;
        }
        expect(cost).toBe(best);
      });

      it('has ink pots that still give the best it says', () => {
        expect(potRoute(words, adj, start, goal, day.inkPots.pots).best).toBe(day.inkPots.best);
      });

      it('is labelled with what it asks of the player', () => {
        expect(classifyNeed(words, adj, start, goal, best).need).toBe(day.need);
        expect(!isObvious(words, adj, start, goal, best)).toBe(day.tricky);
      });

      // The first daily is the original puzzle, WILD → TAME (lowest 13); the rest come from the pool.
      if (day.date !== LAUNCH)
        it("fits the pool's rules: tricky, and 8 to 10 strokes", () => {
          expect(day.tricky).toBe(true);
          expect(best).toBeGreaterThanOrEqual(PUZZLE_SHAPE.best[0]);
          expect(best).toBeLessThanOrEqual(PUZZLE_SHAPE.best[1]);
        });
    });
  }
});

import { describe, expect, it } from 'vitest';
import mazeJson from '../../public/mazes.json';
import maze5Json from '../../public/mazes-5.json';
import { potRoute } from '../inkpots';
import { PUZZLE_SHAPES, buildGraph, classifyNeed, isObvious, routeWords, solve } from '../maze';
import { STEP_LIMIT, wordDistance } from '../strokes';
import { DAYS, DAYS_5, LAUNCH, dayFor, dayNumber, localDate, type DailyPuzzle } from './daily';

/** 5-letter days checked in before the pool's puzzles grew to 15–18 strokes. */
const EARLIER_FIVE = ['2026-10-07'];
const files = (glob: Record<string, DailyPuzzle>) => Object.entries(glob).map(([path, day]) => ({ file: path.slice(path.lastIndexOf('/') + 1), day }));
/** Each game's days, against its own words: the 4-letter one, and the desktop's 5-letter one. */
const games = [
  { letters: 4, days: files(import.meta.glob<DailyPuzzle>('./days/*.json', { eager: true, import: 'default' })), words: (mazeJson as { words: string[] }).words },
  { letters: 5, days: files(import.meta.glob<DailyPuzzle>('./days-5/*.json', { eager: true, import: 'default' })), words: (maze5Json as { words: string[] }).words },
];

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
    expect(DAYS_5[0] >= LAUNCH).toBe(true);
    for (const { days } of games) for (const { file, day } of days) expect(file).toBe(`${day.date}.json`);
  });

  for (const { letters, days, words } of games) {
    const adj = buildGraph(words);
    describe(`${letters} letters`, () => {
      it('never repeats a pair, either way round', () => {
        const pairs = days.map(({ day }) => [day.puzzle.start, day.puzzle.goal].sort().join('|'));
        expect(new Set(pairs).size).toBe(pairs.length);
      });

      for (const { day } of days) {
        const { start, goal, best, path } = day.puzzle;
        describe(`${day.date}: ${start} → ${goal}`, () => {
          it('still has the lowest strokes it says, by a route that works, with the current words', () => {
            expect(start.length).toBe(letters);
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

          it('lists the words on its lowest-stroke routes, for hardcore', () => {
            expect(day.onRoute).toEqual(routeWords(words, adj, start, goal));
            for (const w of path) expect(day.onRoute[w], w).toBeDefined();
            expect(day.onRoute[goal]).toBe(best);
          });

          it('has ink pots that still give the best it says', () => {
            expect(potRoute(words, adj, start, goal, day.inkPots.pots).best).toBe(day.inkPots.best);
          });

          it('is labelled with what it asks of the player', () => {
            expect(classifyNeed(words, adj, start, goal, best).need).toBe(day.need);
            if (day.tricky) expect(isObvious(words, adj, start, goal, best)).toBe(false);
          });

          // The first 4-letter daily is the original puzzle, WILD → TAME (lowest 13); the rest come from the pool.
          // The first 5-letter daily, SNARE → SHOUT (lowest 14), came from the pool before its puzzles
          // grew from 12–15 strokes to 15–18 (2026-10-09).
          if (letters !== 4 || day.date !== LAUNCH)
            it("fits the pool's rules: tricky, at the game's length", () => {
              const [lo, hi] = letters === 5 && EARLIER_FIVE.includes(day.date) ? [12, 15] : PUZZLE_SHAPES[letters].best;
              expect(day.tricky).toBe(true);
              expect(best).toBeGreaterThanOrEqual(lo);
              expect(best).toBeLessThanOrEqual(hi);
            });
        });
      }
    });
  }
});

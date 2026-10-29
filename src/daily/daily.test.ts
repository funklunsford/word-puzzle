import { describe, expect, it } from 'vitest';
import mazeJson from '../../public/mazes.json';
import maze5Json from '../../public/mazes-5.json';
import { FIRST_STEPS, firstSteps, mustFind } from '../difficulty';
import { potRoute, walkSteps } from '../inkpots';
import { PUZZLE_SHAPES, buildGraph, classifyNeed, isObvious, routeWords, solve } from '../maze';
import { STEP_LIMIT, wordDistance } from '../strokes';
import { DAYS, DAYS_5, FIRST_STEP_FROM, LAUNCH, MUST_FIND_FROM, MUST_FIND_SHARE, PAR_RULE_FROM, dayFor, dayNumber, localDate, mustFindDay, type DailyPuzzle } from './daily';

/** 5-letter days picked while the pool's puzzles ran 15–18 strokes (2026-10-09), with that range. */
const EARLIER_FIVE: Record<string, readonly [number, number]> = { '2026-10-08': [15, 18], '2026-10-09': [15, 18] };
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

  it('keeps puzzles added ahead for their own dates (the nightly run stays two days ahead)', () => {
    const list = ['2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17'];
    expect(dayFor('2026-10-15', list)).toBe('2026-10-15');
    expect(dayFor('2026-10-16', list)).toBe('2026-10-16');
    expect(dayFor('2026-10-17', list)).toBe('2026-10-17');
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

  it('has 5-letter days from the par rule’s first date on, for the rule’s own test to check', () => {
    expect(DAYS_5.filter((d) => d >= PAR_RULE_FROM).length).toBeGreaterThan(0);
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

          // From PAR_RULE_FROM no daily has a word a player must find to make Par, but from
          // MUST_FIND_FROM a day drawn for one (mustFindDay) has one; earlier ones stay as they were.
          if (letters === 5 && day.date >= PAR_RULE_FROM)
            it(mustFindDay(day.date) ? 'has a word a player must find to make Par (a day drawn for one)' : 'has no word a player must find to make Par (4 strokes over the lowest)', () => {
              expect(mustFind(words, adj, day.puzzle).length > 0).toBe(mustFindDay(day.date));
            });

          // From FIRST_STEP_FROM every daily has easy first steps; earlier ones stay as they were.
          if (letters === 5 && day.date >= FIRST_STEP_FROM)
            it(`has at least ${FIRST_STEPS} easy first steps (words 1–2 strokes from the start)`, () => {
              expect(firstSteps(words, adj, day.puzzle).length).toBeGreaterThanOrEqual(FIRST_STEPS);
            });

          if (letters === 5)
            it('shows a route after the win whose steps add up to its best, with ink pots or without', () => {
              const charged = (steps: { cost: number }[]) => steps.reduce((t, s) => t + s.cost, 0);
              expect(charged(walkSteps(path, []))).toBe(best);
              expect(charged(walkSteps(day.inkPots.walk, day.inkPots.pots))).toBe(day.inkPots.best);
            });

          it('is labelled with what it asks of the player', () => {
            expect(classifyNeed(words, adj, start, goal, best).need).toBe(day.need);
            if (day.tricky) expect(isObvious(words, adj, start, goal, best)).toBe(false);
          });

          // The first 4-letter daily is the original puzzle, WILD → TAME (lowest 13); the rest come from the pool.
          // 5-letter days picked while the pool's puzzles ran another length keep that length.
          if (letters !== 4 || day.date !== LAUNCH)
            it("fits the pool's rules: tricky, at the game's length", () => {
              const [lo, hi] = (letters === 5 && EARLIER_FIVE[day.date]) || PUZZLE_SHAPES[letters].best;
              expect(day.tricky).toBe(true);
              expect(best).toBeGreaterThanOrEqual(lo);
              expect(best).toBeLessThanOrEqual(hi);
            });
        });
      }
    });
  }
});

describe('the days with a word a player must find to make Par', () => {
  const day = (n: number) => new Date(Date.UTC(2026, 9, 30 + n)).toISOString().slice(0, 10);

  it('are none before MUST_FIND_FROM', () => {
    for (const d of [PAR_RULE_FROM, '2026-10-29', '2025-01-01']) if (d < MUST_FIND_FROM) expect(mustFindDay(d), d).toBe(false);
  });

  it(`are about ${100 * MUST_FIND_SHARE}% of days after, never more than 6 in a row`, () => {
    const dates = Array.from({ length: 3 * 365 }, (_, i) => day(i));
    const share = dates.filter(mustFindDay).length / dates.length;
    expect(share).toBeGreaterThan(MUST_FIND_SHARE - 0.02);
    expect(share).toBeLessThan(MUST_FIND_SHARE + 0.02);
    let run = 0;
    for (const d of dates) expect((run = mustFindDay(d) ? run + 1 : 0), d).toBeLessThanOrEqual(6);
  });

  it('are drawn from the date alone, the same each time', () => {
    const dates = Array.from({ length: 60 }, (_, i) => day(i));
    expect(dates.map(mustFindDay)).toEqual(dates.map(mustFindDay));
    expect(dates.filter(mustFindDay).slice(0, 4)).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
  });
});


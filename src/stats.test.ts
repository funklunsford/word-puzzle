import { describe, expect, it } from 'vitest';
import { dailyRecord, formatTime, type Solved } from './stats';

const DAYS = ['2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10'];
const from = (results: Record<string, Solved>) => (d: string) => results[d] ?? null;

describe("a player's record over the dailies", () => {
  it('counts each day solved once, and the perfect ones', () => {
    const r = dailyRecord(DAYS, from({ '2026-10-06': { strokes: 8, best: 8 }, '2026-10-07': { strokes: 11, best: 9 } }), '2026-10-07');
    expect(r).toEqual({ solved: 2, perfect: 1, streak: 2, bestStreak: 2 });
  });

  it('breaks the streak on a day missed, and keeps the longest run', () => {
    const results = from({
      '2026-10-06': { strokes: 9, best: 9 },
      '2026-10-07': { strokes: 10, best: 9 },
      '2026-10-09': { strokes: 9, best: 9 },
    });
    expect(dailyRecord(DAYS, results, '2026-10-09')).toEqual({ solved: 3, perfect: 2, streak: 1, bestStreak: 2 });
  });

  it('ignores days after the one being played', () => {
    const results = from({ '2026-10-06': { strokes: 9, best: 9 }, '2026-10-10': { strokes: 9, best: 9 } });
    expect(dailyRecord(DAYS, results, '2026-10-08')).toEqual({ solved: 1, perfect: 1, streak: 0, bestStreak: 1 });
  });

  it("keeps the run up to the day before while that day isn't solved yet", () => {
    const results = from({ '2026-10-06': { strokes: 9, best: 9 }, '2026-10-07': { strokes: 9, best: 9 } });
    expect(dailyRecord(DAYS, results, '2026-10-08')).toEqual({ solved: 2, perfect: 2, streak: 2, bestStreak: 2 });
    // Once it is, the run goes on through it.
    const more = from({ '2026-10-06': { strokes: 9, best: 9 }, '2026-10-07': { strokes: 9, best: 9 }, '2026-10-08': { strokes: 10, best: 9, on: '2026-10-08' } });
    expect(dailyRecord(DAYS, more, '2026-10-08')).toEqual({ solved: 3, perfect: 2, streak: 3, bestStreak: 3 });
  });
});

describe('a daily solved on a later day (Past puzzles)', () => {
  it('counts as solved, and an Ace, but not towards a streak', () => {
    // On the day, late, on the day: no run of three, nor of two.
    const results = from({
      '2026-10-06': { strokes: 9, best: 9, on: '2026-10-06' },
      '2026-10-07': { strokes: 9, best: 9, on: '2026-10-10' },
      '2026-10-08': { strokes: 9, best: 9, on: '2026-10-08' },
    });
    expect(dailyRecord(DAYS, results, '2026-10-08')).toEqual({ solved: 3, perfect: 3, streak: 1, bestStreak: 1 });
  });

  it("breaks the run as a day missed would, and doesn't start today's streak", () => {
    const results = from({
      '2026-10-07': { strokes: 9, best: 9, on: '2026-10-07' },
      '2026-10-08': { strokes: 9, best: 9, on: '2026-10-08' },
      '2026-10-09': { strokes: 11, best: 9, on: '2026-10-10' },
      '2026-10-10': { strokes: 9, best: 9, on: '2026-10-10' },
    });
    expect(dailyRecord(DAYS, results, '2026-10-10')).toEqual({ solved: 4, perfect: 3, streak: 1, bestStreak: 2 });
    // Solving yesterday's today leaves today's streak where it was: none, until today's is solved.
    const late = from({ '2026-10-09': { strokes: 9, best: 9, on: '2026-10-10' } });
    expect(dailyRecord(DAYS, late, '2026-10-10')).toEqual({ solved: 1, perfect: 1, streak: 0, bestStreak: 0 });
  });

  it('counts a result kept before the date was as solved on the day', () => {
    const results = from({ '2026-10-06': { strokes: 9, best: 9 }, '2026-10-07': { strokes: 9, best: 9 }, '2026-10-08': { strokes: 9, best: 9, on: '2026-10-08' } });
    expect(dailyRecord(DAYS, results, '2026-10-08')).toEqual({ solved: 3, perfect: 3, streak: 3, bestStreak: 3 });
  });
});

describe('times', () => {
  it('reads as m:ss, and h:mm:ss from an hour', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(65.4)).toBe('1:05');
    expect(formatTime(3725)).toBe('1:02:05');
  });
});

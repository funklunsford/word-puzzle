import { describe, expect, it } from 'vitest';
import { addMonths, monthGrid, pastDays, todaysDaily } from './archive';
import { DAYS_5 } from './daily/daily';
import { easyDays } from './easycore';
import type { Solved } from './stats';

const DAYS = ['2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11'];
const none = () => null;

describe("Past puzzles' list", () => {
  it('is newest first, from today\'s, with nothing still to come', () => {
    const days = pastDays(DAYS, '2026-10-10', none, () => false);
    expect(days.map((d) => d.date)).toEqual(['2026-10-10', '2026-10-09', '2026-10-08', '2026-10-07']);
    expect(days.map((d) => d.number)).toEqual([5, 4, 3, 2]);
    expect(days.map((d) => d.today)).toEqual([true, false, false, false]);
  });

  it('says how each went: not played, part-way, solved, or an Ace', () => {
    const results: Record<string, Solved> = { '2026-10-08': { strokes: 15, best: 13 }, '2026-10-09': { strokes: 13, best: 13, on: '2026-10-10' }, '2026-10-10': { strokes: 14, best: 13 } };
    const started = new Set(['2026-10-07', '2026-10-10']);
    const days = pastDays(DAYS, '2026-10-10', (d) => results[d] ?? null, (d) => started.has(d));
    expect(days.map(({ date, how, strokes }) => [date, how, strokes])).toEqual([
      // Solved, and being played again: its result.
      ['2026-10-10', 'solved', 14],
      ['2026-10-09', 'ace', 13],
      ['2026-10-08', 'solved', 15],
      ['2026-10-07', 'started', undefined],
    ]);
  });
});

describe("today's daily", () => {
  it('is the latest up to the date (Easycore has one every date)', () => {
    const last = DAYS_5[DAYS_5.length - 1];
    expect(todaysDaily(DAYS_5[3], 5, false)).toBe(DAYS_5[3]);
    expect(todaysDaily('2099-01-01', 5, false)).toBe(last);
    expect(todaysDaily('2099-01-01', 5, true)).toBe('2099-01-01');
  });

  it("lists Easycore's every date up to today's", () => {
    const days = pastDays(easyDays('2026-10-26'), todaysDaily('2026-10-26', 5, true), none, () => false);
    expect(days.length).toBe(21);
    expect(days[0]).toMatchObject({ date: '2026-10-26', number: 21, today: true, how: 'new' });
    expect(days[20]).toMatchObject({ date: '2026-10-06', number: 1 });
  });
});

describe("the calendar's months", () => {
  it('lays a month out a week a row from Sunday, filling the first and last weeks', () => {
    // October 2026 starts on a Thursday and ends on a Saturday.
    const october = monthGrid('2026-10');
    expect(october.length).toBe(35);
    expect(october.slice(0, 5)).toEqual([null, null, null, null, '2026-10-01']);
    expect(october.at(-1)).toBe('2026-10-31');
    // November 2026 starts on a Sunday; February 2027 fills exactly four weeks.
    expect(monthGrid('2026-11')[0]).toBe('2026-11-01');
    expect(monthGrid('2026-11').slice(29)).toEqual(['2026-11-30', null, null, null, null, null]);
    expect(monthGrid('2027-02')).toHaveLength(28);
    expect(monthGrid('2028-02').filter(Boolean)).toHaveLength(29);
  });

  it('turns months over the years', () => {
    expect(addMonths('2026-10', 1)).toBe('2026-11');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2027-01', -1)).toBe('2026-12');
    expect(addMonths('2026-10', -10)).toBe('2025-12');
  });
});


import { afterEach, describe, expect, it, vi } from 'vitest';
import poolText from '../public/pool-5-easy.json?raw';
import { DAYS_5, LAUNCH, dayNumber } from './daily/daily';
import { easyDayFor, easyDays, easyIndex, isEasyDay, loadDifficulty, saveDifficulty } from './easycore';
import { dailyRecord, resultKey, type Solved } from './stats';

/** A localStorage that keeps its items in a map (or one that throws, as when blocked). */
function storage(items = new Map<string, string>()) {
  vi.stubGlobal('localStorage', { getItem: (k: string) => items.get(k) ?? null, setItem: (k: string, v: string) => items.set(k, v) });
  return items;
}
const blocked = () => {
  throw new Error('blocked');
};

describe('the difficulty setting', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is Classic until chosen, and remembered in this browser', () => {
    const items = storage();
    expect(loadDifficulty()).toBe('classic');
    saveDifficulty('easy');
    expect(items.get('strokes:difficulty')).toBe('easy');
    expect(loadDifficulty()).toBe('easy');
    saveDifficulty('hard');
    expect(loadDifficulty()).toBe('hard');
  });

  it('starts as Hardcore for a player who had the Hardcore switch on, and keeps the switch in step', () => {
    const items = storage(new Map([['strokes:hardcore', '1']]));
    expect(loadDifficulty()).toBe('hard');
    storage(new Map([['strokes:hardcore', '0']]));
    expect(loadDifficulty()).toBe('classic');
    // Once chosen, the setting wins, and the old switch says the same.
    storage(items);
    saveDifficulty('easy');
    expect(items.get('strokes:hardcore')).toBe('0');
    expect(loadDifficulty()).toBe('easy');
    saveDifficulty('hard');
    expect(items.get('strokes:hardcore')).toBe('1');
  });

  it('ignores a value it does not know, and is Classic when storage is blocked', () => {
    storage(new Map([['strokes:difficulty', 'nightmare']]));
    expect(loadDifficulty()).toBe('classic');
    vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked });
    expect(loadDifficulty()).toBe('classic');
    expect(() => saveDifficulty('easy')).not.toThrow();
  });
});

/** The date `n` days after LAUNCH. */
const day = (n: number) => new Date(Date.parse(`${LAUNCH}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

describe("Easycore's daily", () => {
  const size = 1100;

  it('picks the same puzzle for a date every time', () => {
    expect(easyIndex('2026-10-22', size)).toBe(easyIndex('2026-10-22', size));
    expect(easyIndex('2027-03-01', 40)).toBe(easyIndex('2027-03-01', 40));
  });

  it('plays every puzzle in the pool once before any comes back, in a new order each time round', () => {
    const round = (k: number) => Array.from({ length: size }, (_, i) => easyIndex(day(k * size + i), size));
    const first = round(0);
    expect(new Set(first).size).toBe(size);
    expect(Math.min(...first)).toBe(0);
    expect(Math.max(...first)).toBe(size - 1);
    const second = round(1);
    expect(new Set(second).size).toBe(size);
    expect(second).not.toEqual(first);
  });

  it('is numbered like the classic daily, and has a puzzle for every date from the first', () => {
    expect(easyDayFor('2026-10-22')).toBe('2026-10-22');
    expect(easyDayFor('2026-09-30')).toBe(LAUNCH);
    expect(isEasyDay('2026-10-22')).toBe(true);
    expect(isEasyDay(LAUNCH)).toBe(true);
    for (const date of ['2026-10-05', '2027-02-30', '2026-10-2', 'today']) expect(isEasyDay(date), date).toBe(false);
    const days = easyDays('2026-11-02');
    expect(days[0]).toBe(LAUNCH);
    expect(days.at(-1)).toBe('2026-11-02');
    // One a day, through the clocks changing on 1 November.
    expect(days.length).toBe(dayNumber('2026-11-02'));
    expect(days).toContain('2026-11-01');
  });

  it("keeps each date's puzzle while the pool stays as it is (rebuilding the pool changes every day)", () => {
    const { puzzles } = JSON.parse(poolText) as { puzzles: { puzzle: { start: string; goal: string } }[] };
    const on = (date: string) => puzzles[easyIndex(date, puzzles.length)].puzzle;
    expect(puzzles.length).toBe(size);
    expect(on('2026-10-22')).toMatchObject({ start: 'CREAM', goal: 'TREAD' });
    expect(on(LAUNCH)).toMatchObject({ start: 'DINED', goal: 'TIMER' });
  });
});

describe("Easycore's results and record", () => {
  afterEach(() => vi.unstubAllGlobals());

  it('are kept apart from the classic daily of the same date', () => {
    expect(resultKey('2026-10-22', 5, true)).toBe('strokes:result5e:2026-10-22');
    expect(resultKey('2026-10-22', 5)).toBe('strokes:result5:2026-10-22');
    expect(resultKey('2026-10-22', 4)).toBe('strokes:result:2026-10-22');
  });

  it('count only Easycore results in its record, and only classic ones in the classic record', () => {
    const items = storage();
    const keep = (key: string, r: Solved) => items.set(key, JSON.stringify(r));
    // Easycore solved on the 20th, 21st and 22nd (an ace on the 22nd); the classic daily on the 21st only.
    for (const date of ['2026-10-20', '2026-10-21']) keep(resultKey(date, 5, true), { strokes: 7, best: 6 });
    keep(resultKey('2026-10-22', 5, true), { strokes: 6, best: 6 });
    keep(resultKey('2026-10-21', 5), { strokes: 13, best: 13 });
    const read = (easy: boolean) => (date: string) => JSON.parse(localStorage.getItem(resultKey(date, 5, easy)) ?? 'null') as Solved | null;
    expect(dailyRecord(easyDays('2026-10-22'), read(true), '2026-10-22')).toEqual({ solved: 3, perfect: 1, streak: 3, bestStreak: 3 });
    expect(dailyRecord(DAYS_5, read(false), '2026-10-22')).toEqual({ solved: 1, perfect: 1, streak: 0, bestStreak: 1 });
  });
});

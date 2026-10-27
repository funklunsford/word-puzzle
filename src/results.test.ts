import { afterEach, describe, expect, it, vi } from 'vitest';
import { DAYS_5, localDate } from './daily/daily';
import { keepWin, loadResult, type Result } from './results';

/** A localStorage that keeps its items in a map. */
function storage(items = new Map<string, string>()) {
  vi.stubGlobal('localStorage', { getItem: (k: string) => items.get(k) ?? null, setItem: (k: string, v: string) => items.set(k, v) });
  return items;
}

const win = (strokes: number, hints = 0): Result => ({ strokes, best: 5, hints, hardcore: false, steps: [{ from: 'JUICE', to: 'JUDGE', cost: 2 }], seconds: 40 });
/** Noon on a day with a 5-letter daily. */
const day = DAYS_5[DAYS_5.length - 1];
const noon = new Date(`${day}T12:00:00`);

describe('what a win keeps', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('keeps nothing for the sample puzzle: no result, record or done mark', () => {
    const items = storage();
    expect(keepWin({ sample: true }, 5, win(5), noon)).toBeNull();
    // Even were it ever given a date, the sample keeps nothing.
    expect(keepWin({ sample: true, date: day }, 5, win(5), noon)).toBeNull();
    expect([...items.keys()]).toEqual([]);
  });

  it("keeps today's daily, with the Puzzle Playlist's done mark", () => {
    const items = storage();
    expect(localDate(noon)).toBe(day);
    expect(keepWin({ date: day }, 5, win(14), noon)?.strokes).toBe(14);
    expect(loadResult(day, 5)?.strokes).toBe(14);
    expect(items.has(`puzzle-done:strokes:${day}`)).toBe(true);
    // A worse play keeps the better one; a better one replaces it.
    expect(keepWin({ date: day }, 5, win(16), noon)).toBeNull();
    expect(keepWin({ date: day }, 5, win(13), noon)?.strokes).toBe(13);
    expect(loadResult(day, 5)?.strokes).toBe(13);
  });

  it("keeps an Easycore daily apart, and an earlier day's without the done mark", () => {
    const items = storage();
    keepWin({ date: day, easy: true }, 5, win(6), noon);
    expect(items.has(`strokes:result5e:${day}`)).toBe(true);
    expect(items.has(`strokes:result5:${day}`)).toBe(false);
    const earlier = storage();
    keepWin({ date: DAYS_5[0] }, 5, win(15), noon);
    expect([...earlier.keys()]).toEqual([`strokes:result5:${DAYS_5[0]}`]);
  });

  it('keeps the date it was solved on: today, for an earlier day too', () => {
    storage();
    expect(keepWin({ date: day }, 5, win(14), noon)?.on).toBe(day);
    expect(loadResult(day, 5)?.on).toBe(day);
    keepWin({ date: DAYS_5[0] }, 5, win(15), noon);
    expect(loadResult(DAYS_5[0], 5)?.on).toBe(day);
  });

  it('keeps the first date when a later play betters it, so a solve on the day stays one', () => {
    const items = storage();
    const first = DAYS_5[0];
    keepWin({ date: first }, 5, win(15), new Date(`${first}T20:00:00`));
    expect(keepWin({ date: first }, 5, win(13), noon)?.on).toBe(first);
    expect(loadResult(first, 5)).toMatchObject({ strokes: 13, on: first });
    // A result kept before the date was counts as on the day, and still does once bettered.
    items.set(`strokes:result5:${DAYS_5[1]}`, JSON.stringify({ ...win(15), on: undefined }));
    expect(loadResult(DAYS_5[1], 5)?.on).toBeUndefined();
    expect(keepWin({ date: DAYS_5[1] }, 5, win(12), noon)?.on).toBe(DAYS_5[1]);
  });

  it("leaves out a kept date that isn't one", () => {
    const items = storage();
    items.set(`strokes:result5:${day}`, JSON.stringify({ ...win(14), on: 'yesterday' }));
    expect(loadResult(day, 5)).not.toHaveProperty('on');
    items.set(`strokes:result5:${day}`, JSON.stringify({ ...win(14), on: 20261026 }));
    expect(loadResult(day, 5)).not.toHaveProperty('on');
  });

  it('keeps nothing for a pool puzzle', () => {
    const items = storage();
    expect(keepWin({}, 5, win(9), noon)).toBeNull();
    expect(items.size).toBe(0);
  });
});

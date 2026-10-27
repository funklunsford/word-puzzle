import { afterEach, describe, expect, it, vi } from 'vitest';
import { LETTERS, type Placement } from './glyphs';
import { clearProgress, hasProgress, loadProgress, parseProgress, progressKey, saveProgress, type Progress, type SaveOf } from './progress';

/** A localStorage that keeps its items in a map. */
function storage(items = new Map<string, string>()) {
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => items.get(k) ?? null,
    setItem: (k: string, v: string) => items.set(k, v),
    removeItem: (k: string) => items.delete(k),
  });
  return items;
}
const blocked = () => {
  throw new Error('blocked');
};

const cellsFor = (word: string): Placement[][] => [...word].map((ch) => LETTERS[ch].parts.map((p) => ({ ...p })));
const of: SaveOf = { key: progressKey('2026-10-16', 5, 'classic'), start: 'JUICE', goal: 'FUDGE', best: 5, inkPots: false };

/** Two strokes into the sample's second step: JUDGE made (2), the J's curve off, a hint asked. */
function game(): Progress {
  const judge = cellsFor('JUDGE');
  const off = judge.map((cell, i) => (i === 0 ? cell.slice(1) : cell));
  return {
    room: 'JUDGE',
    cells: off,
    history: [judge],
    trail: [
      { word: 'JUICE', cost: 0 },
      { word: 'JUDGE', cost: 2, used: 0, from: 'JUICE', moves: [{ kind: 'add', at: 2 }, { kind: 'add', at: 3 }] },
    ],
    spent: 2,
    backs: 0,
    ink: 0,
    hintsUsed: 1,
    hint: { room: 'JUDGE', level: 1, step: { next: 'FUDGE', cost: 3, remaining: 3, letters: [0] }, meaning: 'a sweet' },
    seconds: 42.5,
  };
}
/** The game as kept: with what it's of. */
const kept = (p: object = game()) => ({ start: of.start, goal: of.goal, best: of.best, inkPots: of.inkPots, ...p });

describe('where a game part-way is kept', () => {
  it('is one per date and difficulty, apart from the results', () => {
    expect(progressKey('2026-10-16', 5, 'classic')).toBe('strokes:progress5:2026-10-16');
    expect(progressKey('2026-10-16', 5, 'hard')).toBe('strokes:progress5h:2026-10-16');
    expect(progressKey('2026-10-16', 5, 'easy')).toBe('strokes:progress5e:2026-10-16');
    expect(progressKey('2026-10-16', 4, 'classic')).toBe('strokes:progress:2026-10-16');
  });
});

describe('saving and loading a game', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('carries on exactly where it was', () => {
    const items = storage();
    saveProgress(of, game());
    expect(JSON.parse(items.get(of.key)!)).toMatchObject({ start: 'JUICE', goal: 'FUDGE', best: 5, inkPots: false, room: 'JUDGE' });
    expect(loadProgress(of)).toEqual(game());
    expect(hasProgress(of.key)).toBe(true);
  });

  it('clears it (a win, or Restart)', () => {
    const items = storage();
    saveProgress(of, game());
    clearProgress(of.key);
    expect(items.size).toBe(0);
    expect(loadProgress(of)).toBeNull();
    expect(hasProgress(of.key)).toBe(false);
  });

  it('keeps nothing, and finds nothing, with storage blocked', () => {
    vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked, removeItem: blocked });
    expect(() => saveProgress(of, game())).not.toThrow();
    expect(() => clearProgress(of.key)).not.toThrow();
    expect(loadProgress(of)).toBeNull();
    expect(hasProgress(of.key)).toBe(false);
  });

  it("drops a save that isn't JSON, or isn't an object", () => {
    const items = storage();
    for (const junk of ['{', 'null', '42', '"JUDGE"', '[]']) {
      items.set(of.key, junk);
      expect(loadProgress(of)).toBeNull();
    }
    items.set(of.key, '{');
    expect(hasProgress(of.key)).toBe(false);
  });
});

describe('checking a kept game', () => {
  it('takes a sound one, a fresh step and no hint or clock too', () => {
    expect(parseProgress(kept(), of)).toEqual(game());
    const fresh = { ...game(), cells: cellsFor('JUDGE'), history: [], hint: null, seconds: null };
    expect(parseProgress(kept(fresh), of)).toEqual(fresh);
  });

  it('drops one of another puzzle, or of the same one with ink pots the other way', () => {
    expect(parseProgress(kept(), { ...of, goal: 'FUDGY' })).toBeNull();
    expect(parseProgress(kept(), { ...of, start: 'JUICY' })).toBeNull();
    expect(parseProgress(kept(), { ...of, best: 6 })).toBeNull();
    expect(parseProgress(kept(), { ...of, inkPots: true })).toBeNull();
  });

  it('drops one missing a field, or with a field that makes no sense', () => {
    const { hint: _hint, ...noHint } = game();
    expect(parseProgress(kept(noHint), of)).toBeNull();
    const bad: Record<string, unknown>[] = [
      { room: 'JUDG' },
      { room: 'judge' },
      { cells: game().cells.slice(1) },
      { cells: [[{ tile: 'X', x: 0, y: 1 }], [], [], [], []] },
      { cells: [[{ tile: 'LV', x: 'one', y: 1 }], [], [], [], []] },
      { cells: [[{ tile: 'LV', x: 0, y: 1, look: { len: 0.5, keep: 'middle' } }], [], [], [], []] },
      { history: [cellsFor('JUDGE'), cellsFor('JUDGE'), cellsFor('JUDGE'), cellsFor('JUDGE')] },
      { history: 'none' },
      { trail: [] },
      { trail: [{ word: 'JUICE', cost: -1 }] },
      { trail: [{ word: 'JUICE', cost: 0 }, { word: 'JUDGE', cost: 2, moves: [{ kind: 'jump', at: 0 }] }] },
      { spent: 1.5 },
      { backs: -1 },
      { ink: '1' },
      { hintsUsed: null },
      { hint: { room: 'JUDGE', level: 4, step: null, meaning: null } },
      { hint: { room: 'JUDGE', level: 2, step: { next: 'FUDGE', cost: 3, remaining: 3, letters: [7] }, meaning: null } },
      { seconds: -3 },
      { seconds: 'soon' },
    ];
    for (const change of bad) expect(parseProgress(kept({ ...game(), ...change }), of), JSON.stringify(change)).toBeNull();
  });

  it("drops one that doesn't add up as a game", () => {
    const g = game();
    // Not from the start; a word twice; in a word not on the path; already at the goal; strokes that don't add up.
    expect(parseProgress(kept({ ...g, trail: g.trail.slice(1), room: 'JUDGE', spent: 2 }), of)).toBeNull();
    expect(parseProgress(kept({ ...g, trail: [...g.trail, { word: 'JUDGE', cost: 0 }] }), of)).toBeNull();
    expect(parseProgress(kept({ ...g, room: 'JUICY' }), of)).toBeNull();
    expect(parseProgress(kept({ ...g, room: 'FUDGE', trail: [...g.trail, { word: 'FUDGE', cost: 3 }], spent: 5 }), of)).toBeNull();
    expect(parseProgress(kept({ ...g, spent: 3 }), of)).toBeNull();
  });
});

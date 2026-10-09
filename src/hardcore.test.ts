import { afterEach, describe, expect, it, vi } from 'vitest';
import { hardcoreLocked, loadHardcore, saveHardcore } from './hardcore';

describe('the hardcore switch', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('can be changed before the puzzle starts', () => {
    expect(hardcoreLocked({ words: 0, strokes: 0, hints: 0 })).toBe(false);
  });

  it('locks with the first stroke, the first word, or a hint', () => {
    expect(hardcoreLocked({ words: 0, strokes: 1, hints: 0 })).toBe(true);
    expect(hardcoreLocked({ words: 1, strokes: 0, hints: 0 })).toBe(true);
    expect(hardcoreLocked({ words: 0, strokes: 0, hints: 1 })).toBe(true);
    // A won game has made its words.
    expect(hardcoreLocked({ words: 5, strokes: 0, hints: 0 })).toBe(true);
  });

  it('unlocks again once the first step is undone or reset, with no word made', () => {
    // (Undo and Reset take this step's strokes back; Restart takes everything back.)
    expect(hardcoreLocked({ words: 0, strokes: 0, hints: 0 })).toBe(false);
    expect(hardcoreLocked({ words: 1, strokes: 0, hints: 0 })).toBe(true);
  });

  it('is remembered in this browser, under its old key, and off when storage is blocked', () => {
    const items = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => items.get(k) ?? null, setItem: (k: string, v: string) => items.set(k, v) });
    expect(loadHardcore()).toBe(false);
    saveHardcore(true);
    expect(items.get('strokes:hardcore')).toBe('1');
    expect(loadHardcore()).toBe(true);
    saveHardcore(false);
    expect(loadHardcore()).toBe(false);
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    expect(loadHardcore()).toBe(false);
    expect(() => saveHardcore(true)).not.toThrow();
  });
});

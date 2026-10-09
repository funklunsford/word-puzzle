import { afterEach, describe, expect, it, vi } from 'vitest';
import { hasStarted, loadHardcore, saveHardcore } from './hardcore';

describe('the hardcore switch', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('turns on without starting over before the puzzle has started', () => {
    expect(hasStarted({ words: 0, strokes: 0, hints: 0 })).toBe(false);
  });

  it('starts the puzzle over once there is a stroke on the board, a word made, or a hint taken', () => {
    expect(hasStarted({ words: 0, strokes: 1, hints: 0 })).toBe(true);
    expect(hasStarted({ words: 1, strokes: 0, hints: 0 })).toBe(true);
    expect(hasStarted({ words: 0, strokes: 0, hints: 1 })).toBe(true);
    // A won game has made its words.
    expect(hasStarted({ words: 5, strokes: 0, hints: 0 })).toBe(true);
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

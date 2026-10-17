import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PREFS, loadPrefs } from './prefs';

/** This browser's storage, holding `saved` as the settings (or nothing). */
function storage(saved?: object) {
  const items = new Map<string, string>(saved ? [['strokes:prefs', JSON.stringify(saved)]] : []);
  vi.stubGlobal('localStorage', { getItem: (k: string) => items.get(k) ?? null, setItem: (k: string, v: string) => items.set(k, v) });
}

describe('settings', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('ships with the letter guide off, and definitions on', () => {
    storage();
    expect(loadPrefs()).toEqual(DEFAULT_PREFS);
    expect(loadPrefs().letters).toBe(false);
    expect(loadPrefs().definitions).toBe(true);
  });

  it('keeps a letter guide saved on (saving any setting stored it), and one saved off', () => {
    storage({ motion: 'less', letters: true, definitions: true, colorBlind: false });
    expect(loadPrefs()).toMatchObject({ motion: 'less', letters: true });
    storage({ letters: false });
    expect(loadPrefs().letters).toBe(false);
  });

  it('ships with Earth stroke colours, and keeps a palette saved, but not one it doesn\'t know', () => {
    storage();
    expect(loadPrefs().palette).toBe('earth');
    storage({ palette: 'clear' });
    expect(loadPrefs().palette).toBe('clear');
    storage({ palette: 'neon', motion: 'less' });
    expect(loadPrefs()).toMatchObject({ palette: 'earth', motion: 'less' });
  });

  it('falls back to the defaults when storage is blocked', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
    });
    expect(loadPrefs()).toEqual(DEFAULT_PREFS);
  });
});

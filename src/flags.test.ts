import { afterEach, describe, expect, it, vi } from 'vitest';
import { FLAGS, loadFlags } from './flags';

const defaults = Object.fromEntries(Object.entries(FLAGS).map(([k, v]) => [k, v.on]));

/** A page at `search`, with `saved` as this browser's stored flags (or none). */
function page(search: string, saved?: object) {
  vi.stubGlobal('location', { search });
  vi.stubGlobal('localStorage', { getItem: (k: string) => (k === 'strokes:flags' && saved ? JSON.stringify(saved) : null), setItem: () => {} });
}

describe('feature flags', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('are their defaults on the live site, whatever a link or this browser says', () => {
    page('?flags=freshPuzzle,-easycore,ads', { inkPots: true, fiveLetters: false });
    expect(loadFlags(false)).toEqual(defaults);
  });

  it('can be set in development, by a link or the Dev section', () => {
    page('?flags=freshPuzzle,-easycore', { inkPots: true });
    expect(loadFlags(true)).toEqual({ ...defaults, freshPuzzle: true, easycore: false, inkPots: true });
  });
});

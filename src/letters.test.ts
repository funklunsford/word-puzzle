import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESKTOP_MIN, chooseLetters, loadLetters } from './letters';

describe('which game a visit plays', () => {
  it('gives a wide window with a mouse or trackpad the 5-letter game', () => {
    expect(chooseLetters({ fine: true, width: 1280, asked: null })).toBe(5);
    expect(chooseLetters({ fine: true, width: DESKTOP_MIN, asked: null })).toBe(5);
  });

  it('keeps phones, tablets and narrow windows on 4 letters', () => {
    expect(chooseLetters({ fine: false, width: 390, asked: null })).toBe(4); // a phone
    expect(chooseLetters({ fine: false, width: 1366, asked: null })).toBe(4); // a tablet in landscape
    expect(chooseLetters({ fine: true, width: DESKTOP_MIN - 1, asked: null })).toBe(4); // a narrow desktop window
  });

  it('lets ?letters= choose either, for testing', () => {
    expect(chooseLetters({ fine: false, width: 390, asked: '5' })).toBe(5);
    expect(chooseLetters({ fine: true, width: 1280, asked: '4' })).toBe(4);
    expect(chooseLetters({ fine: true, width: 1280, asked: '6' })).toBe(5);
  });

  it('gives phones and tablets 5 letters too when the fiveLetters flag is on, though ?letters= still wins', () => {
    expect(chooseLetters({ fine: false, width: 390, asked: null, everywhere: true })).toBe(5); // a phone
    expect(chooseLetters({ fine: false, width: 1366, asked: null, everywhere: true })).toBe(5); // a tablet
    expect(chooseLetters({ fine: true, width: 1280, asked: null, everywhere: true })).toBe(5);
    expect(chooseLetters({ fine: false, width: 390, asked: '4', everywhere: true })).toBe(4);
  });

  describe('the address', () => {
    afterEach(() => vi.unstubAllGlobals());
    /** A phone at `search`. */
    const phone = (search: string) => {
      vi.stubGlobal('window', { matchMedia: () => ({ matches: false }), innerWidth: 390 });
      vi.stubGlobal('location', { search });
    };

    it('is ignored on the live site: ?letters=4 still plays the 5-letter game', () => {
      phone('?letters=4');
      expect(loadLetters(true, false)).toBe(5);
    });

    it('chooses the game in development', () => {
      phone('?letters=4');
      expect(loadLetters(true, true)).toBe(4);
    });
  });
});

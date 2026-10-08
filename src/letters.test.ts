import { describe, expect, it } from 'vitest';
import { DESKTOP_MIN, chooseLetters } from './letters';

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
});

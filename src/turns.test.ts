import { describe, expect, it } from 'vitest';
import { TRAY_TURN } from './glyphs';
import { restingTurn } from './turns';

describe('which way a stroke lands when nothing turns it', () => {
  it("lands an arc carried out of a letter into an empty one as a C, the way the tray starts it", () => {
    // D's arc is reversed (180); an empty letter takes the arc either way round.
    expect(restingTurn({ ways: [0, 180], held: 180, tile: 'C', fromLetter: true, intoEmpty: true })).toBe(TRAY_TURN.C);
  });

  it('otherwise lands it the way it is held', () => {
    // From the tray, turned reversed there: it stays reversed.
    expect(restingTurn({ ways: [0, 180], held: 180, tile: 'C', fromLetter: false, intoEmpty: true })).toBe(180);
    // Into a letter that already has strokes (the bowl under a lone stem, as B's or U's).
    expect(restingTurn({ ways: [0, 90], held: 90, tile: 'P', fromLetter: true, intoEmpty: false })).toBe(90);
    // A chevron from W into an empty letter is already a V, the tray's way.
    expect(restingTurn({ ways: [0, 180], held: 0, tile: 'BV', fromLetter: true, intoEmpty: true })).toBe(0);
  });
});

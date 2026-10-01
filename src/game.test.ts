import { describe, expect, it } from 'vitest';
import { LETTERS, TILE_IDS, recipe } from './glyphs';
import { CHARGES, PANGRAM_BONUS, check, newGame, play, playableLetters, remainingWords, strokeCount, tilesFor, type Board } from './game';

// A tiny hand-made board so tests don't depend on the word list.
const board: Board = {
  id: 'test',
  tiles: ['LV', 'H', 'P', 'SB', 'SV'],
  center: 'LV',
  spicy: 'H',
  pangrams: ['BLURT'],
  words: ['BLURT', 'BELT', 'BELL', 'FILE', 'TILE', 'PILE', 'BIBB', 'FIFE'],
};

describe('glyphs', () => {
  it('defines all 26 letters using only known tiles', () => {
    expect(Object.keys(LETTERS)).toHaveLength(26);
    for (const g of Object.values(LETTERS)) for (const part of g.parts) expect(TILE_IDS).toContain(part.tile);
  });

  it('derives recipes from placements', () => {
    expect(Object.fromEntries(recipe('E'))).toEqual({ LV: 1, H: 3 });
    expect(Object.fromEntries(recipe('O'))).toEqual({ C: 2 });
  });

  it('has no tile that only ever appears alongside another tile', () => {
    for (const t of TILE_IDS) {
      const letters = Object.keys(LETTERS).filter((ch) => recipe(ch).has(t));
      const always = TILE_IDS.filter((o) => o !== t && letters.every((ch) => recipe(ch).has(o)));
      expect(always, t).toEqual([]);
    }
  });
});

describe('game', () => {
  it('counts strokes and tiles', () => {
    expect(strokeCount('BEE')).toBe(3 + 4 + 4);
    expect([...tilesFor('BEE')].sort()).toEqual(['H', 'LV', 'P']);
  });

  it('greys out letters the board cannot build', () => {
    const letters = playableLetters(board.tiles);
    expect(letters.has('B')).toBe(true);
    expect(letters.has('O')).toBe(false);
  });

  it('rejects bad words with a reason', () => {
    const s = newGame(board);
    expect(check(s, board, 'BEL')).toMatchObject({ ok: false, reason: expect.stringContaining('4') });
    expect(check(s, board, 'OBOE')).toMatchObject({ ok: false });
    expect(check(s, board, 'BLEB')).toMatchObject({ ok: false, reason: 'Not in word list' });
  });

  it('charges one per tile per word, regardless of repeats', () => {
    const r = play(newGame(board), board, 'BELL');
    if ('error' in r) throw new Error(r.error);
    expect(r.state.charges.H).toBe(CHARGES - 1);
    expect(r.state.charges.P).toBe(CHARGES - 1);
    expect(r.state.charges.LV).toBeUndefined(); // center is unlimited
  });

  it('doubles for spicy, doubles again for smush, adds pangram bonus', () => {
    const s = newGame(board);
    s.charges.SB = 1;
    s.spicy = 'H';
    const r = play(s, board, 'BLURT');
    if ('error' in r) throw new Error(r.error);
    const base = strokeCount('BLURT');
    expect(r.play).toMatchObject({ base, spicy: true, smushed: ['SB'], pangram: true });
    expect(r.play.score).toBe(base * 4 + PANGRAM_BONUS);
  });

  it('moves the spicy tile and skips the center and smushed tiles', () => {
    const s = newGame(board);
    s.charges.P = 0;
    const r = play(s, board, 'TILE');
    if ('error' in r) throw new Error(r.error);
    expect(r.state.spicy).toBe('SB'); // H -> (P smushed) -> SB
  });

  it('blocks words that need a smushed tile and drops them from remaining', () => {
    const s = newGame(board);
    s.charges.P = 0;
    expect(check(s, board, 'PILE')).toMatchObject({ ok: false });
    expect(remainingWords(s, board)).not.toContain('PILE');
    expect(remainingWords(s, board)).toContain('TILE');
  });
});

import { describe, expect, it } from 'vitest';
import { LETTERS, TILE_IDS, recipe } from './glyphs';
import { PANGRAM_BONUS, check, newGame, play, playableLetters, remainingWords, strokeCount, tilesFor, type Board } from './game';

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

  it('doubles for spicy and adds the pangram bonus', () => {
    const r = play(newGame(board), board, 'BLURT');
    if ('error' in r) throw new Error(r.error);
    const base = strokeCount('BLURT');
    expect(r.play).toMatchObject({ base, spicy: true, pangram: true });
    expect(r.play.score).toBe(base * 2 + PANGRAM_BONUS);
  });

  it('moves the spicy tile through non-center tiles', () => {
    const r = play(newGame(board), board, 'TILE');
    if ('error' in r) throw new Error(r.error);
    expect(r.state.spicy).toBe('P'); // H -> P (LV is the center)
  });

  it('rejects repeats and tracks remaining words', () => {
    const r = play(newGame(board), board, 'TILE');
    if ('error' in r) throw new Error(r.error);
    expect(check(r.state, board, 'TILE')).toMatchObject({ ok: false, reason: 'Already found' });
    expect(remainingWords(r.state, board)).not.toContain('TILE');
  });
});

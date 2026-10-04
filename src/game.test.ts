import { describe, expect, it } from 'vitest';
import { LETTERS, TILE_IDS, drawnWidth, recipe, xExtent, type Placement } from './glyphs';
import { lookCenterline, strokeCenterline } from './ink';
import { PANGRAM_BONUS, check, newGame, play, playableLetters, remainingWords, strokeCount, tilesFor, type Board } from './game';

// A tiny hand-made board so tests don't depend on the word list.
const board: Board = {
  id: 'test',
  tiles: ['LV', 'H', 'P', 'SB'],
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

  it('builds G, J, U and Y from strokes everyday letters use (the long bar, the bar, the bowl)', () => {
    expect(Object.fromEntries(recipe('U'))).toEqual({ LV: 2, P: 1 });
    expect(Object.fromEntries(recipe('J'))).toEqual({ LV: 1, P: 1 });
    expect(Object.fromEntries(recipe('G'))).toEqual({ C: 1, H: 1 });
    expect(Object.fromEntries(recipe('Y'))).toEqual({ SC: 1, H: 1 });
  });

  describe('formed looks (display only)', () => {
    /** Where a part is drawn once its letter is formed: its look's centreline in letter coordinates. */
    const drawnAt = (p: Placement) =>
      (p.look ? lookCenterline(p, p.look) : strokeCenterline(p.tile, p.rot)).map(([x, y]) => [Math.round((x + p.x) * 1000) / 1000, Math.round((y + p.y) * 1000) / 1000]);
    const ends = (pts: number[][]) => [pts[0], pts[pts.length - 1]];

    it("draws G's chin shortened from the top, so its foot stays on the baseline", () => {
      const chin = LETTERS.G.parts.find((p) => p.tile === 'H')!;
      expect(ends(drawnAt(chin))).toEqual([[1, 1.25], [1, 2]]);
      expect(xExtent(LETTERS.G.parts)).toEqual([0, 1]);
    });

    it('draws U and J with the bowl curled under stems that stop where its tails begin', () => {
      for (const ch of ['U', 'J']) {
        const stems = LETTERS[ch].parts.filter((p) => p.tile === 'LV');
        const bowl = drawnAt(LETTERS[ch].parts.find((p) => p.tile === 'P')!);
        // The bowl's tails rise to y = 1 at x = 0 and x = 1; its bottom touches the baseline.
        expect(ends(bowl).sort()).toEqual([[0, 1], [1, 1]]);
        expect(Math.max(...bowl.map(([, y]) => y))).toBeCloseTo(2, 2);
        // Each stem runs from the cap line down to exactly where a tail starts.
        for (const stem of stems) expect(ends(drawnAt(stem))).toEqual([[stem.x, 0], [stem.x, 1]]);
      }
    });
  });

  it('draws a formed W at 2.5 wide while V stays 2 wide', () => {
    expect(drawnWidth('W')).toBe(2.5);
    expect(drawnWidth('V')).toBe(2);
    expect(LETTERS.W.width).toBe(4); // the strokes themselves are unchanged
  });

  it('uses every tile in at least two letters (no single-letter strokes)', () => {
    for (const t of TILE_IDS) {
      const letters = Object.keys(LETTERS).filter((ch) => recipe(ch).has(t));
      expect(letters.length, `${t} is only used by ${letters.join('')}`).toBeGreaterThanOrEqual(2);
    }
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

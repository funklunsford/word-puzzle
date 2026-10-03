import { describe, expect, it } from 'vitest';
import { LETTERS, TILE_IDS, recipe, type Placement } from './glyphs';
import { EMPTY_CELL_X, letterDiff, recognize, slotKey, slotsFor, wordDistance } from './strokes';

const glyph = (ch: string, dx = 0) => LETTERS[ch].parts.map((p) => ({ ...p, x: p.x + dx }));

describe('recognize', () => {
  it('identifies every letter, even when shifted', () => {
    for (const ch of Object.keys(LETTERS)) {
      expect(recognize(glyph(ch))).toBe(ch);
      expect(recognize(glyph(ch, 0.5))).toBe(ch);
    }
  });

  it('returns null for partial letters', () => {
    expect(recognize(glyph('E').slice(0, 2))).toBeNull();
    expect(recognize([])).toBeNull();
  });
});

describe('slotsFor', () => {
  it('offers the missing bar that turns F into E', () => {
    const slots = slotsFor(glyph('F'), 'H');
    expect(slots.some((s) => s.toward.includes('E'))).toBe(true);
  });

  it('can rebuild any letter from any other: remove extras, then add one stroke at a time', () => {
    const letters = Object.keys(LETTERS);
    for (const a of letters) {
      for (const b of letters) {
        // Remove everything not in b's glyph (at b's own position), then add b's strokes.
        const target = glyph(b);
        const keep = new Set(target.map((p) => slotKey(p)));
        let content = glyph(a).filter((p) => keep.has(slotKey(p)));
        // `content` may still contain duplicates of a slot; dedupe to stay a subset of b.
        content = content.filter((p, i) => content.findIndex((q) => slotKey(q) === slotKey(p)) === i);
        // Then keep taking any slot that builds toward b: it must arrive in exactly the number of
        // strokes b is missing, never getting stuck.
        const need = target.length - content.length;
        for (let step = 0; step < need; step++) {
          const slot = TILE_IDS.flatMap((t) => slotsFor(content, t)).find((s) => s.toward.includes(b));
          expect(slot, `${a}→${b}: stuck after ${step} strokes`).toBeDefined();
          content = [...content, slot!.placement];
        }
        expect(recognize(content), `${a}→${b}`).toBe(b);
      }
    }
  });
});

describe('slotsFor is strict: only additions that stay part of a real letter', () => {
  /** These strokes are all part of one real letter, at its exact positions (up to shift). */
  const partOfLetter = (content: Placement[]) =>
    Object.values(LETTERS).some((g) =>
      g.parts.some((anchor) => {
        const c = content[0];
        if (c.tile !== anchor.tile || c.y !== anchor.y || (c.rot ?? 0) !== (anchor.rot ?? 0)) return false;
        const rest = g.parts.map((p) => slotKey({ ...p, x: p.x + c.x - anchor.x }));
        return content.every((q) => {
          const i = rest.indexOf(slotKey(q));
          if (i < 0) return false;
          rest.splice(i, 1);
          return true;
        });
      }),
    );

  it('accepts nothing on a complete T (or any letter no other letter contains)', () => {
    for (const ch of ['T', 'E', 'Q', 'A', 'W', 'S']) {
      for (const tile of TILE_IDS) expect(slotsFor(glyph(ch), tile), `${ch} + ${tile}`).toEqual([]);
    }
  });

  it('accepts only the strokes that grow a letter into a bigger one', () => {
    expect(slotsFor(glyph('F'), 'H').map((s) => s.toward)).toEqual([['E']]);
    expect(slotsFor(glyph('P'), 'SB').map((s) => s.toward)).toEqual([['R']]);
    expect(slotsFor(glyph('V'), 'BV').map((s) => s.toward)).toEqual([['W']]); // to the right only
  });

  it('grows letters rightward only, so a stroke never has two equivalent spots', () => {
    // A lone stem could be either side of an H; the crossbar is only offered on its right.
    const stem = [{ tile: 'LV' as const, x: 0, y: 1, rot: 0 }];
    const bars = slotsFor(stem, 'H');
    expect(bars.filter((s) => s.placement.y === 1).map((s) => s.placement.x)).toEqual([0.5]);
    expect(bars.every((s) => s.placement.x >= 0)).toBe(true); // T's bar is centered on the stem
    // A second stem (H, N, M) also only goes to the right.
    expect(slotsFor(stem, 'LV').every((s) => s.placement.x > 0)).toBe(true);
  });

  it("treats A's leftover crossbar like any middle crossbar", () => {
    // Regression: A's bar used to sit lower than E/F/H's, so on its own it accepted nothing but
    // its chevron, and an empty cell offered two nearly identical middle heights.
    const crossbar = glyph('A').filter((p) => p.tile !== 'BV');
    expect(slotsFor(crossbar, 'BV').flatMap((s) => s.toward)).toEqual(['A']);
    expect(slotsFor(crossbar, 'LV').flatMap((s) => s.toward).sort()).toEqual(['E', 'F', 'H', 'H']);
  });

  it('every offered slot keeps the cell part of a real letter', () => {
    for (const ch of Object.keys(LETTERS)) {
      const parts = glyph(ch);
      const partials = [parts, ...parts.map((_, i) => parts.filter((__, k) => k !== i))];
      for (const content of partials) {
        for (const tile of TILE_IDS) {
          for (const s of slotsFor(content, tile)) {
            expect(partOfLetter([...content, s.placement]), `${ch} partial + ${slotKey(s.placement)}`).toBe(true);
          }
        }
      }
    }
  });

  it('a partial letter can always be completed with the stroke it is missing', () => {
    for (const ch of Object.keys(LETTERS)) {
      const parts = glyph(ch);
      parts.forEach((missing, i) => {
        const content = parts.filter((_, k) => k !== i);
        if (!content.length) return;
        // The slot may sit to the right of the original spot (letters grow rightward), but it
        // must complete the same letter.
        const slot = slotsFor(content, missing.tile).find((s) => s.toward.includes(ch));
        expect(slot, `${ch} without ${slotKey(missing)}`).toBeDefined();
        expect(recognize([...content, slot!.placement])).toBe(ch);
      });
    }
  });

  it('offers each distinct first stroke once, centered, in an empty cell', () => {
    const bars = slotsFor([], 'LV');
    expect(bars).toHaveLength(1);
    expect(bars[0].placement.x).toBe(EMPTY_CELL_X);
    // Crossbars differ only by height: top, middle, bottom.
    expect(new Set(slotsFor([], 'H').map((s) => s.placement.y))).toEqual(new Set([0, 1, 2]));
  });
});

describe('slotsFor offers one spot per position', () => {
  it('never offers two slots at the same position, for any cell', () => {
    const contents: Placement[][] = [[]];
    for (const g of Object.values(LETTERS)) {
      const n = g.parts.length;
      for (let mask = 1; mask < 1 << n; mask++) contents.push(g.parts.filter((_, i) => mask & (1 << i)));
    }
    for (const content of contents) {
      for (const tile of TILE_IDS) {
        const spots = slotsFor(content, tile).map((s) => `${s.placement.x},${s.placement.y}`);
        expect(new Set(spots).size, `${content.map((c) => slotKey(c)).join('+') || 'empty'} + ${tile}`).toBe(spots.length);
      }
    }
  });

  it('offers the chevron upright (V) in an empty cell; A is built crossbar first', () => {
    expect(slotsFor([], 'BV').map((s) => s.placement.rot ?? 0)).toEqual([0]);
    const bar = slotsFor([], 'H').find((s) => s.placement.y === 1)!;
    expect(bar.toward).toContain('A');
    const chevron = slotsFor([bar.placement], 'BV');
    expect(chevron.map((s) => s.toward)).toEqual([['A']]);
    expect(recognize([bar.placement, chevron[0].placement])).toBe('A');
  });

  it('builds S from two bowls, bottom bowl first', () => {
    expect(Object.fromEntries(recipe('S'))).toEqual({ P: 2 });
    const bottom = slotsFor([], 'P').find((s) => s.toward.includes('S'))!;
    const top = slotsFor([bottom.placement], 'P').find((s) => s.toward.includes('S'))!;
    expect(recognize([bottom.placement, top.placement])).toBe('S');
  });
});

describe('wordDistance', () => {
  it('counts adds, removes and moves', () => {
    expect(letterDiff('F', 'E')).toEqual({ removed: [], added: ['H'] });
    expect(wordDistance('FIRE', 'FIRE')).toBe(0);
    expect(wordDistance('FAME', 'EAME')).toBe(1); // F→E: add a bar
    expect(wordDistance('LIMB', 'TIMB')).toBe(1); // L→T: move the bar
  });

  it('pairs a stroke removed from one letter with the same stroke added to another as one move', () => {
    // E loses a bar, F gains one: a single drag.
    expect(wordDistance('EF', 'FE')).toBe(1);
  });
});

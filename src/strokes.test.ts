import { describe, expect, it } from 'vitest';
import { LETTERS, TILE_IDS, type Placement } from './glyphs';
import { collides } from './geometry';
import { letterDiff, recognize, slotKey, slotsFor, wordDistance } from './strokes';

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
        while (recognize(content) !== b) {
          const have = content.map((p) => slotKey(p));
          const next = target.find((p) => !have.includes(slotKey(p)))!;
          const ok = slotsFor(content, next.tile).some((s) => slotKey(s.placement) === slotKey(next));
          expect(ok, `${a}→${b}: can't add ${next.tile}`).toBe(true);
          content = [...content, next];
        }
      }
    }
  });
});

describe('slotsFor when the cell no longer fits any letter', () => {
  // Regression: A's crossbar sits at a height no other letter uses, so after removing the
  // chevron nothing could be added next to it.
  it('lets you turn A into E: remove the chevron, add a stem on the left, then rebuild', () => {
    let content = glyph('A').filter((p) => p.tile !== 'BV');
    const [crossbar] = content;

    const stems = slotsFor(content, 'LV');
    expect(stems.length).toBeGreaterThan(0);
    const left = stems.filter((s) => s.placement.x < crossbar.x).sort((a, b) => b.placement.x - a.placement.x)[0];
    expect(left, 'a stem slot to the left of the crossbar').toBeDefined();
    content = [...content, left.placement];

    // Move the crossbar to E's middle, then add the top and bottom bars.
    const rest = content.filter((p) => p !== crossbar);
    const mid = slotsFor(rest, 'H').find((s) => s.placement.y === 1 && s.toward.includes('E'));
    expect(mid).toBeDefined();
    content = [...rest, mid!.placement];
    for (const y of [0, 2]) {
      const bar = slotsFor(content, 'H').find((s) => s.placement.y === y && s.toward.includes('E'));
      expect(bar, `E bar at y=${y}`).toBeDefined();
      content = [...content, bar!.placement];
    }
    expect(recognize(content)).toBe('E');
  });

  it('never leaves a stroke with nowhere to go after removing one or two strokes from any letter', () => {
    for (const ch of Object.keys(LETTERS)) {
      const parts = glyph(ch);
      const partials: typeof parts[] = [];
      parts.forEach((_, i) => {
        partials.push(parts.filter((__, k) => k !== i));
        parts.forEach((__, j) => j > i && partials.push(parts.filter((___, k) => k !== i && k !== j)));
      });
      for (const content of partials) {
        for (const tile of TILE_IDS) {
          // A stroke is only useful if some letter needs more copies of it than the cell has.
          const have = content.filter((p) => p.tile === tile).length;
          const most = Math.max(...Object.values(LETTERS).map((g) => g.parts.filter((p) => p.tile === tile).length));
          if (most > have) expect(slotsFor(content, tile).length, `${ch} partial + ${tile}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('still prefers slots that fit every stroke already in the cell', () => {
    // An F can only grow into an E, so the only crossbar slot offered is E's bottom bar.
    const slots = slotsFor(glyph('F'), 'H');
    expect(slots.map((s) => s.placement.y)).toEqual([2]);
  });
});

describe('slotsFor never offers a colliding drop', () => {
  /** These strokes are all part of one real letter (where crossings like X's are fine). */
  const formsLetterPart = (content: Placement[]) =>
    Object.values(LETTERS).some((g) =>
      g.parts.some((anchor) =>
        content.some((c) => {
          if (c.tile !== anchor.tile || c.y !== anchor.y || (c.rot ?? 0) !== (anchor.rot ?? 0)) return false;
          const dx = c.x - anchor.x;
          const rest = g.parts.map((p) => slotKey({ ...p, x: p.x + dx }));
          return content.every((q) => {
            const i = rest.indexOf(slotKey(q));
            if (i < 0) return false;
            rest.splice(i, 1);
            return true;
          });
        }),
      ),
    );

  const check = (content: Placement[], label: string) => {
    for (const tile of TILE_IDS) {
      for (const s of slotsFor(content, tile)) {
        // Anything the new stroke crosses must belong to one letter with it (like X's slashes).
        const crossed = content.filter((c) => collides(s.placement, c));
        if (crossed.length && !formsLetterPart([...crossed, s.placement])) {
          throw new Error(`${label} + ${slotKey(s.placement)} collides with ${crossed.map((c) => slotKey(c)).join(', ')}`);
        }
      }
    }
  };

  it("doesn't put a long bar through A's leftover crossbar", () => {
    const crossbar = glyph('A').filter((p) => p.tile !== 'BV');
    const through = slotsFor(crossbar, 'LV').filter((s) => collides(s.placement, crossbar[0]));
    expect(through).toEqual([]);
  });

  it('holds for partial letters', () => {
    for (const ch of Object.keys(LETTERS)) {
      const parts = glyph(ch);
      parts.forEach((_, i) => check(parts.filter((__, k) => k !== i), `${ch} minus #${i}`));
    }
  });

  it('holds for mixed strokes that fit no letter', () => {
    // One stroke from each of two different letters, at their own positions.
    const letters = Object.keys(LETTERS);
    for (let i = 0; i < letters.length; i += 3) {
      for (let j = 1; j < letters.length; j += 4) {
        const a = glyph(letters[i])[0];
        const b = glyph(letters[j]).at(-1)!;
        if (slotKey(a) === slotKey(b) || collides(a, b)) continue;
        check([a, b], `${letters[i]}[0] + ${letters[j]}[-1]`);
      }
    }
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

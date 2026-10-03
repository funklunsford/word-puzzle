import { describe, expect, it } from 'vitest';
import { TILE_IDS } from './glyphs';
import { inkOutline, inkSeed } from './ink';

/** The outline's points, parsed from its path. */
function points(d: string): [number, number][] {
  return [...d.matchAll(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)].map((m) => [Number(m[1]), Number(m[2])]);
}

describe('inkOutline', () => {
  it('gives every stroke, in every orientation, a closed outline of finite points', () => {
    for (const tile of TILE_IDS) {
      for (const rot of [0, 90, 180, 270]) {
        const d = inkOutline(tile, rot, 3);
        expect(d.startsWith('M'), `${tile}@${rot}`).toBe(true);
        expect(d.endsWith('Z'), `${tile}@${rot}`).toBe(true);
        const pts = points(d);
        expect(pts.length).toBeGreaterThan(8);
        expect(pts.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))).toBe(true);
      }
    }
  });

  it('is deterministic for a given seed, and the seed changes the wobble', () => {
    expect(inkOutline('LV', 0, 7)).toBe(inkOutline('LV', 0, 7));
    expect(inkOutline('LV', 0, 7)).not.toBe(inkOutline('LV', 0, 8));
  });

  it('draws like a broad nib: a downstroke is thicker than a crossbar', () => {
    const span = (d: string, axis: 0 | 1) => {
      const v = points(d).map((p) => p[axis]);
      return Math.max(...v) - Math.min(...v);
    };
    const stem = span(inkOutline('LV', 0, 0), 0); // width across a vertical bar
    const bar = span(inkOutline('H', 0, 0), 1); // height across a horizontal bar
    // With the pen at 38° (the approved look) a stem is about 1.2× a crossbar.
    expect(stem).toBeGreaterThan(bar * 1.15);
  });

  it('never gets thinner than the minimum half-width', () => {
    const bar = (min: number) => {
      const ys = points(inkOutline('H', 0, 0, min)).map((p) => p[1]);
      return Math.max(...ys) - Math.min(...ys);
    };
    expect(bar(0.12)).toBeGreaterThanOrEqual(0.24 - 0.03); // allow for the wobble
    expect(bar(0.12)).toBeGreaterThan(bar(0));
  });
});

describe('squeeze', () => {
  it("narrows a stroke's path but keeps the pen width", () => {
    const xs = (d: string) => points(d).map((p) => p[0]);
    const span = (v: number[]) => Math.max(...v) - Math.min(...v);
    const full = span(xs(inkOutline('BV', 0, 0)));
    const half = span(xs(inkOutline('BV', 0, 0, 0, 0.5)));
    expect(half).toBeLessThan(full * 0.65);
    // A vertical bar's width doesn't change: the squeeze applies to the path, not the ink.
    expect(span(xs(inkOutline('LV', 0, 0, 0, 0.5)))).toBeCloseTo(span(xs(inkOutline('LV', 0, 0))), 2);
  });
});

describe('inkSeed', () => {
  it('is stable for a stroke regardless of horizontal position (letters look the same everywhere)', () => {
    expect(inkSeed({ tile: 'H', x: 0.5, y: 1, rot: 0 })).toBe(inkSeed({ tile: 'H', x: 2.5, y: 1, rot: 0 }));
    expect(inkSeed({ tile: 'H', x: 0.5, y: 1, rot: 0 })).not.toBe(inkSeed({ tile: 'H', x: 0.5, y: 0, rot: 0 }));
  });
});

import { describe, expect, it } from 'vitest';
import { TILE_IDS } from './glyphs';
import { inkMorph, inkOutline, inkSeed, lookCenterline, strokeCenterline } from './ink';

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

describe('lookCenterline', () => {
  const chevron = { tile: 'BV' as const, x: 1, y: 1, rot: 0 };
  const own = strokeCenterline('BV', 0, 0.625);
  const close = (a: number[], b: number[]) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 6));

  it('keeps part of a chevron along its path, corner included', () => {
    const kept = lookCenterline(chevron, { len: 0.75, keep: 'start' }, 0.625);
    close(kept[0], own[0]);
    expect(kept.some(([x, y]) => Math.abs(x) < 1e-9 && Math.abs(y - 1) < 1e-9)).toBe(true); // through its corner
    const end = kept[kept.length - 1];
    expect(end[1]).toBeCloseTo(0, 1); // halfway back up the second arm
  });

  it("carries W's left chevron on past its end and back down, narrowed with the letter", () => {
    const peak = lookCenterline(chevron, { len: 1, keep: 'start', over: 0.12 }, 0.625);
    const top = own[own.length - 1];
    expect(peak.slice(0, own.length).every((q, i) => Math.hypot(q[0] - own[i][0], q[1] - own[i][1]) < 1e-9)).toBe(true);
    const last = peak[peak.length - 1];
    expect(Math.hypot(last[0] - top[0], last[1] - top[1])).toBeCloseTo(0.12, 6);
    expect(last[0]).toBeGreaterThan(top[0]); // on to the right
    expect(last[1]).toBeGreaterThan(top[1]); // and back down
  });
});

describe('inkMorph', () => {
  it("eases a stem between full height and the half it's drawn at in a formed U", () => {
    const stem = { tile: 'LV' as const, x: 0, y: 1, rot: 0 };
    const full = strokeCenterline('LV', 0);
    const half = lookCenterline(stem, { len: 0.5, keep: 'start' });
    expect([half[0], half[half.length - 1]]).toEqual([[0, -1], [0, 0]]); // keeps its top, stops halfway
    const bottom = (d: string) => Math.max(...points(d).map((p) => p[1]));
    const mid = inkMorph(full, half, 0.5);
    expect(mid.startsWith('M') && mid.endsWith('Z')).toBe(true);
    expect(bottom(mid)).toBeCloseTo(0.5, 1);
    expect(bottom(inkMorph(full, half, 0))).toBeCloseTo(1, 1);
    expect(bottom(inkMorph(full, half, 1))).toBeCloseTo(0, 1);
  });
});

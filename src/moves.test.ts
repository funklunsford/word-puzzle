import { describe, expect, it } from 'vitest';
import type { Placement } from './glyphs';
import { moveOf, movesOf, validMoves } from './moves';

const stem: Placement = { tile: 'LV', x: 0, y: 0 };
const bar = (x: number, y: number): Placement => ({ tile: 'H', x, y });
const vee: Placement = { tile: 'BV', x: 0, y: 0, rot: 0 };

describe("a stroke's move", () => {
  it('tells a stroke added and one removed, and which letter', () => {
    expect(moveOf([[stem], []], [[stem], [bar(0, 0)]])).toEqual({ kind: 'add', at: 1 });
    expect(moveOf([[stem, bar(0.5, 0)], []], [[stem], []])).toEqual({ kind: 'remove', at: 0 });
  });

  it('tells a stroke turned on its spot from one moved within its letter', () => {
    expect(moveOf([[vee]], [[{ ...vee, rot: 180 }]])).toEqual({ kind: 'turn', at: 0 });
    expect(moveOf([[stem, bar(0.5, 0)]], [[stem, bar(0.5, 2)]])).toEqual({ kind: 'move', at: 0 });
  });

  it('tells a stroke carried to another letter, from where to where', () => {
    expect(moveOf([[stem], [stem, bar(0.5, 0)]], [[stem, bar(0.5, 1)], [stem]])).toEqual({ kind: 'carry', at: 1, to: 0 });
  });

  it('finds nothing when nothing changed', () => {
    expect(moveOf([[stem, bar(0.5, 0)]], [[bar(0.5, 0), stem]])).toBeNull();
  });

  it("lists a step's moves in order, skipping a stroke that changed nothing", () => {
    const start = [[stem], []];
    const added = [[stem], [bar(0, 0)]];
    const removed = [[], [bar(0, 0)]];
    expect(movesOf([start, added, added, removed])).toEqual([
      { kind: 'add', at: 1 },
      { kind: 'remove', at: 0 },
    ]);
  });
});

describe('moves kept with a result', () => {
  it('are used only if every one is sound for the word', () => {
    const kept = [
      { kind: 'add', at: 2 },
      { kind: 'carry', at: 4, to: 0 },
    ];
    expect(validMoves(kept, 5)).toEqual(kept);
    expect(validMoves([{ kind: 'carry', at: 4 }], 5)).toBeUndefined();
    expect(validMoves([{ kind: 'jump', at: 0 }], 5)).toBeUndefined();
    expect(validMoves([{ kind: 'add', at: 5 }], 5)).toBeUndefined();
    expect(validMoves([null], 5)).toBeUndefined();
    expect(validMoves('add', 5)).toBeUndefined();
    expect(validMoves(undefined, 5)).toBeUndefined();
  });
});

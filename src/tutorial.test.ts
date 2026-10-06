import { describe, expect, it } from 'vitest';
import { LETTERS, type Placement } from './glyphs';
import { recognize } from './strokes';
import { TUTORIAL, applyGhost } from './tutorial';

const fresh = (letter: string) => LETTERS[letter].parts.map((p) => ({ ...p }));

describe("How to play's practice", () => {
  it('makes each letter by doing the moves it shows, a move or two at a time', () => {
    let last: Placement[] = [];
    for (const step of TUTORIAL) {
      let content = recognize(last) === step.start ? last : fresh(step.start);
      for (let moves = 0; recognize(content) !== step.goal; moves++) {
        expect(moves, `${step.start} → ${step.goal}`).toBeLessThan(2);
        const plan = step.next(content);
        expect(plan, `${step.start} → ${step.goal}, from ${JSON.stringify(content)}`).not.toBeNull();
        content = applyGhost(content, plan!.ghost);
      }
      last = content;
    }
  });

  it('shows the bar for A however the V was turned: in place, or dropped back on the empty cell’s spot', () => {
    const turnA = TUTORIAL.find((s) => s.goal === 'A')!;
    for (const x of [1, 0.5]) {
      const plan = turnA.next([{ tile: 'BV', x, y: 1, rot: 180 }]);
      expect(plan?.ghost.kind).toBe('carry');
      expect(recognize(applyGhost([{ tile: 'BV', x, y: 1, rot: 180 }], plan!.ghost))).toBe('A');
    }
  });

  it('says so when the letter has gone another way', () => {
    const first = TUTORIAL[0];
    expect(first.next(fresh('L'))).toBeNull();
    expect(first.next([])).toBeNull();
  });
});

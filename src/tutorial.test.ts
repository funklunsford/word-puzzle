import { describe, expect, it } from 'vitest';
import { LETTERS, TILE_IDS, type Placement } from './glyphs';
import { recognize } from './strokes';
import { TUTORIAL, applyGhost, offersMore, practiceGoals, practiceStep, sayMove } from './tutorial';

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

  it('teaches turning with a swipe on a mouse, and a double-tap on a touch screen', () => {
    const turns = TUTORIAL.map((s) => s.next(fresh(s.start))).filter((plan) => plan?.ghost.kind === 'turn');
    expect(turns.length).toBe(2); // V → A and C → D
    for (const plan of turns) {
      expect(plan!.say.mouse).toMatch(/^Swipe the [VC] /);
      expect(plan!.say.touch).toMatch(/^Double-tap /);
    }
    expect(sayMove({ kind: 'turn', at: { tile: 'BV', x: 1, y: 1 } }, 'A')).toEqual({
      touch: 'Make an A: double-tap the stroke shown to turn it.',
      mouse: 'Make an A: swipe the stroke shown to turn it.',
    });
  });

  it('offers more practice only once the last of the five moves is made', () => {
    TUTORIAL.forEach((_, i) => {
      expect(offersMore(i, false), `move ${i + 1}, not yet made`).toBe(false);
      expect(offersMore(i, true), `move ${i + 1}, made`).toBe(i === TUTORIAL.length - 1);
    });
    // Nor again during more practice.
    expect(offersMore(TUTORIAL.length, true)).toBe(false);
  });
});

describe('more practice, after the five moves', () => {
  it('reaches every letter it offers by doing the moves it shows, two at most', () => {
    for (const start of Object.keys(LETTERS)) {
      for (const goal of practiceGoals(fresh(start), TILE_IDS)) {
        const step = practiceStep(start, goal, TILE_IDS);
        let content = fresh(start);
        for (let moves = 0; recognize(content) !== goal; moves++) {
          expect(moves, `${start} → ${goal}`).toBeLessThan(2);
          const plan = step.next(content);
          expect(plan, `${start} → ${goal}`).not.toBeNull();
          content = applyGhost(content, plan!.ghost);
        }
      }
    }
  });

  it('offers most letters somewhere to go (X and Z lead nowhere close, and start again elsewhere)', () => {
    const stuck = Object.keys(LETTERS).filter((ch) => !practiceGoals(fresh(ch), TILE_IDS).length);
    expect(stuck).toEqual(['X', 'Z']);
  });

  it('says each move plainly, naming the letter to make (and every stroke just a stroke)', () => {
    expect(sayMove({ kind: 'carry', tile: 'SB', from: 'tray', to: { tile: 'SB', x: 0, y: 0 } }, 'R').mouse).toBe('Make an R: drag the stroke shown in from the tray.');
    expect(sayMove({ kind: 'remove', at: { tile: 'H', x: 0, y: 0 } }, 'B').touch).toBe('Make a B: tap the stroke shown to remove it.');
  });
});

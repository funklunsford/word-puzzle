import { afterEach, describe, expect, it, vi } from 'vitest';
import { coachTip, isFirstVisit, loadOnboarded, saveOnboarded, strayText, tipText, type CoachState } from './onboarding';

/** A localStorage that keeps its items in a map (or one that throws, as when blocked). */
function storage(items = new Map<string, string>()) {
  vi.stubGlobal('localStorage', { getItem: (k: string) => items.get(k) ?? null, setItem: (k: string, v: string) => items.set(k, v) });
  return items;
}

describe('the first visit', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('offers the sample only when How to play opens by itself, before the sample is played or skipped', () => {
    expect(isFirstVisit(false, null)).toBe(true);
    // A returning player (How to play seen before, from before the sample existed): never by itself.
    expect(isFirstVisit(true, null)).toBe(false);
    expect(isFirstVisit(false, 'done')).toBe(false);
    expect(isFirstVisit(false, 'skipped')).toBe(false);
    // ?help opens it as a first visit's, for testing, until the sample's been played or skipped.
    expect(isFirstVisit(true, null, true)).toBe(true);
    expect(isFirstVisit(true, 'skipped', true)).toBe(false);
  });

  it('keeps how the sample went, a play-through for good', () => {
    const items = storage();
    expect(loadOnboarded()).toBeNull();
    saveOnboarded('skipped');
    expect(items.get('strokes:onboarded')).toBe('skipped');
    saveOnboarded('done');
    expect(loadOnboarded()).toBe('done');
    // Skipping it on a later try doesn't undo having played it.
    saveOnboarded('skipped');
    expect(loadOnboarded()).toBe('done');
    storage(new Map([['strokes:onboarded', 'nonsense']]));
    expect(loadOnboarded()).toBeNull();
  });

  it('copes with storage that is blocked', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    expect(loadOnboarded()).toBeNull();
    expect(() => saveOnboarded('done')).not.toThrow();
  });
});

describe("the sample's coach", () => {
  const at = (s: Partial<CoachState>): CoachState => ({ won: false, locked: false, used: 0, started: false, words: 0, landed: false, done: new Set(), ...s });

  it('shows one tip at a time, in order: the goal, the move, the strokes, a word, solved', () => {
    // Before any stroke: the goal, then (closed or timed out) the move to make.
    expect(coachTip(at({}))).toBe('goal');
    expect(coachTip(at({ done: new Set(['goal']) }))).toBe('move');
    // The first stroke: the step's strokes; then, moved on from, the move again.
    expect(coachTip(at({ used: 1, started: true }))).toBe('dots');
    expect(coachTip(at({ used: 2, started: true, done: new Set(['dots']) }))).toBe('move');
    // A word made, and each word after it.
    expect(coachTip(at({ started: true, words: 1, landed: true, done: new Set(['dots']) }))).toBe('word');
    expect(coachTip(at({ started: true, words: 1, landed: true, done: new Set(['dots', 'word1']) }))).toBe('move');
    expect(coachTip(at({ started: true, words: 2, landed: true, done: new Set(['dots', 'word1']) }))).toBe('word');
    expect(coachTip(at({ won: true, started: true, words: 2, landed: true }))).toBe('done');
  });

  it('says so when a step is out of strokes, over anything else but the win', () => {
    expect(coachTip(at({ locked: true, used: 3, started: true }))).toBe('out');
    expect(coachTip(at({ locked: true, used: 3, started: true, done: new Set(['out']) }))).toBeNull();
  });

  it("the strokes tip comes once, even when the first stroke makes a word: the word's tip first", () => {
    expect(coachTip(at({ started: true, words: 1, landed: true }))).toBe('word');
    expect(coachTip(at({ used: 1, started: true, words: 1, done: new Set(['word1']) }))).toBe('dots');
  });

  it('says what the owner asked, word for word', () => {
    const words = { start: 'JUICE', goal: 'FUDGE' };
    expect(tipText('goal', words)).toBe('Goal: turn JUICE into FUDGE.');
    expect(tipText('dots', words)).toBe('A step can use up to 3 strokes. Make a real word to finish it.');
    expect(tipText('word', { ...words, word: 'JUDGE', cost: 2 })).toBe('JUDGE: a real word! That step cost 2. Now on to FUDGE.');
    expect(tipText('word', { ...words, word: 'JUICE', back: true })).toBe("Back in JUICE: free, you've been here before. Now on to FUDGE.");
    expect(tipText('out', words)).toBe('Out of strokes for this step. Undo or Reset to try another way.');
    expect(tipText('done', words)).toBe("You've got it! Now today's puzzle.");
    expect(strayText(1)).toBe('Not quite. Undo or Reset to try another way.');
    expect(strayText(0, 'JUDGE')).toBe('Make JUDGE next.');
  });
});

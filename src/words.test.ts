import { describe, expect, it } from 'vitest';
import familiarText from '../data/familiar-4.txt?raw';
import familiar5Text from '../data/familiar-5.txt?raw';
import enableText from '../data/enable1.txt?raw';
import mazeJson from '../public/mazes.json';
import maze5Json from '../public/mazes-5.json';
import definitionsJson from '../public/definitions.json';
import definitions5Json from '../public/definitions-5.json';
import { STEP_LIMIT, wordDistance } from './strokes';
import { BLOCKLIST, parseWordList } from './wordlist';

const familiar = parseWordList(familiarText);
const familiar5 = parseWordList(familiar5Text);
const enable = new Set(enableText.split('\n').map((w: string) => w.trim().toUpperCase()));
const maze = mazeJson as { words: string[]; puzzle: { start: string; goal: string; best: number; path: string[] } };

describe('familiar word list', () => {
  it('has only valid, unblocked 4-letter words', () => {
    expect(familiar.length).toBeGreaterThan(1500);
    for (const w of familiar) {
      expect(w).toMatch(/^[A-Z]{4}$/);
      expect(enable.has(w), w).toBe(true);
    }
    expect(familiar.filter((w) => BLOCKLIST.includes(w))).toEqual([]);
  });

  it('keeps the SCOWL notice its license requires', () => {
    expect(familiarText).toContain('Copyright 2000-2026 by Kevin Atkinson');
  });
});

describe("the desktop game's 5-letter word list", () => {
  it('has only valid, unblocked 5-letter words, with the SCOWL notice', () => {
    expect(familiar5.length).toBeGreaterThan(3000);
    for (const w of familiar5) {
      expect(w).toMatch(/^[A-Z]{5}$/);
      expect(enable.has(w), w).toBe(true);
    }
    expect(familiar5.filter((w) => BLOCKLIST.includes(w))).toEqual([]);
    expect(familiar5Text).toContain('Copyright 2000-2026 by Kevin Atkinson');
  });

  it('is the 5-letter maze’s rooms', () => {
    expect((maze5Json as { words: string[] }).words).toEqual(familiar5);
  });
});

describe('the maze', () => {
  it('uses the familiar words as its rooms', () => {
    expect(maze.words).toEqual(familiar);
  });

  it('has one puzzle whose best route is real, familiar and correctly costed', () => {
    const { start, goal, best, path } = maze.puzzle;
    expect([path[0], path.at(-1)]).toEqual([start, goal]);
    let total = 0;
    for (let i = 0; i < path.length; i++) {
      expect(familiar, path[i]).toContain(path[i]);
      if (i === 0) continue;
      const step = wordDistance(path[i - 1], path[i]);
      expect(step, `${path[i - 1]} → ${path[i]}`).toBeLessThanOrEqual(STEP_LIMIT);
      total += step;
    }
    expect(total).toBe(best);
  });
});

describe.each([
  { letters: 4, words: familiar, defs: definitionsJson as unknown as Record<string, [string, string, string?] | string> },
  { letters: 5, words: familiar5, defs: definitions5Json as unknown as Record<string, [string, string, string?] | string> },
])('definitions, $letters letters', ({ words, defs }) => {
  it('defines every maze word, with a part of speech and a short, clean definition', () => {
    for (const w of words) {
      const d = defs[w];
      expect(Array.isArray(d), w).toBe(true);
      const [pos, text] = d as [string, string];
      expect(pos, w).toMatch(/^(n|v|adj|adv|pron|prep|conj|interj)\.$/);
      expect(text.length, w).toBeGreaterThan(3);
      expect(text, w).not.toMatch(/offensive term|obscene|vulgar|slur|derogatory|disparaging/i);
      // Nor any word the maze itself keeps out.
      for (const bad of BLOCKLIST) expect(text.toUpperCase(), w).not.toMatch(new RegExp(`\\b${bad}\\b`));
    }
  });

  it("carries WordNet's notice", () => {
    expect(defs._license).toMatch(/WordNet 3\.0, Copyright 2006 by Princeton University/);
  });
});

import { describe, expect, it } from 'vitest';
import familiarText from '../data/familiar-4.txt?raw';
import enableText from '../data/enable1.txt?raw';
import mazeJson from '../public/mazes.json';
import definitionsJson from '../public/definitions.json';
import { STEP_LIMIT, wordDistance } from './strokes';
import { BLOCKLIST, parseWordList } from './wordlist';

const familiar = parseWordList(familiarText);
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

describe('definitions', () => {
  const defs = definitionsJson as unknown as Record<string, [string, string, string?] | string>;

  it('defines every maze word, with a part of speech and a short, clean definition', () => {
    for (const w of familiar) {
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

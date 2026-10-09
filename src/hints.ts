// Hints: the next word on a cheapest remaining route to the goal, from the word the player is in.
// Asked again in the same word, a hint shows a little more: the next word's meaning, then the
// letters to change, then the word itself.

import { STEP_LIMIT, wordDistance } from './strokes';
import type { Def } from './components/maze/Definition';

export interface NextStep {
  /** The word to make next. */
  next: string;
  /** What that step costs (0 when it goes back to a visited word). */
  cost: number;
  /** Strokes still needed from here at best, that step included. */
  remaining: number;
  /** Which letters that step changes (indexes into the word). */
  letters: number[];
}

/** A word's doors: the words one step (at most STEP_LIMIT strokes) away, with each step's cost. */
export type Doors = (word: string) => [string, number][];

/** Doors worked out from the word list (each step's cost searched; see wordDistance). The game uses the maze's own, shipped with it. */
export const doorsFrom =
  (words: string[]): Doors =>
  (word) =>
    doors(word, words);

/** Words one step (at most STEP_LIMIT strokes) from `word`, with the step's cost. A cheap letter count rules most out first. */
function doors(word: string, words: string[]): [string, number][] {
  const out: [string, number][] = [];
  for (const w of words) {
    if (w === word) continue;
    let diff = 0;
    for (let k = 0; k < w.length && diff <= STEP_LIMIT; k++) if (w[k] !== word[k]) diff++;
    if (diff > STEP_LIMIT) continue;
    const c = wordDistance(word, w);
    if (c <= STEP_LIMIT) out.push([w, c]);
  }
  return out;
}

/**
 * The best next step from `room` towards `goal`. Going back to a visited word is free, as in the
 * game. Searches outward from the goal (steps cost the same both ways) until it reaches the room,
 * so it only looks at words at most as far from the goal as the room is.
 */
export function nextStep(doorsOf: Doors, room: string, goal: string, visited: Set<string>): NextStep | null {
  if (room === goal) return null;
  const enter = (w: string, c: number) => (visited.has(w) && w !== goal ? 0 : c);
  const dist = new Map<string, number>([[goal, 0]]);
  const done = new Set<string>();
  const queue: [number, string][] = [[0, goal]];
  while (queue.length) {
    // A small graph: picking the nearest from a sorted queue is quick enough.
    queue.sort((a, b) => a[0] - b[0]);
    const [d, v] = queue.shift()!;
    if (done.has(v)) continue;
    done.add(v);
    if (v === room) break;
    for (const [u, c] of doorsOf(v)) {
      if (done.has(u)) continue;
      const du = d + enter(v, c); // the player steps u → v
      if (du < (dist.get(u) ?? Infinity)) {
        dist.set(u, du);
        queue.push([du, u]);
      }
    }
  }
  const best = dist.get(room);
  if (best === undefined || !done.has(room)) return null;
  // The room's doors that lie on a cheapest route; prefer new words over going back.
  const options = doorsOf(room)
    .map(([w, c]) => ({ w, cost: enter(w, c), after: dist.get(w) }))
    .filter((o) => done.has(o.w) && o.after !== undefined && o.cost + o.after === best)
    .sort((a, b) => Number(visited.has(a.w)) - Number(visited.has(b.w)) || a.cost - b.cost);
  const pick = options[0];
  if (!pick) return null;
  return { next: pick.w, cost: pick.cost, remaining: best, letters: [...pick.w].flatMap((ch, k) => (ch !== room[k] ? [k] : [])) };
}

// ---------- What a hint shows ----------

/** How much of the next step a hint shows: 1 its word's meaning, 2 the letters to change too, 3 the word. */
export type HintLevel = 1 | 2 | 3;

/**
 * The level the next ask shows, after `shown` (null: none yet), or null once the word's been
 * shown. With no meaning to give (no definition for the word, or none loaded) it starts at the
 * letters.
 */
export function nextHintLevel(shown: HintLevel | null, meaning: boolean): HintLevel | null {
  if (shown === null) return meaning ? 1 : 2;
  return shown < 3 ? ((shown + 1) as HintLevel) : null;
}

/** Endings that leave a word plain to see (cool → cooler, cold → coldness, calm → calms). */
const ENDINGS = /^(s|es|d|ed|er|ers|est|ing|ness|ly|y)?$/;
const PARTS: Record<string, string> = {
  'n.': 'noun',
  'v.': 'verb',
  'adj.': 'adjective',
  'adv.': 'adverb',
  'interj.': 'interjection',
  'prep.': 'preposition',
  'pron.': 'pronoun',
  'conj.': 'conjunction',
};

/**
 * A word's definition as a clue, quoted, with its part of speech: the word and its base form
 * (CALMS → calm) are blanked out wherever the definition uses them, so the clue never gives the
 * word away ("make cool or cooler" → “make ___ or ___er” (verb)).
 */
export function clue(word: string, [pos, text, base]: Def): string {
  const stems = [word, base].filter((s): s is string => !!s).map((s) => s.toLowerCase());
  const blanked = text.replace(/[A-Za-z]+/g, (w) => {
    const lower = w.toLowerCase();
    const stem = stems.filter((s) => lower.startsWith(s) && ENDINGS.test(lower.slice(s.length))).sort((a, b) => b.length - a.length)[0];
    return stem ? `___${w.slice(stem.length)}` : w;
  });
  // (Not when the part of speech is the word: NOUN's would say "(noun)".)
  const part = PARTS[pos] && !stems.includes(PARTS[pos]) ? ` (${PARTS[pos]})` : '';
  return `“${blanked}”${part}`;
}

const ORDINALS = ['1st', '2nd', '3rd', '4th', '5th'];
/** "the 2nd letter", "the 1st and 4th letters", "the 1st, 2nd and 5th letters". */
function whichLetters(letters: number[]): string {
  const names = letters.map((i) => ORDINALS[i]);
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0];
  return `the ${list} letter${letters.length > 1 ? 's' : ''}`;
}

/**
 * What a hint says at each level, given the next word's clue (if it has one). From level 2 the
 * letters to change are outlined in the word too.
 */
export function hintSays(step: NextStep, level: HintLevel, meaning: string | null): string {
  if (level === 1 && meaning) return `Hint: the next word means ${meaning}.`;
  if (level < 3) return `Hint: change ${whichLetters(step.letters)}${meaning ? `, to a word meaning ${meaning}` : ''}.`;
  return `Hint: make ${step.next} next (${step.cost ? `${step.cost} ${step.cost === 1 ? 'stroke' : 'strokes'}` : 'free'}).`;
}

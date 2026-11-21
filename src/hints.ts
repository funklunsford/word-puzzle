// Hints: the next new word on a cheapest remaining route to the goal, from the word the player is in
// (going back to words already made first, if the route does: see hintStep).
// Asked again in the same word, a hint shows a little more: the next word's meaning, then the
// letters to change, then the word itself. The start word comes with one, each new word made earns
// one, and so does running out of strokes on a step with none to ask for (see hintGate).

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
  /**
   * Words already made to go back to first (free), in order, when a cheapest route starts by going
   * back: the step is made from the last of them, so its cost and letters are from there.
   */
  via?: string[];
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
  return nextSteps(doorsOf, room, goal, visited)[0] ?? null;
}

/** Every next step on a cheapest route from `room` to `goal`, the best first (see nextStep). The sample puzzle's coach plans towards any of them. */
export function nextSteps(doorsOf: Doors, room: string, goal: string, visited: Set<string>): NextStep[] {
  if (room === goal) return [];
  const { enter, dist, done } = towardGoal(doorsOf, room, goal, visited, false);
  const best = dist.get(room);
  if (best === undefined || !done.has(room)) return [];
  // The room's doors that lie on a cheapest route; prefer new words over going back.
  return doorsOf(room)
    .map(([w, c]) => ({ w, cost: enter(w, c), after: dist.get(w) }))
    .filter((o) => done.has(o.w) && o.after !== undefined && o.cost + o.after === best)
    .sort((a, b) => Number(visited.has(a.w)) - Number(visited.has(b.w)) || a.cost - b.cost)
    .map((o) => ({ next: o.w, cost: o.cost, remaining: best, letters: [...o.w].flatMap((ch, k) => (ch !== room[k] ? [k] : [])) }));
}

/**
 * The strokes to the goal from each word, cheapest first, as far out as `room` (see nextSteps): a
 * search outward from the goal, going back to a visited word free. With `ties`, every word as near
 * as the room is settled too, not just the room.
 */
function towardGoal(doorsOf: Doors, room: string, goal: string, visited: Set<string>, ties: boolean) {
  const enter = (w: string, c: number) => (visited.has(w) && w !== goal ? 0 : c);
  const dist = new Map<string, number>([[goal, 0]]);
  const done = new Set<string>();
  const queue: [number, string][] = [[0, goal]];
  while (queue.length) {
    // A small graph: picking the nearest from a sorted queue is quick enough.
    queue.sort((a, b) => a[0] - b[0]);
    const [d, v] = queue.shift()!;
    if (done.has(v)) continue;
    if (done.has(room) && d > dist.get(room)!) break;
    done.add(v);
    if (v === room && !ties) break;
    for (const [u, c] of doorsOf(v)) {
      if (done.has(u)) continue;
      const du = d + enter(v, c); // the player steps u → v
      if (du < (dist.get(u) ?? Infinity)) {
        dist.set(u, du);
        queue.push([du, u]);
      }
    }
  }
  return { enter, dist, done };
}

/** The letters that differ between two words (indexes). */
const changed = (from: string, to: string) => [...to].flatMap((ch, k) => (ch !== from[k] ? [k] : []));

/**
 * What a hint points to: the first new word on a cheapest route from `room` (or the goal), never a
 * word already made. Going back is free, so off the route the cheapest way on usually starts by going
 * back, and a hint naming that word would spend itself on a retreat; this names the new word the
 * route goes on to, and the words to go back through first (`via`), fewest first. It's still a
 * cheapest route, so the player can solve from where it sends them.
 */
export function hintStep(doorsOf: Doors, room: string, goal: string, visited: Set<string>): NextStep | null {
  if (room === goal) return null;
  const { enter, dist, done } = towardGoal(doorsOf, room, goal, visited, true);
  const best = dist.get(room);
  if (best === undefined || !done.has(room)) return null;
  const onRoute = (w: string, c: number) => done.has(w) && enter(w, c) + dist.get(w)! === best;
  // Breadth first through words already made (free to go back to) on a cheapest route, until one
  // has a new word next; the cheapest step of the nearest ones.
  const from = new Map<string, string | null>([[room, null]]);
  let layer = [room];
  while (layer.length) {
    const steps = layer.flatMap((at) => doorsOf(at).flatMap(([w, c]) => ((!visited.has(w) || w === goal) && onRoute(w, c) ? [{ at, next: w, cost: c }] : [])));
    if (steps.length) {
      const { at, next, cost } = steps.reduce((a, b) => (b.cost < a.cost ? b : a));
      const via: string[] = [];
      for (let w: string | null = at; w !== room; w = from.get(w!)!) via.unshift(w!);
      return { next, cost, remaining: best, letters: changed(at, next), ...(via.length > 0 && { via }) };
    }
    const further: string[] = [];
    for (const at of layer)
      for (const [w, c] of doorsOf(at))
        if (visited.has(w) && w !== goal && !from.has(w) && onRoute(w, c)) {
          from.set(w, at);
          further.push(w);
        }
    layer = further;
  }
  return nextStep(doorsOf, room, goal, visited);
}

/**
 * A step's hint once the player moves from `room` to `word`: it goes along when that's back the way
 * it said (its `via`, to any word on it), with the rest of the way; otherwise it ends (null).
 */
export function hintAlong<H extends { room: string; step: NextStep | null }>(hint: H | null, room: string, word: string): H | null {
  const way = hint?.room === room ? hint.step?.via : undefined;
  const at = way ? way.indexOf(word) : -1;
  if (!hint?.step || !way || at < 0) return null;
  const { via: _, ...step } = hint.step;
  const rest = way.slice(at + 1);
  return { ...hint, room: word, step: rest.length ? { ...step, via: rest } : step };
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
  const cost = step.cost ? `${step.cost} ${step.cost === 1 ? 'stroke' : 'strokes'}` : 'free';
  const via = step.via ?? [];
  if (via.length) {
    // Back to a word already made first: where to, then the step from there.
    const back = `Hint: go back${via.length > 1 ? ` through ${via.slice(0, -1).join(', ')}` : ''} to ${via[via.length - 1]} (free), then`;
    if (level === 1 && meaning) return `${back} make a word meaning ${meaning}.`;
    if (level < 3) return `${back} change ${whichLetters(step.letters)}${meaning ? `, to a word meaning ${meaning}` : ''}.`;
    return `${back} make ${step.next} (${cost}).`;
  }
  if (level === 1 && meaning) return `Hint: the next word means ${meaning}.`;
  if (level < 3) return `Hint: change ${whichLetters(step.letters)}${meaning ? `, to a word meaning ${meaning}` : ''}.`;
  return `Hint: make ${step.next} next (${cost}).`;
}

// ---------- Earning a hint ----------
// Hints are earned (the owner's call): each new word made earns one for the next step. They don't
// stack, and going back to a word already visited (a free return) earns none. Running out of strokes
// on a step without landing on a word earns one too, when there's none to ask for (earnOutOfStrokes).
// A step's first ask uses it, and its later asks (the letters, then the word) come with it. Moving to
// another word ends the step's hint. Hardcore has no hints, so nothing to earn.

/**
 * The Hint button, in the word the player is in: none in hardcore; locked with nothing earned;
 * ready with an earned hint waiting; open once this step's hint is started, with more to show; and
 * shown once the word itself is.
 */
export type HintGate = 'none' | 'locked' | 'ready' | 'open' | 'shown';

/** Where the Hint button stands, from whether an earned hint is waiting and how much of this step's hint is shown (null: none yet). */
export function hintGate(earned: boolean, shown: HintLevel | null, hardcore: boolean): HintGate {
  if (hardcore) return 'none';
  if (shown === 3) return 'shown';
  if (shown) return 'open';
  return earned ? 'ready' : 'locked';
}

/** Asking for a hint: whether it shows one, and whether an earned hint is still waiting after (the step's first ask uses it). */
export function afterAsk(gate: HintGate, earned: boolean): { shows: boolean; earned: boolean } {
  if (gate === 'ready') return { shows: true, earned: false };
  return { shows: gate === 'open', earned };
}

/** A hint waits at a puzzle's start, for the first step, as if the start word were a new word (the owner's call). */
export const START_HINT = true;

/**
 * Whether an earned hint is waiting once a word is reached: a new word earns one (only one, they
 * don't stack); a free return doesn't. In hardcore a new word earns none and ends the start's, so
 * turning hardcore off mid-puzzle leaves nothing waiting.
 */
export function earnHint(earned: boolean, newWord: boolean, hardcore: boolean): boolean {
  if (hardcore) return newWord ? false : earned;
  return earned || newWord;
}

/**
 * Whether running out of strokes on a step (all STEP_LIMIT used, no word landed on) earns a hint: it
 * does when the button is locked, with nothing to ask for (the owner's call). Only a free return
 * locks it, after a hint was used elsewhere, so a player back in a word they're sure of needn't make
 * a word they don't want (1–3 strokes) to earn one: trying here is enough. Strokes only count on
 * landing on a word, so it costs nothing. Not with a hint waiting or this step's open, and never in
 * hardcore (no button).
 */
export const earnOutOfStrokes = (gate: HintGate): boolean => gate === 'locked';

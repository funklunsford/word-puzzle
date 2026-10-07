// The maze graph: rooms are words, a door joins two words at most STEP_LIMIT stroke edits apart.
// Shared by scripts/mazes.ts (the fixed puzzle) and the app's dev button (random puzzles).

import { LETTERS } from './glyphs';
import { STEP_LIMIT, strokeDiff, wordDistance } from './strokes';

export interface Puzzle {
  start: string;
  goal: string;
  /** Cheapest route from start to goal, in total strokes. */
  best: number;
  path: string[];
}

export type Graph = { to: number; cost: number }[][];

export function buildGraph(words: string[]): Graph {
  const adj: Graph = words.map(() => []);
  for (let i = 0; i < words.length; i++) {
    for (let j = i + 1; j < words.length; j++) {
      let diff = 0;
      for (let k = 0; k < words[i].length; k++) if (words[i][k] !== words[j][k]) diff++;
      if (diff > STEP_LIMIT) continue; // every changed letter costs at least one stroke
      const cost = wordDistance(words[i], words[j]);
      if (cost <= STEP_LIMIT) {
        adj[i].push({ to: j, cost });
        adj[j].push({ to: i, cost });
      }
    }
  }
  return adj;
}

/** Cheapest strokes (and rooms) from `src` to every word, using only the doors `ok` allows (all by default). */
export function dijkstra(adj: Graph, src: number, ok?: (from: number, to: number) => boolean) {
  const dist = new Array(adj.length).fill(Infinity);
  const hops = new Array(adj.length).fill(0);
  const prev = new Array(adj.length).fill(-1);
  dist[src] = 0;
  const done = new Set<number>();
  // Small graph: a simple O(V^2)-ish scan over a frontier is fine.
  const frontier = new Set([src]);
  while (frontier.size) {
    let u = -1;
    for (const v of frontier) if (u < 0 || dist[v] < dist[u]) u = v;
    frontier.delete(u);
    done.add(u);
    for (const { to, cost } of adj[u]) {
      if (done.has(to) || (ok && !ok(u, to))) continue;
      if (dist[u] + cost < dist[to]) {
        dist[to] = dist[u] + cost;
        hops[to] = hops[u] + 1;
        prev[to] = u;
        frontier.add(to);
      }
    }
  }
  return { dist, hops, prev };
}

export function solve(words: string[], adj: Graph, start: string, goal: string): Puzzle | null {
  const s = words.indexOf(start);
  const g = words.indexOf(goal);
  if (s < 0 || g < 0) return null;
  const { dist, prev } = dijkstra(adj, s);
  if (!Number.isFinite(dist[g])) return null;
  const path: string[] = [];
  for (let c = g; c >= 0; c = prev[c]) path.unshift(words[c]);
  return { start, goal, best: dist[g], path };
}

/**
 * The words on some lowest-stroke route from start to goal, each with its strokes from the start:
 * every word W where (start → W) + (W → goal) is the puzzle's best. Hardcore mode lets a player
 * step only onto these, and only when it keeps them on par.
 */
export function routeWords(words: string[], adj: Graph, start: string, goal: string): Record<string, number> {
  const fromStart = dijkstra(adj, words.indexOf(start)).dist;
  const toGoal = dijkstra(adj, words.indexOf(goal)).dist;
  const best = fromStart[words.indexOf(goal)];
  const out: Record<string, number> = {};
  words.forEach((w, i) => {
    if (fromStart[i] + toGoal[i] === best) out[w] = fromStart[i];
  });
  return out;
}

/**
 * How far a random puzzle's goal is: 9–11 strokes at best (10 on average, picked evenly), over at
 * least 3 words, so there's a real route to find (never a single swap) without it being a slog.
 */
export const PUZZLE_SHAPE = { best: [9, 11], steps: [3, 8] } as const;

/**
 * A random puzzle: a start with a few doors, and a goal PUZZLE_SHAPE away. `endpoint` limits which
 * words a puzzle may start and end on (the words in between are any in the maze).
 */
export function randomPuzzle(words: string[], adj: Graph, random = Math.random, endpoint: (word: string) => boolean = () => true): Puzzle {
  const starts = words.map((_, i) => i).filter((i) => adj[i].length >= 3 && endpoint(words[i]));
  for (;;) {
    const s = starts[Math.floor(random() * starts.length)];
    const { dist, hops } = dijkstra(adj, s);
    // The best total is picked first, evenly across the range (goals at the far end outnumber the rest).
    const { best, steps } = PUZZLE_SHAPE;
    const target = best[0] + Math.floor(random() * (best[1] - best[0] + 1));
    const goals = words
      .map((_, i) => i)
      .filter((i) => hops[i] >= steps[0] && hops[i] <= steps[1] && dist[i] === target && adj[i].length >= 2 && endpoint(words[i]));
    if (!goals.length) continue;
    const g = goals[Math.floor(random() * goals.length)];
    return solve(words, adj, words[s], words[g])!;
  }
}

/** A small seeded random generator (mulberry32), for puzzles that must come out the same every time. */
export function seededRandom(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- What a puzzle asks of the player ----------

/** The letters drawn with a single stroke (C, I, V): the alphabet's hubs, which many changes pass through. */
export const ONE_STROKE = new Set(Object.keys(LETTERS).filter((ch) => LETTERS[ch].parts.length === 1));

/** A step that turns a letter into or out of a one-stroke letter. */
export function hubStep(a: string, b: string): boolean {
  for (let k = 0; k < a.length; k++) if (a[k] !== b[k] && (ONE_STROKE.has(a[k]) || ONE_STROKE.has(b[k]))) return true;
  return false;
}

/** A word on the way that has a one-stroke letter in a spot where neither the start nor the goal has it. */
export function steppingStone(word: string, start: string, goal: string): boolean {
  for (let k = 0; k < word.length; k++) if (ONE_STROKE.has(word[k]) && word[k] !== start[k] && word[k] !== goal[k]) return true;
  return false;
}

/**
 * What a puzzle's shortest routes need from the one-stroke letters:
 * - 'none': some shortest route never turns a letter into or out of C, I or V;
 * - 'letter': every shortest route does, but only where the start or goal has one (LIME → MOLE
 *   has to change its I), never through a stepping stone;
 * - 'stone': every shortest route passes a stepping stone (BALL → BILL → BELL).
 */
export type Need = 'none' | 'letter' | 'stone';

/**
 * The pool's mix, filled by quota evenly across the best totals (see scripts/mazes.ts): the share
 * needing the one-stroke letters each way (see Need). A stepping stone is fine now and then, but not
 * in every maze. 'letter' puzzles are the most varied; 'none' puzzles can't change a vowel, since
 * vowels only change through I. (Every puzzle is tricky and passes a pocket: see src/difficulty.ts.)
 */
export const POOL_MIX: { need: Record<Need, number> } = { need: { none: 0.3, letter: 0.5, stone: 0.2 } };

/** The puzzle's need, with a shortest route that shows it (one that avoids the hubs where it can). */
export function classifyNeed(words: string[], adj: Graph, start: string, goal: string, best: number): { need: Need; path: string[] } {
  const s = words.indexOf(start);
  const g = words.indexOf(goal);
  const route = (ok: (from: number, to: number) => boolean) => {
    const { dist, prev } = dijkstra(adj, s, ok);
    if (dist[g] !== best) return null;
    const path: string[] = [];
    for (let c = g; c >= 0; c = prev[c]) path.unshift(words[c]);
    return path;
  };
  const none = route((u, v) => !hubStep(words[u], words[v]));
  if (none) return { need: 'none', path: none };
  const letter = route((_, v) => v === g || !steppingStone(words[v], start, goal));
  if (letter) return { need: 'letter', path: letter };
  return { need: 'stone', path: solve(words, adj, start, goal)!.path };
}

/**
 * Whether the straightforward approach makes par: always taking a move that looks best (the
 * fewest letters different from the goal, then the fewest strokes from it, then the cheapest),
 * some such walk reaches the goal in `best` strokes. Moves that look equally good are all tried, so
 * a puzzle only counts as tricky when none of them gets there.
 */
export function isObvious(words: string[], adj: Graph, start: string, goal: string, best: number): boolean {
  const g = words.indexOf(goal);
  const off = (w: string) => [...w].filter((ch, k) => ch !== goal[k]).length;
  const walk = (cur: number, spent: number, seen: Set<number>): boolean => {
    if (cur === g) return spent === best;
    if (spent >= best) return false;
    const moves = adj[cur].filter((e) => !seen.has(e.to)).map((e) => ({ e, key: [off(words[e.to]), strokeDiff(words[e.to], goal), e.cost] }));
    if (!moves.length) return false;
    const top = moves.reduce((a, m) => (m.key[0] < a[0] || (m.key[0] === a[0] && (m.key[1] < a[1] || (m.key[1] === a[1] && m.key[2] < a[2]))) ? m.key : a), moves[0].key);
    return moves.some(({ e, key }) => key.every((v, i) => v === top[i]) && walk(e.to, spent + e.cost, new Set([...seen, e.to])));
  };
  return walk(words.indexOf(start), 0, new Set([words.indexOf(start)]));
}

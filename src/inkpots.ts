// Ink pots (a modifier, behind the `inkPots` flag): a few words in the maze hold an ink pot.
// Reaching one for the first time banks a free stroke, which pays for strokes on later steps to
// new words. Going back to a visited word is already free, so a pot is worth a detour only when it
// sits on a route nearly as cheap as the best one: that's the decision pots add.
//
// Scoring rules live in `payStep` / `scoreWalk` (shared by the game and the solver). The best
// score with pots is a Steiner-tree problem (every new word is first reached by a charged step from
// a visited one, so the charged steps form a tree), solved exactly with Dreyfus–Wagner.

import type { Graph } from './maze';
import { wordDistance } from './strokes';

export interface InkPots {
  /** Words holding a pot. */
  pots: string[];
  /** Best total strokes with pots in play (≤ the puzzle's plain best). */
  best: number;
  /** A route that scores `best`: every word stepped into, revisits included. */
  walk: string[];
  /** The solver's optimum; equals `best` whenever all banked ink gets spent (checked in tests). */
  bound: number;
}

/** Pay for a step to a new word: banked ink covers what it can (1 stroke each). */
export function payStep(strokes: number, ink: number): { paid: number; used: number } {
  const used = Math.min(ink, strokes);
  return { paid: strokes - used, used };
}

/** Total strokes for a walk under the game's rules: revisits are free, pots bank ink on first visit. */
export function scoreWalk(walk: string[], pots: Iterable<string>): number {
  const potSet = new Set(pots);
  const visited = new Set([walk[0]]);
  let ink = 0;
  let total = 0;
  for (let i = 1; i < walk.length; i++) {
    const w = walk[i];
    if (visited.has(w)) continue;
    const { paid, used } = payStep(wordDistance(walk[i - 1], w), ink);
    total += paid;
    ink -= used;
    visited.add(w);
    if (potSet.has(w)) ink++;
  }
  return total;
}

// ---------- Shortest paths (binary heap; many runs per puzzle) ----------

/**
 * Multi-source shortest paths: `dist` holds each word's starting cost (Infinity if none) and is
 * relaxed in place; `prev` records the step into each word that improved it. `skip` is a word the
 * paths may not pass through (the goal: reaching it ends the game).
 */
function relax(adj: Graph, dist: Float64Array, prev: Int32Array, skip = -1) {
  const heap: number[] = [];
  const push = (v: number) => {
    heap.push(v);
    for (let i = heap.length - 1; i > 0; ) {
      const p = (i - 1) >> 1;
      if (dist[heap[p]] <= dist[heap[i]]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      for (let i = 0; ; ) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && dist[heap[l]] < dist[heap[m]]) m = l;
        if (r < heap.length && dist[heap[r]] < dist[heap[m]]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  const done = new Uint8Array(adj.length);
  for (let v = 0; v < adj.length; v++) if (Number.isFinite(dist[v]) && v !== skip) push(v);
  while (heap.length) {
    const u = pop();
    if (done[u]) continue;
    done[u] = 1;
    for (const { to, cost } of adj[u]) {
      if (to === skip || done[to]) continue;
      if (dist[u] + cost < dist[to]) {
        dist[to] = dist[u] + cost;
        prev[to] = u;
        push(to); // lazy deletion: stale heap entries are skipped by `done`
      }
    }
  }
}

function distancesFrom(adj: Graph, src: number, skip = -1) {
  const dist = new Float64Array(adj.length).fill(Infinity);
  const prev = new Int32Array(adj.length).fill(-1);
  dist[src] = 0;
  relax(adj, dist, prev, skip);
  return { dist, prev };
}

// ---------- Placement ----------

/** How much a single pot at each word would change the best: +1 saves a stroke, 0 is break-even, −1 costs one. */
export function potValues(adj: Graph, s: number, g: number, best: number): Float64Array {
  // A pot p on its own: the cheapest tree joins start, p and the goal at some word v, with the goal
  // as a leaf (s → v, v → p, v → goal). Seed every v with d(s, v) + d(v, goal), then relax: h(p).
  const fromStart = distancesFrom(adj, s, g).dist;
  const toGoal = distancesFrom(adj, g).dist;
  const h = new Float64Array(adj.length).fill(Infinity);
  for (let v = 0; v < adj.length; v++) if (v !== g) h[v] = fromStart[v] + toGoal[v];
  relax(adj, h, new Int32Array(adj.length).fill(-1), g);
  return h.map((x) => best + 1 - x);
}

/**
 * Three pots for a puzzle: one that saves a stroke (on an equally cheap route off the best path),
 * one break-even, and one that tempts but costs a stroke. Off the best path, apart from each other.
 * If no pot can save a stroke, two break-even pots stand in.
 */
export function placePots(words: string[], adj: Graph, start: string, goal: string, best: number, path: string[], random = Math.random): string[] {
  const s = words.indexOf(start);
  const g = words.indexOf(goal);
  const value = potValues(adj, s, g, best);
  const onPath = new Set(path);
  const pots: number[] = [];
  const pick = (want: number) => {
    const options = words
      .map((_, i) => i)
      .filter((i) => value[i] === want && !onPath.has(words[i]) && pots.every((p) => wordDistance(words[p], words[i]) > 3));
    if (!options.length) return false;
    pots.push(options[Math.floor(random() * options.length)]);
    return true;
  };
  if (!pick(1)) pick(0);
  pick(0);
  pick(-1);
  return pots.map((i) => words[i]);
}

// ---------- Best score with pots (Dreyfus–Wagner) ----------

/** The best score with `pots` in play, and a walk that achieves it. */
export function potRoute(words: string[], adj: Graph, start: string, goal: string, pots: string[]): InkPots {
  const n = adj.length;
  const s = words.indexOf(start);
  const g = words.indexOf(goal);
  const terminals = [s, ...pots.map((p) => words.indexOf(p))];
  const k = terminals.length;
  const full = (1 << k) - 1;

  // dp[mask][v]: cheapest tree joining the terminals in `mask` and word v, never through the goal.
  // How each entry was reached, for rebuilding the tree: a split into two submasks at v, or a step
  // into v from prev[mask][v] (or v is the terminal itself, for a single terminal).
  const dp: Float64Array[] = [];
  const prev: Int32Array[] = [];
  const split: Int32Array[] = [];
  for (let mask = 1; mask <= full; mask++) {
    const d = new Float64Array(n).fill(Infinity);
    const p = new Int32Array(n).fill(-1);
    const sp = new Int32Array(n).fill(0);
    if ((mask & (mask - 1)) === 0) {
      d[terminals[31 - Math.clz32(mask)]] = 0;
    } else {
      for (let sub = (mask - 1) & mask; sub > 0; sub = (sub - 1) & mask) {
        if (sub < (mask ^ sub)) continue; // each split once
        const a = dp[sub];
        const b = dp[mask ^ sub];
        for (let v = 0; v < n; v++) {
          const c = a[v] + b[v];
          if (c < d[v]) {
            d[v] = c;
            sp[v] = sub;
          }
        }
      }
    }
    // Relax: entries improved by stepping in from a neighbour stop being splits.
    const before = d.slice();
    relax(adj, d, p, g);
    for (let v = 0; v < n; v++) if (d[v] < before[v]) sp[v] = 0;
    dp[mask] = d;
    prev[mask] = p;
    split[mask] = sp;
  }

  // Then the last leg to the goal, from some word v of the tree. Pots in the tree each save one.
  const toGoal = distancesFrom(adj, g);
  let bestCost = Infinity;
  let bestMask = 1;
  let bestV = s;
  for (let mask = 1; mask <= full; mask += 2) {
    const saved = popcount(mask) - 1;
    for (let v = 0; v < n; v++) {
      if (v === g) continue;
      const c = dp[mask][v] + toGoal.dist[v] - saved;
      if (c < bestCost) [bestCost, bestMask, bestV] = [c, mask, v];
    }
  }

  // Rebuild the tree's edges.
  const edges: [number, number][] = [];
  const build = (mask: number, v: number) => {
    if (split[mask][v]) {
      build(split[mask][v], v);
      build(mask ^ split[mask][v], v);
    } else if (prev[mask][v] >= 0) {
      edges.push([prev[mask][v], v]);
      build(mask, prev[mask][v]);
    }
  };
  build(bestMask, bestV);

  // Walk it: from the start, visit branches holding pots first (so their ink pays for later steps),
  // come back along each branch for free, end at v, then take the last leg to the goal. Subtrees
  // can share words, so first take a spanning tree of the edges (breadth-first from the start).
  const nbrs = new Map<number, number[]>();
  for (const [a, b] of edges) {
    nbrs.set(a, [...(nbrs.get(a) ?? []), b]);
    nbrs.set(b, [...(nbrs.get(b) ?? []), a]);
  }
  const children = new Map<number, number[]>();
  const seen = new Set([s]);
  for (const queue = [s]; queue.length; ) {
    const u = queue.shift()!;
    for (const c of nbrs.get(u) ?? []) {
      if (seen.has(c)) continue;
      seen.add(c);
      children.set(u, [...(children.get(u) ?? []), c]);
      queue.push(c);
    }
  }
  const potSet = new Set(terminals.slice(1));
  const holds = (node: number, target: (x: number) => boolean): boolean => target(node) || (children.get(node) ?? []).some((c) => holds(c, target));
  const walk: number[] = [s];
  const visit = (node: number) => {
    const kids = children.get(node) ?? [];
    const toEnd = kids.find((c) => holds(c, (x) => x === bestV));
    const rest = kids.filter((c) => c !== toEnd).sort((a, b) => Number(holds(b, (x) => potSet.has(x))) - Number(holds(a, (x) => potSet.has(x))));
    for (const c of rest) {
      walk.push(c);
      visit(c);
      walk.push(node);
    }
    if (toEnd !== undefined) {
      walk.push(toEnd);
      visit(toEnd);
    }
  };
  visit(s);
  for (let c = toGoal.prev[bestV]; c >= 0; c = toGoal.prev[c]) walk.push(c);

  const route = walk.map((i) => words[i]);
  return { pots, best: scoreWalk(route, pots), walk: route, bound: bestCost };
}

function popcount(x: number) {
  let c = 0;
  for (; x; x &= x - 1) c++;
  return c;
}

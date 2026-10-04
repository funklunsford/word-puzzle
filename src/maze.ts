// The maze graph: rooms are words, a door joins two words at most STEP_LIMIT stroke edits apart.
// Shared by scripts/mazes.ts (the fixed puzzle) and the app's dev button (random puzzles).

import { STEP_LIMIT, wordDistance } from './strokes';

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

/** Cheapest strokes (and rooms) from `src` to every word. */
export function dijkstra(adj: Graph, src: number) {
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
      if (done.has(to)) continue;
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
 * A random puzzle shaped like WILD → TAME: a start with a few doors, and a goal 4–7 rooms and
 * 10–20 strokes away, so there's a real route to find but it isn't a slog.
 */
export function randomPuzzle(words: string[], adj: Graph, random = Math.random): Puzzle {
  const starts = words.map((_, i) => i).filter((i) => adj[i].length >= 3);
  for (;;) {
    const s = starts[Math.floor(random() * starts.length)];
    const { dist, hops } = dijkstra(adj, s);
    const goals = words
      .map((_, i) => i)
      .filter((i) => hops[i] >= 4 && hops[i] <= 7 && dist[i] >= 10 && dist[i] <= 20 && adj[i].length >= 2);
    if (!goals.length) continue;
    const g = goals[Math.floor(random() * goals.length)];
    return solve(words, adj, words[s], words[g])!;
  }
}

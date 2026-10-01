// Build the 4-letter stroke maze from ENABLE and pick start/goal puzzles.
//
//   npx vite-node scripts/mazes.ts
//
// Rooms are words; a door joins two words that are at most STEP_LIMIT stroke edits apart.
// Each puzzle's `best` is the cheapest route in total strokes (Dijkstra).

import { readFileSync, writeFileSync } from 'node:fs';
import { STEP_LIMIT, wordDistance } from '../src/strokes';

const LENGTH = 4;
const MIN_BEST = 10;
const MAX_BEST = 16;
const MIN_HOPS = 4;
const PICK = 8;

const words = readFileSync(new URL('../data/enable1.txt', import.meta.url), 'utf8')
  .split('\n')
  .map((w) => w.trim().toUpperCase())
  .filter((w) => w.length === LENGTH && /^[A-Z]+$/.test(w));

console.time('graph');
const adj: { to: number; cost: number }[][] = words.map(() => []);
for (let i = 0; i < words.length; i++) {
  for (let j = i + 1; j < words.length; j++) {
    let diff = 0;
    for (let k = 0; k < LENGTH; k++) if (words[i][k] !== words[j][k]) diff++;
    if (diff > STEP_LIMIT) continue; // every changed letter costs at least one stroke
    const cost = wordDistance(words[i], words[j]);
    if (cost <= STEP_LIMIT) {
      adj[i].push({ to: j, cost });
      adj[j].push({ to: i, cost });
    }
  }
}
console.timeEnd('graph');

function dijkstra(src: number) {
  const dist = new Array(words.length).fill(Infinity);
  const hops = new Array(words.length).fill(0);
  const prev = new Array(words.length).fill(-1);
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

const degree = adj.map((a) => a.length);
const connected = degree.filter((d) => d > 0).length;
console.log(`${words.length} words, ${connected} with at least one door, median doors ${[...degree].sort((a, b) => a - b)[degree.length >> 1]}`);

// Deterministic pseudo-random order so reruns give the same puzzles.
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const starts = words.map((_, i) => i).filter((i) => degree[i] >= 3).sort(() => rand() - 0.5);

const puzzles: { start: string; goal: string; best: number; path: string[] }[] = [];
const used = new Set<string>();
for (const s of starts) {
  if (puzzles.length >= PICK) break;
  if (used.has(words[s])) continue;
  const { dist, hops, prev } = dijkstra(s);
  const goals = words
    .map((_, i) => i)
    .filter((i) => dist[i] >= MIN_BEST && dist[i] <= MAX_BEST && hops[i] >= MIN_HOPS && degree[i] >= 2 && !used.has(words[i]));
  if (!goals.length) continue;
  const g = goals[Math.floor(rand() * goals.length)];
  const path: string[] = [];
  for (let c = g; c >= 0; c = prev[c]) path.unshift(words[c]);
  puzzles.push({ start: words[s], goal: words[g], best: dist[g], path });
  path.forEach((w) => used.add(w));
  console.log(`${words[s]} → ${words[g]}  best ${dist[g]} strokes / ${hops[g]} rooms   ${path.join(' → ')}`);
}

writeFileSync(new URL('../public/mazes.json', import.meta.url), JSON.stringify({ words, puzzles }));
console.log(`wrote ${puzzles.length} puzzles`);

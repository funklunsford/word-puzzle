// Build the stroke maze: one fixed puzzle over familiar 4-letter words.
//
//   npx vite-node scripts/mazes.ts
//
// Rooms are the words in data/familiar-4.txt (see scripts/familiar.ts); a door joins two words
// that are at most STEP_LIMIT stroke edits apart. The puzzle's `best` is the cheapest route from
// START to GOAL in total strokes (Dijkstra).

import { readFileSync, writeFileSync } from 'node:fs';
import { STEP_LIMIT, wordDistance } from '../src/strokes';
import { parseWordList } from '../src/wordlist';

const LENGTH = 4;
// Opposites make a nice maze: 14 strokes over 5 rooms, all everyday words.
const START = 'WILD';
const GOAL = 'TAME';

const words = parseWordList(readFileSync(new URL('../data/familiar-4.txt', import.meta.url), 'utf8'));

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

const s = words.indexOf(START);
const g = words.indexOf(GOAL);
if (s < 0 || g < 0) throw new Error(`${START} and ${GOAL} must both be in the word list`);
const { dist, hops, prev } = dijkstra(s);
if (!Number.isFinite(dist[g])) throw new Error(`${GOAL} is not reachable from ${START}`);
const path: string[] = [];
for (let c = g; c >= 0; c = prev[c]) path.unshift(words[c]);
const puzzle = { start: START, goal: GOAL, best: dist[g], path };
console.log(`${START} → ${GOAL}: best ${dist[g]} strokes / ${hops[g]} rooms, ${degree[s]} doors at the start   ${path.join(' → ')}`);

writeFileSync(new URL('../public/mazes.json', import.meta.url), JSON.stringify({ words, puzzle }));

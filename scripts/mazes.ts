// Build the stroke maze over familiar 4-letter words: a pool of puzzles the game picks from on each
// load, plus the original fixed puzzle (WILD → TAME), kept as a reference and for tests.
//
//   npx vite-node scripts/mazes.ts
//
// Rooms are the words in data/familiar-4.txt (see scripts/familiar.ts); a door joins two words
// that are at most STEP_LIMIT stroke edits apart (see src/maze.ts). The puzzle's `best` is the
// cheapest route from START to GOAL in total strokes (Dijkstra).

import { readFileSync, writeFileSync } from 'node:fs';
import { placePots, potRoute, potValues } from '../src/inkpots';
import { POOL_MIX, PUZZLE_SHAPE, buildGraph, classifyNeed, isObvious, randomPuzzle, routeWords, seededRandom, solve, type Need } from '../src/maze';
import { parseWordList } from '../src/wordlist';

// Opposites make a nice maze: 14 strokes over 5 rooms, all everyday words.
const START = 'WILD';
const GOAL = 'TAME';

const words = parseWordList(readFileSync(new URL('../data/familiar-4.txt', import.meta.url), 'utf8'));

console.time('graph');
const adj = buildGraph(words);
console.timeEnd('graph');

const degree = adj.map((a) => a.length);
const connected = degree.filter((d) => d > 0).length;
console.log(`${words.length} words, ${connected} with at least one door, median doors ${[...degree].sort((a, b) => a - b)[degree.length >> 1]}`);

const puzzle = solve(words, adj, START, GOAL);
if (!puzzle) throw new Error(`${GOAL} must be reachable from ${START}, and both must be in the word list`);
console.log(`${START} → ${GOAL}: best ${puzzle.best} strokes / ${puzzle.path.length - 1} rooms, ${degree[words.indexOf(START)]} doors at the start   ${puzzle.path.join(' → ')}`);

// Ink pots (the `inkPots` modifier): placed with a fixed seed so the puzzle is the same for everyone.
const pots = placePots(words, adj, START, GOAL, puzzle.best, puzzle.path, seededRandom(4));
const value = potValues(adj, words.indexOf(START), words.indexOf(GOAL), puzzle.best);
const ink = potRoute(words, adj, START, GOAL, pots);
const label = (v: number) => (v > 0 ? 'saves a stroke' : v === 0 ? 'break-even' : 'costs a stroke');
console.log(`ink pots: ${pots.map((p) => `${p} (${label(value[words.indexOf(p)])})`).join(', ')}; best with pots ${ink.best}   ${ink.walk.join(' → ')}`);
const inkPots = { pots, best: ink.best, walk: ink.walk };

// The pool the game picks a puzzle from on each load. Starts and goals are everyday base words
// (in data/everyday-4.txt, defined as a noun, verb or adjective rather than a plural, past tense,
// pronoun or archaic form), so a puzzle never opens on HAST, SOPS or SENT; the words between are any.
// Its mix is set by quota (POOL_MIX in src/maze.ts), evenly across the best totals (9, 10 and 11).
const POOL = 420;
const { tricky: TRICKY, need: NEED } = POOL_MIX;
const everyday = new Set(parseWordList(readFileSync(new URL('../data/everyday-4.txt', import.meta.url), 'utf8')));
const definitions = JSON.parse(readFileSync(new URL('../public/definitions.json', import.meta.url), 'utf8'));
const endpoint = (w: string) => {
  const d = definitions[w];
  return everyday.has(w) && Array.isArray(d) && d.length === 2 && ['n.', 'v.', 'adj.'].includes(d[0]) && !/old-fashioned|\(past of/.test(d[1]) && !/[^s]s$/i.test(w);
};
// Quota per cell: (best, need, tricky or obvious)
const bests = Array.from({ length: PUZZLE_SHAPE.best[1] - PUZZLE_SHAPE.best[0] + 1 }, (_, i) => PUZZLE_SHAPE.best[0] + i);
const quota = new Map<string, number>();
for (const b of bests) {
  for (const need of Object.keys(NEED) as Need[]) {
    const n = Math.round((POOL / bests.length) * NEED[need]);
    const tricky = Math.round(n * TRICKY);
    quota.set(`${b}|${need}|tricky`, tricky);
    quota.set(`${b}|${need}|obvious`, n - tricky);
  }
}
const target = [...quota.values()].reduce((t, n) => t + n, 0);
const random = seededRandom(7);
const seen = new Set<string>();
const puzzles = [];
const tries = new Map<string, number>();
let attempts = 0;
console.time('pool');
while (puzzles.length < target) {
  if (++attempts > 200_000) {
    const starved = [...quota].filter(([, n]) => n > 0).map(([k, n]) => `${k} (${n} short)`);
    throw new Error(`gave up filling the pool after ${attempts - 1} candidates; still short: ${starved.join(', ')}`);
  }
  const p = randomPuzzle(words, adj, random, endpoint);
  if (seen.has(p.start + p.goal) || seen.has(p.goal + p.start)) continue;
  const kind = isObvious(words, adj, p.start, p.goal, p.best) ? 'obvious' : 'tricky';
  if (![...quota].some(([k, n]) => n > 0 && k.startsWith(`${p.best}|`) && k.endsWith(`|${kind}`))) continue;
  const { need, path } = classifyNeed(words, adj, p.start, p.goal, p.best);
  const cell = `${p.best}|${need}|${kind}`;
  tries.set(cell, (tries.get(cell) ?? 0) + 1);
  if (!quota.get(cell)) continue;
  quota.set(cell, quota.get(cell)! - 1);
  seen.add(p.start + p.goal);
  const puzzle = { ...p, path };
  const potWords = placePots(words, adj, p.start, p.goal, p.best, path, random);
  const { bound: _bound, ...plan } = potRoute(words, adj, p.start, p.goal, potWords);
  puzzles.push({ puzzle, need, tricky: kind === 'tricky', inkPots: plan, onRoute: routeWords(words, adj, p.start, p.goal) });
}
console.timeEnd('pool');
const mean = puzzles.reduce((t, x) => t + x.puzzle.best, 0) / puzzles.length;
const share = (need: Need) => `${Math.round((100 * puzzles.filter((x) => x.need === need).length) / puzzles.length)}%`;
console.log(`pool: ${puzzles.length} puzzles from ${attempts} candidates, best ${mean.toFixed(2)} on average; needs no C/I/V ${share('none')}, C/I/V in start or goal ${share('letter')}, a stepping stone ${share('stone')}`);
console.log(`candidates seen per cell: ${[...tries].sort().map(([k, n]) => `${k} ${n}`).join(', ')}`);
console.log(`e.g. ${puzzles.slice(0, 8).map((x) => `${x.puzzle.start} → ${x.puzzle.goal} (${x.puzzle.best}, ${x.need})`).join(', ')}`);

// The graph itself goes along too: each word's doors as [to, cost, to, cost, ...] (word indexes),
// so the game never has to search a step's cost (hints, words within reach, hardcore).
const doors = adj.map((a) => a.flatMap((e) => [e.to, e.cost]));
writeFileSync(new URL('../public/mazes.json', import.meta.url), JSON.stringify({ words, doors, puzzle, inkPots, onRoute: routeWords(words, adj, START, GOAL), puzzles }));

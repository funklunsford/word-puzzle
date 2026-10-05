// Build the stroke maze: one fixed puzzle over familiar 4-letter words.
//
//   npx vite-node scripts/mazes.ts
//
// Rooms are the words in data/familiar-4.txt (see scripts/familiar.ts); a door joins two words
// that are at most STEP_LIMIT stroke edits apart (see src/maze.ts). The puzzle's `best` is the
// cheapest route from START to GOAL in total strokes (Dijkstra).

import { readFileSync, writeFileSync } from 'node:fs';
import { placePots, potRoute, potValues } from '../src/inkpots';
import { buildGraph, seededRandom, solve } from '../src/maze';
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

writeFileSync(new URL('../public/mazes.json', import.meta.url), JSON.stringify({ words, puzzle, inkPots }));

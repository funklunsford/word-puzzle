// Build the stroke maze over familiar 4-letter words, with the original fixed puzzle (WILD → TAME),
// kept as a reference and for tests, and the pool of puzzles the dailies are chosen from (see
// scripts/daily.ts). With --letters 5, the 5-letter game's maze over 5-letter words (SHARP → BLUNT).
//
//   npx vite-node scripts/mazes.ts [--letters 5] [--size 1200] [--seed 7]
//
// It writes the maze to public/mazes.json (mazes-5.json at 5 letters) and the pool beside it, in
// public/pool.json (pool-5.json). The game loads the maze on every visit, but the pool only for the
// freshPuzzle flag, so players don't download it. --size is how many puzzles the pool holds (1,200 at
// 5 letters, over three years of dailies; 420 at 4), and --seed which ones: another seed gives another
// pool from the same words, for when the dailies have used up most of this one. At 5 letters 12-stroke
// puzzles set the limit: few keep the rules, and they dry up fast. Building 2,000 (a quarter at each of
// 12 to 15 strokes) gave up after 200,000 candidates with 361 of its 500 at 12 strokes, having found the
// first 105 in about 10,000. A new seed will mostly find the same ones.
//
// Rooms are the words in data/familiar-4.txt (see scripts/familiar.ts); a door joins two words
// that are at most STEP_LIMIT stroke edits apart (see src/maze.ts). The puzzle's `best` is the
// cheapest route from START to GOAL in total strokes (Dijkstra).
//
// For comparing pools (docs/difficulty-5-letters.md), without touching the shipped one:
//   --out FILE     write the pool there instead (the maze is the same for any pool from these words,
//                  so it's left alone)
//   --rule meet    pick puzzles that are tricky and defeat working back from the goal (meetDepth
//                  of 2 or more), with no pocket needed: the 5-letter default
//   --rule pocket  pick puzzles that are tricky with a pocket beside the route: the 4-letter default
//   --best 13-16   another range of lowest strokes
//   --steps 4-5    another range of doors on the route (words after the start)
//
// Easycore, the shorter game for 11- to 15-year-olds, has a pool of its own, made its own way (see
// easyPool, at the end) from the simple words in data/simple-5.txt:
//   npx vite-node scripts/mazes.ts --letters 5 --easy [--size 1100] [--seed 7]
// writes public/pool-5-easy.json (or --out FILE), in the dailies' pool's format, and leaves the maze
// and that pool alone. Its days are picked from it by date (src/easycore.ts), so once it ships,
// rebuilding it changes every Easycore day, past ones too.

import { readFileSync, writeFileSync } from 'node:fs';
import { distancesFrom, findPockets, isTricky, keep, measure, meetDepth, parChance, walkChance, type Difficulty } from '../src/difficulty';
import { placePots, potRoute, potValues } from '../src/inkpots';
import { EASY_SHAPE, POOL_MIXES, PUZZLE_SHAPES, buildGraph, classifyNeed, randomPuzzle, routeWords, seededRandom, solve, type Need } from '../src/maze';
import { parseWordList } from '../src/wordlist';

const option = (name: string) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const LETTERS = Number(option('--letters') ?? 4);
const EASY = process.argv.includes('--easy');
if (![4, 5].includes(LETTERS) || (EASY && LETTERS !== 5))
  throw new Error('usage: vite-node scripts/mazes.ts [--letters 5 [--easy]] [--size 1200] [--seed 7] [--out FILE] [--rule meet] [--best 13-16] [--steps 4-5]');
const suffix = LETTERS === 4 ? '' : `-${LETTERS}`;
const OUT = option('--out');
const RULE = option('--rule') ?? (LETTERS === 5 ? 'meet' : 'pocket');
if (!['pocket', 'meet'].includes(RULE)) throw new Error('--rule takes pocket or meet');
const BEST = option('--best')?.split('-').map(Number) as [number, number] | undefined;
const STEPS = option('--steps')?.split('-').map(Number) as [number, number] | undefined;

// Opposites make a nice maze: WILD → TAME, 13 strokes over 5 rooms, all everyday words. Most
// 5-letter opposites can't reach each other (BLACK, WHITE); SHARP → BLUNT can, in 20.
const [START, GOAL] = LETTERS === 4 ? ['WILD', 'TAME'] : ['SHARP', 'BLUNT'];

const words = parseWordList(readFileSync(new URL(`../data/familiar-${LETTERS}.txt`, import.meta.url), 'utf8'));

console.time('graph');
const adj = buildGraph(words);
console.timeEnd('graph');

const degree = adj.map((a) => a.length);
const connected = degree.filter((d) => d > 0).length;
console.log(`${words.length} words, ${connected} with at least one door, median doors ${[...degree].sort((a, b) => a - b)[degree.length >> 1]}`);
const pockets = findPockets(adj);
console.log(`${pockets.sizes.length} pockets (parts of the maze hanging off the rest by one word), ${pockets.sizes.reduce((a, b) => a + b, 0)} words in them`);

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

// How many puzzles the pool holds, which ones, and their lowest strokes and doors (see below).
const POOL = Number(option('--size') ?? (EASY ? 1100 : LETTERS === 5 ? 1200 : 420));
const SEED = Number(option('--seed') ?? 7);
const SHAPE = { ...(EASY ? EASY_SHAPE : PUZZLE_SHAPES[LETTERS]), ...(BEST && { best: BEST }), ...(STEPS && { steps: STEPS }) };
// A base word: defined as a noun, verb or adjective, rather than a plural, past tense, pronoun or
// archaic form. The dailies start and end on these (see below), and Easycore does where it can.
const definitions = JSON.parse(readFileSync(new URL(`../public/definitions${suffix}.json`, import.meta.url), 'utf8'));
const baseWord = (w: string) => {
  const d = definitions[w];
  return Array.isArray(d) && d.length === 2 && ['n.', 'v.', 'adj.'].includes(d[0]) && !/old-fashioned|\(past of/.test(d[1]) && !/[^s]s$/i.test(w);
};

// Easycore's pool is made its own way (see easyPool, at the end), and nothing else is written.
if (EASY) {
  writeFileSync(OUT ?? new URL('../public/pool-5-easy.json', import.meta.url), JSON.stringify(easyPool()));
  process.exit();
}

// The pool the dailies are chosen from. Starts and goals are everyday base words (in
// data/everyday-4.txt, defined as a noun, verb or adjective rather than a plural, past tense,
// pronoun or archaic form), so a puzzle never opens on HAST, SOPS or SENT; the words between are any.
// Every puzzle is tricky (no rule of thumb makes par). At 4 letters it also passes a pocket: a word on
// a lowest-stroke route opens onto part of the maze that only leads back. At 5 letters it instead
// holds out against working back from the goal: with the goal's side mapped 3 doors back, the way
// there still takes planning 2 steps ahead (meetDepth; see src/difficulty.ts and
// docs/difficulty-5-letters.md). Its mix is set by quota (POOL_MIXES in src/maze.ts), evenly across
// the best totals (9, 10 and 11; 12 to 15 for 5-letter words, whose pool is balanced by best total
// alone).
const MIX = POOL_MIXES[LETTERS];
const everyday = new Set(parseWordList(readFileSync(new URL(`../data/everyday-${LETTERS}.txt`, import.meta.url), 'utf8')));
const endpoint = (w: string) => everyday.has(w) && baseWord(w);
// Quota per cell: (best, need), or (best) alone when the mix isn't set
const bests = Array.from({ length: SHAPE.best[1] - SHAPE.best[0] + 1 }, (_, i) => SHAPE.best[0] + i);
const quota = new Map<string, number>();
for (const b of bests) {
  if (!MIX) quota.set(`${b}|any`, Math.round(POOL / bests.length));
  else for (const need of Object.keys(MIX.need) as Need[]) quota.set(`${b}|${need}`, Math.round((POOL / bests.length) * MIX.need[need]));
}
const target = [...quota.values()].reduce((t, n) => t + n, 0);
const random = seededRandom(SEED);
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
  const p = randomPuzzle(words, adj, random, endpoint, SHAPE);
  if (seen.has(p.start + p.goal) || seen.has(p.goal + p.start)) continue;
  if (![...quota].some(([k, n]) => n > 0 && k.startsWith(`${p.best}|`))) continue;
  // The cheap measures first: only a tricky puzzle goes on that passes a pocket (the pocket rule) or
  // that working back from the goal and then taking the door that looks best doesn't solve (meet).
  const difficulty: Difficulty = measure(words, adj, p, pockets);
  if (!isTricky(difficulty)) continue;
  if (RULE === 'pocket' ? !difficulty.pocketsBeside : meetDepth(words, adj, p) < 2) continue;
  const { need, path } = classifyNeed(words, adj, p.start, p.goal, p.best);
  const cell = `${p.best}|${MIX ? need : 'any'}`;
  tries.set(cell, (tries.get(cell) ?? 0) + 1);
  if (!quota.get(cell)) continue;
  quota.set(cell, quota.get(cell)! - 1);
  seen.add(p.start + p.goal);
  const puzzle = { ...p, path };
  const potWords = placePots(words, adj, p.start, p.goal, p.best, path, random);
  const { bound: _bound, ...plan } = potRoute(words, adj, p.start, p.goal, potWords);
  puzzles.push({ puzzle, need, tricky: true, difficulty: keep(difficulty, parChance(words, adj, puzzle)), inkPots: plan, onRoute: routeWords(words, adj, p.start, p.goal) });
}
console.timeEnd('pool');
const mean = puzzles.reduce((t, x) => t + x.puzzle.best, 0) / puzzles.length;
const share = (need: Need) => `${Math.round((100 * puzzles.filter((x) => x.need === need).length) / puzzles.length)}%`;
console.log(`pool: ${puzzles.length} puzzles from ${attempts} candidates, best ${mean.toFixed(2)} on average; needs no C/I/V ${share('none')}, C/I/V in start or goal ${share('letter')}, a stepping stone ${share('stone')}`);
const chances = puzzles.map((x) => x.difficulty.parChance).sort((a, b) => a - b);
const depths = [1, 2, 3, 4].map((k) => puzzles.filter((x) => x.difficulty.depth === k).length);
console.log(`difficulty: par chance median ${chances[chances.length >> 1]} (from ${chances[0]} to ${chances[chances.length - 1]}); depth 2/3/4+: ${depths.slice(1).join('/')}; with a trap ${puzzles.filter((x) => x.difficulty.traps.length).length}, a trap into a pocket ${puzzles.filter((x) => x.difficulty.pocketTrap).length}`);
const endpoints = new Set(puzzles.flatMap((x) => [x.puzzle.start, x.puzzle.goal]));
console.log(`${endpoints.size} different start and goal words`);
// Against a player who works back from the goal first (see meetDepth and walkChance).
const meet = puzzles.map((x) => ({ depth: meetDepth(words, adj, x.puzzle), chance: walkChance(words, adj, x.puzzle, { target: 'meet', sure: true }).par }));
const meetChances = meet.map((x) => x.chance).sort((a, b) => a - b);
console.log(`working back from the goal: meet depth 1/2/3/4+: ${[1, 2, 3, 4].map((k) => meet.filter((x) => x.depth === k).length).join('/')}; par chance median ${meetChances[meetChances.length >> 1]}, mean ${(meetChances.reduce((a, b) => a + b, 0) / meetChances.length).toFixed(2)}`);
console.log(`candidates seen per cell: ${[...tries].sort().map(([k, n]) => `${k} ${n}`).join(', ')}`);
console.log(`e.g. ${puzzles.slice(0, 8).map((x) => `${x.puzzle.start} → ${x.puzzle.goal} (${x.puzzle.best}, ${x.need})`).join(', ')}`);

// The graph itself goes along too: each word's doors as [to, cost, to, cost, ...] (word indexes),
// so the game never has to search a step's cost (hints, words within reach, hardcore).
const doors = adj.map((a) => a.flatMap((e) => [e.to, e.cost]));
if (!OUT) writeFileSync(new URL(`../public/mazes${suffix}.json`, import.meta.url), JSON.stringify({ words, doors, puzzle, inkPots, onRoute: routeWords(words, adj, START, GOAL) }));
writeFileSync(OUT ?? new URL(`../public/pool${suffix}.json`, import.meta.url), JSON.stringify({ seed: SEED, puzzles }));

// ---------- Easycore's pool (--easy) ----------

/**
 * Easycore's pool: puzzles of SHAPE (EASY_SHAPE: lowest 5–8 strokes over 2–3 doors) on the simple
 * words in data/simple-5.txt. There are few enough pairs of them to try every one, so none is drawn
 * at random as the dailies' are (drawing would mostly find the same ones again). A pair is a puzzle when:
 * - its lowest strokes over the whole maze are in range. Every familiar word counts in play, so the
 *   score is against the true lowest;
 * - some lowest-stroke route goes through simple words alone, over a number of doors in range. The
 *   one with the fewest doors is kept as its path (Show lowest-stroke route);
 * - each end has 2 doors or more, so neither the first step nor the last is a lone word to find;
 * - the simulated player (parChance) makes par at least a fifth of the time, one way round or both.
 *   It goes that way round (if both, either at random).
 * Then POOL of them, in a seeded random order but with those that start and end on base words first,
 * spread evenly across the lowest strokes as far as each has enough (7 has fewest), the rest going
 * to the others.
 */
function easyPool() {
  const EASY_PAR = 0.2;
  const simple = new Set(parseWordList(readFileSync(new URL('../data/simple-5.txt', import.meta.url), 'utf8')));
  const ends = words.map((_, i) => i).filter((i) => simple.has(words[i]));
  const [lo, hi] = SHAPE.best;
  const bests = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
  const random = seededRandom(SEED);
  // How many pairs pass each test in turn, by their lowest strokes.
  const stages = ['in range', 'by simple words', 'over few doors', 'with doors at each end', `made at par ${EASY_PAR * 100}%+`];
  const passed = stages.map(() => bests.map(() => 0));
  let pairs = 0;
  const candidates: { start: string; goal: string; best: number; path: string[]; chance: number }[] = [];
  for (const s of ends) {
    const all = distancesFrom(adj, s);
    const route = fewestDoors(s, (v) => simple.has(words[v]), hi);
    for (const g of ends) {
      if (g <= s) continue; // each pair once, either way round
      pairs++;
      const best = all[g];
      const tally = (stage: number) => passed[stage][best - lo]++;
      if (best < lo || best > hi) continue;
      tally(0);
      if (route.dist[g] !== best) continue;
      tally(1);
      if (route.doors[g] < SHAPE.steps[0] || route.doors[g] > SHAPE.steps[1]) continue;
      tally(2);
      if (adj[s].length < 2 || adj[g].length < 2) continue;
      tally(3);
      const path: string[] = [];
      for (let c = g; c >= 0; c = route.prev[c]) path.unshift(words[c]);
      const ways = [
        { start: words[s], goal: words[g], best, path },
        { start: words[g], goal: words[s], best, path: [...path].reverse() },
      ]
        .map((p) => ({ ...p, chance: parChance(words, adj, p) }))
        .filter((p) => p.chance >= EASY_PAR);
      if (!ways.length) continue;
      tally(4);
      candidates.push(ways[ways.length > 1 ? Math.floor(random() * 2) : 0]);
    }
  }
  const per = (counts: number[]) => `${counts.reduce((a, b) => a + b, 0)} (${bests.map((b, i) => `${b}: ${counts[i]}`).join(', ')})`;
  console.log(`Easycore: ${ends.length} simple words, ${pairs} pairs of them. With lowest strokes ${lo}-${hi}, by lowest strokes:`);
  stages.forEach((stage, i) => console.log(`  ${stage}: ${per(passed[i])}`));

  // A seeded random order, with puzzles that start and end on base words first, as the dailies always
  // do (there aren't enough for a pool of them alone: most simple words that link up are plurals and
  // verb forms like TALKS and FILED). Then a quota for each lowest strokes: an even share, or all there are.
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const bases = (p: { start: string; goal: string }) => Number(baseWord(p.start)) + Number(baseWord(p.goal));
  candidates.sort((a, b) => bases(b) - bases(a));
  console.log(`  of those, base words at both ends ${candidates.filter((c) => bases(c) === 2).length}, at one ${candidates.filter((c) => bases(c) === 1).length}`);
  const supply = (b: number) => candidates.filter((c) => c.best === b).length;
  const quota = new Map<number, number>();
  let left = POOL;
  [...bests]
    .sort((a, b) => supply(a) - supply(b))
    .forEach((b, k) => {
      quota.set(b, Math.min(supply(b), Math.round(left / (bests.length - k))));
      left -= quota.get(b)!;
    });
  if (left > 0) console.warn(`only ${POOL - left} puzzles of the ${POOL} asked for: try --best ${lo}-${hi + 1}`);
  const picked: typeof candidates = [];
  for (const c of candidates) {
    if (!quota.get(c.best)) continue;
    quota.set(c.best, quota.get(c.best)! - 1);
    picked.push(c);
  }

  console.time('pool');
  const puzzles = picked.map(({ chance, ...puzzle }) => {
    const { start, goal, best, path } = puzzle;
    const difficulty = measure(words, adj, puzzle, pockets);
    const potWords = placePots(words, adj, start, goal, best, path, random);
    const { bound: _bound, ...plan } = potRoute(words, adj, start, goal, potWords);
    return { puzzle, need: classifyNeed(words, adj, start, goal, best).need, tricky: isTricky(difficulty), difficulty: keep(difficulty, chance), inkPots: plan, onRoute: routeWords(words, adj, start, goal) };
  });
  console.timeEnd('pool');

  const count = (test: (x: (typeof puzzles)[number]) => boolean) => puzzles.filter(test).length;
  const chances = puzzles.map((x) => x.difficulty.parChance).sort((a, b) => a - b);
  const at = (q: number) => chances[Math.min(chances.length - 1, Math.floor(q * chances.length))];
  const mean = (xs: number[]) => (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2);
  console.log(`pool: ${puzzles.length} puzzles; lowest strokes ${per(bests.map((b) => count((x) => x.puzzle.best === b)))}, ${mean(puzzles.map((x) => x.puzzle.best))} on average`);
  console.log(`  doors on the simple route: ${SHAPE.steps.map((k) => `${k}: ${count((x) => x.puzzle.path.length - 1 === k)}`).join(', ')}`);
  console.log(`  par chance: ${at(0)} to ${chances[chances.length - 1]}, quartiles ${at(0.25)} / ${at(0.5)} / ${at(0.75)}, mean ${mean(chances)}`);
  console.log(`  tricky (no rule of thumb makes par) ${count((x) => x.tricky)}; needs no C/I/V ${count((x) => x.need === 'none')}, C/I/V in start or goal ${count((x) => x.need === 'letter')}, a stepping stone ${count((x) => x.need === 'stone')}`);
  const uses = new Map<string, number>();
  for (const { puzzle: p } of puzzles) for (const w of [p.start, p.goal]) uses.set(w, (uses.get(w) ?? 0) + 1);
  const most = [...uses].sort((a, b) => b[1] - a[1]).slice(0, 5);
  console.log(`  ${uses.size} different start and goal words; most used: ${most.map(([w, n]) => `${w} ${n}`).join(', ')}`);
  console.log(`  base words at both ends ${count((x) => bases(x.puzzle) === 2)}, at one ${count((x) => bases(x.puzzle) === 1)}, at neither ${count((x) => bases(x.puzzle) === 0)}`);
  console.log(`  e.g. ${puzzles.slice(0, 8).map((x) => `${x.puzzle.path.join(' → ')} (${x.puzzle.best})`).join('; ')}`);
  return { seed: SEED, puzzles };
}

/**
 * The cheapest routes from `src`, up to `limit` strokes, through words `ok` allows: by strokes, then
 * by fewest doors. Door costs are 1 to 3, so the words a stroke count apart are taken in turn, and
 * every word before one on its cheapest routes is settled by the time it's reached.
 */
function fewestDoors(src: number, ok: (v: number) => boolean, limit: number) {
  const dist = new Float64Array(words.length).fill(Infinity);
  const doors = new Float64Array(words.length).fill(Infinity);
  const prev = new Int32Array(words.length).fill(-1);
  dist[src] = doors[src] = 0;
  const buckets: number[][] = [[src]];
  for (let d = 0; d < buckets.length; d++) {
    for (const u of buckets[d] ?? []) {
      if (dist[u] !== d) continue;
      for (const { to, cost } of adj[u]) {
        const nd = d + cost;
        if (nd > limit || !ok(to)) continue;
        if (nd < dist[to]) (buckets[nd] ??= []).push(to);
        if (nd < dist[to] || (nd === dist[to] && doors[u] + 1 < doors[to])) [dist[to], doors[to], prev[to]] = [nd, doors[u] + 1, u];
      }
    }
  }
  return { dist, doors, prev };
}

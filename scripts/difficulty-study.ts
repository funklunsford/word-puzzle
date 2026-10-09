// The study behind docs/difficulty-5-letters.md: how the pool plays for a player who works back from
// the goal first, against one who heads forward, and which measures and selection rules tell them apart.
//
//   npx vite-node scripts/difficulty-study.ts pool [--letters 4|5] [--pool FILE] [--games 400]
//   npx vite-node scripts/difficulty-study.ts stream [--best 12-15] [--candidates 3000] [--games 200]
//
// `pool` scores every puzzle of a pool (public/mazes-5.json by default, or one rebuilt with
// scripts/mazes.ts --out) and the dailies; `stream` draws candidates the way scripts/mazes.ts does and
// scores every one, kept or not, to compare selection rules. Both print the doc's tables in markdown.
// Everything is seeded, so the same files give the same numbers.

import { readFileSync, readdirSync } from 'node:fs';
import {
  distancesFrom,
  findPockets,
  goalSide,
  isTricky,
  lettersApart,
  measure,
  meetDepth,
  planChance,
  reversed,
  searchEffort,
  walkChance,
} from '../src/difficulty';
import { classifyNeed, isObvious, randomPuzzle, seededRandom, type Graph, type Puzzle } from '../src/maze';
import { strokeDiff } from '../src/strokes';
import { parseWordList } from '../src/wordlist';

const [mode = 'pool'] = process.argv.slice(2);
const option = (name: string) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const LETTERS = Number(option('--letters') ?? 5);
const suffix = LETTERS === 4 ? '' : `-${LETTERS}`;
const root = new URL('../', import.meta.url);
const maze = JSON.parse(readFileSync(option('--pool') ?? new URL(`public/mazes${suffix}.json`, root), 'utf8'));
const words: string[] = maze.words;
const adj: Graph = (maze.doors as number[][]).map((flat) => Array.from({ length: flat.length / 2 }, (_, k) => ({ to: flat[2 * k], cost: flat[2 * k + 1] })));
const index = new Map(words.map((w, i) => [w, i]));
const pockets = findPockets(adj);

type Row = Record<string, number | string>;
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const pct = (x: number) => (Number.isNaN(x) ? '–' : `${Math.round(100 * x)}%`);
const f2 = (x: number) => (Math.abs(x) < 0.005 ? '0.00' : x.toFixed(2));

/** Spearman's rank correlation (ties share their average rank). */
function spearman(x: number[], y: number[]): number {
  const rank = (a: number[]) => {
    const order = a.map((v, i) => [v, i] as const).sort((p, q) => p[0] - q[0]);
    const r = new Array<number>(a.length);
    for (let i = 0; i < order.length; ) {
      let j = i;
      while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j++;
      for (let k = i; k <= j; k++) r[order[k][1]] = (i + j) / 2;
      i = j + 1;
    }
    return r;
  };
  const [rx, ry] = [rank(x), rank(y)];
  const [mx, my] = [mean(rx), mean(ry)];
  let [num, dx, dy] = [0, 0, 0];
  for (let i = 0; i < rx.length; i++) {
    num += (rx[i] - mx) * (ry[i] - my);
    dx += (rx[i] - mx) ** 2;
    dy += (ry[i] - my) ** 2;
  }
  return dx && dy ? num / Math.sqrt(dx * dy) : 0;
}
/** The rank correlation of x and y once z is held fixed. */
const partial = (x: number[], y: number[], z: number[]) => {
  const [a, b, c] = [spearman(x, y), spearman(x, z), spearman(y, z)];
  return (a - b * c) / Math.sqrt((1 - b * b) * (1 - c * c));
};

// ---------- Graph measures (research: the useful ones are in src/difficulty.ts) ----------

/** Words within 1, 2 and 3 doors of `src`. */
function ball(src: number): number[] {
  const seen = new Set([src]);
  let layer = [src];
  const sizes: number[] = [];
  for (let d = 1; d <= 3; d++) {
    const next: number[] = [];
    for (const u of layer) for (const { to } of adj[u]) if (!seen.has(to)) (seen.add(to), next.push(to));
    sizes.push(seen.size - 1);
    layer = next;
  }
  return sizes;
}

/** Brandes' betweenness centrality (weighted, undirected; unnormalised). */
function betweenness(): Float64Array {
  const n = adj.length;
  const bc = new Float64Array(n);
  const dist = new Float64Array(n);
  const sigma = new Float64Array(n);
  const delta = new Float64Array(n);
  const preds: number[][] = Array.from({ length: n }, () => []);
  for (let s = 0; s < n; s++) {
    if (!adj[s].length) continue;
    dist.fill(Infinity);
    sigma.fill(0);
    delta.fill(0);
    for (const p of preds) p.length = 0;
    dist[s] = 0;
    sigma[s] = 1;
    const order: number[] = [];
    const buckets: number[][] = [[s]];
    for (let d = 0; d < buckets.length; d++) {
      for (const u of buckets[d] ?? []) {
        if (dist[u] !== d) continue;
        order.push(u);
        for (const { to, cost } of adj[u]) {
          const nd = d + cost;
          if (nd < dist[to]) {
            dist[to] = nd;
            sigma[to] = sigma[u];
            preds[to] = [u];
            (buckets[nd] ??= []).push(to);
          } else if (nd === dist[to]) {
            sigma[to] += sigma[u];
            preds[to].push(u);
          }
        }
      }
    }
    for (let i = order.length - 1; i >= 0; i--) {
      const w = order[i];
      for (const v of preds[w]) delta[v] += (sigma[v] / sigma[w]) * (1 + delta[w]);
      if (w !== s) bc[w] += delta[w];
    }
  }
  return bc;
}

/** The most paths from s to g sharing no word (Menger: the fewest words whose loss cuts g off), up to `cap`. */
function disjointPaths(s: number, g: number, cap = 6): number {
  // Each word u splits into 2u (in) and 2u + 1 (out), joined with capacity 1 (s and g: cap).
  const capacity = new Map<number, number>();
  const next = new Map<number, Set<number>>();
  const key = (a: number, b: number) => a * 2 ** 20 + b;
  const add = (a: number, b: number, c: number) => {
    capacity.set(key(a, b), (capacity.get(key(a, b)) ?? 0) + c);
    if (!capacity.has(key(b, a))) capacity.set(key(b, a), 0);
    (next.get(a) ?? next.set(a, new Set()).get(a)!).add(b);
    (next.get(b) ?? next.set(b, new Set()).get(b)!).add(a);
  };
  for (let u = 0; u < adj.length; u++) {
    add(2 * u, 2 * u + 1, u === s || u === g ? cap : 1);
    for (const { to } of adj[u]) add(2 * u + 1, 2 * to, 1);
  }
  let flow = 0;
  while (flow < cap) {
    const prev = new Map([[2 * s + 1, 2 * s + 1]]);
    const queue = [2 * s + 1];
    for (let i = 0; i < queue.length && !prev.has(2 * g); i++)
      for (const b of next.get(queue[i]) ?? []) if (!prev.has(b) && capacity.get(key(queue[i], b))! > 0) (prev.set(b, queue[i]), queue.push(b));
    if (!prev.has(2 * g)) break;
    for (let b = 2 * g; b !== 2 * s + 1; ) {
      const a = prev.get(b)!;
      capacity.set(key(a, b), capacity.get(key(a, b))! - 1);
      capacity.set(key(b, a), capacity.get(key(b, a))! + 1);
      b = a;
    }
    flow++;
  }
  return flow;
}

/** Everything measured about one puzzle: the cheap structure, then each simulated player (`games` each). */
function study(puzzle: Puzzle, games: number, bc: Float64Array | null, players = true): Row {
  const s = index.get(puzzle.start)!;
  const g = index.get(puzzle.goal)!;
  const best = puzzle.best;
  const fromStart = distancesFrom(adj, s);
  const toGoal = distancesFrom(adj, g);
  const on = (v: number) => fromStart[v] + toGoal[v] === best;
  const step = (u: number, v: number, cost: number) => on(u) && on(v) && fromStart[u] + cost === fromStart[v];
  // The lowest routes as a DAG: routes through each word from each end, and doors from each end.
  const dag = words.map((_, i) => i).filter(on).sort((a, b) => fromStart[a] - fromStart[b]);
  const routesFrom = new Map([[s, 1]]);
  const doorsFrom = new Map([[s, 0]]);
  for (const u of dag)
    for (const { to, cost } of adj[u])
      if (step(u, to, cost)) {
        routesFrom.set(to, (routesFrom.get(to) ?? 0) + routesFrom.get(u)!);
        doorsFrom.set(to, Math.min(doorsFrom.get(to) ?? Infinity, doorsFrom.get(u)! + 1));
      }
  const routesTo = new Map([[g, 1]]);
  for (const u of [...dag].reverse()) for (const { to, cost } of adj[u]) if (step(to, u, cost)) routesTo.set(to, (routesTo.get(to) ?? 0) + routesTo.get(u)!);
  const routes = routesFrom.get(g)!;
  const inner = dag.filter((v) => v !== s && v !== g);
  // Gates: words on every lowest route (the lowest routes' dominators).
  const gates = inner.filter((v) => routesFrom.get(v)! * routesTo.get(v)! === routes);
  // Simple routes within par + 0, + 2 (counted to 20,000).
  const within = (slack: number) => {
    let count = 0;
    const seen = new Uint8Array(words.length);
    seen[s] = 1;
    const walk = (u: number, spent: number) => {
      if (count > 20_000) return;
      if (u === g) return void count++;
      for (const { to, cost } of adj[u]) {
        if (seen[to] || spent + cost + toGoal[to] > best + slack) continue;
        seen[to] = 1;
        walk(to, spent + cost);
        seen[to] = 0;
      }
    };
    walk(s, 0);
    return count;
  };
  // The fewest doors changing 2 or 3 letters on a lowest route.
  const hidden = new Map([[s, 0]]);
  for (const u of dag) for (const { to, cost } of adj[u]) if (step(u, to, cost)) hidden.set(to, Math.min(hidden.get(to) ?? Infinity, hidden.get(u)! + (lettersApart(words[u], words[to]) > 1 ? 1 : 0)));
  // Words 1–3 doors from the goal that are 1 or 2 strokes off every lowest route (near misses).
  const [g1, g2, g3] = ball(g);
  const [s1, s2, s3] = ball(s);
  let goalNear = 0;
  for (const [v] of goalSide(adj, g, 3)) {
    const off = fromStart[v] + toGoal[v] - best;
    if (v !== g && off >= 1 && off <= 2) goalNear++;
  }
  // One-letter changes of the goal that are words but not doors (they look like a step and aren't).
  const doorsOfGoal = new Set(adj[g].map((e) => e.to));
  let falseDoors = 0;
  for (let k = 0; k < puzzle.goal.length; k++)
    for (let c = 65; c <= 90; c++) {
      const v = index.get(puzzle.goal.slice(0, k) + String.fromCharCode(c) + puzzle.goal.slice(k + 1));
      if (v !== undefined && v !== g && !doorsOfGoal.has(v)) falseDoors++;
    }
  // Search effort: the words A* (from the start) and MM (from both ends: searchEffort) must look at.
  let astar = 0;
  for (let v = 0; v < words.length; v++) if (fromStart[v] < best && fromStart[v] + strokeDiff(words[v], puzzle.goal) < best) astar++;
  const mm = searchEffort(words, adj, puzzle);
  const fwd = measure(words, adj, puzzle, pockets);
  const back = measure(words, adj, reversed(puzzle), pockets);
  const path = puzzle.path.slice(1, -1).map((w) => index.get(w)!);
  const row: Row = {
    pair: `${puzzle.start} → ${puzzle.goal}`,
    start: puzzle.start,
    goal: puzzle.goal,
    best,
    need: classifyNeed(words, adj, puzzle.start, puzzle.goal, best).need,
    doors: doorsFrom.get(g)!,
    // today's measures
    depth: fwd.depth,
    traps: fwd.traps.length,
    pocketsBeside: fwd.pocketsBeside,
    pocketTrap: fwd.traps.some((t) => t.pocket) ? 1 : 0,
    tricky: isTricky(fwd) ? 1 : 0,
    // from the goal
    trickyBack: isTricky(back) ? 1 : 0,
    obviousBack: isObvious(words, adj, puzzle.goal, puzzle.start, best) ? 1 : 0,
    depthBack: back.depth,
    meetDepth: meetDepth(words, adj, puzzle, 3, toGoal),
    meetDepth4: meetDepth(words, adj, puzzle, 4, toGoal),
    // frontiers and funnels
    goal1: g1,
    goal2: g2,
    goal3: g3,
    start1: s1,
    start2: s2,
    start3: s3,
    goalShare: adj[g].filter((e) => on(e.to)).length / adj[g].length,
    startShare: adj[s].filter((e) => on(e.to)).length / adj[s].length,
    gates: gates.length,
    routes0: routes,
    routes2: within(2),
    spread: inner.length / Math.max(1, puzzle.path.length - 2),
    hidden: hidden.get(g)!,
    goalNear,
    falseDoors,
    astar,
    mm,
  };
  if (bc) {
    row.betweenness = Math.max(...path.map((v) => bc[v]));
    row.cut = disjointPaths(s, g);
  }
  if (players) {
    const walkGoal = walkChance(words, adj, puzzle, { games, slack: 2 });
    const walkMeet = walkChance(words, adj, puzzle, { games, target: 'meet', sure: true, slack: 2 });
    Object.assign(row, {
      walkGoal: walkGoal.par,
      walkGoal1: walkGoal.near1,
      walkGoal2: walkGoal.near2,
      walkBack: walkChance(words, adj, reversed(puzzle), { games }).par,
      walkMeet2: walkChance(words, adj, puzzle, { games, target: 'meet', steps: 2, sure: true }).par,
      walkMeetNoSure: walkChance(words, adj, puzzle, { games, target: 'meet' }).par,
      walkMeet4: walkChance(words, adj, puzzle, { games, target: 'meet', steps: 4, sure: true }).par,
      walkMeet: walkMeet.par,
      walkMeet1: walkMeet.near1,
      walkMeet2near: walkMeet.near2,
      walkMeetT05: walkChance(words, adj, puzzle, { games, target: 'meet', sure: true, temperature: 0.5 }).par,
      walkMeetT2: walkChance(words, adj, puzzle, { games, target: 'meet', sure: true, temperature: 2 }).par,
    });
    for (const budget of [10, 20, 40])
      for (const plan of ['forward', 'meet'] as const) {
        const odds = planChance(words, adj, puzzle, plan, { games, budget });
        row[`${plan}${budget}`] = odds.par;
        row[`${plan}${budget}near1`] = odds.near1;
        row[`${plan}${budget}near2`] = odds.near2;
      }
    row.backward20 = planChance(words, adj, puzzle, 'backward', { games, budget: 20 }).par;
    row.forward20h = planChance(words, adj, puzzle, 'forward', { games, budget: 20, hidden: 0.5 }).par;
    row.meet20h = planChance(words, adj, puzzle, 'meet', { games, budget: 20, hidden: 0.5 }).par;
    row.meet20T05 = planChance(words, adj, puzzle, 'meet', { games, budget: 20, temperature: 0.5 }).par;
    row.meet20T2 = planChance(words, adj, puzzle, 'meet', { games, budget: 20, temperature: 2 }).par;
  }
  return row;
}

const n = (r: Row, k: string) => Number(r[k]);
const col = (rows: Row[], k: string) => rows.map((r) => n(r, k));

/** The players, in the tables' order. */
const PLAYERS: [string, string, string?, string?][] = [
  ['Forward walker (today’s par chance)', 'walkGoal', 'walkGoal1', 'walkGoal2'],
  ['Forward walker, goal → start', 'walkBack'],
  ['Meet walker, goal’s side mapped 2 doors back', 'walkMeet2'],
  ['Meet walker, goal’s side mapped 3 doors back, not taking doors sure to make par', 'walkMeetNoSure'],
  ['Meet walker, goal’s side mapped 3 doors back', 'walkMeet', 'walkMeet1', 'walkMeet2near'],
  ['Meet walker, goal’s side mapped 4 doors back', 'walkMeet4'],
  ['Forward planner, 10 looks', 'forward10', 'forward10near1', 'forward10near2'],
  ['Meet planner, 10 looks', 'meet10', 'meet10near1', 'meet10near2'],
  ['Forward planner, 20 looks', 'forward20', 'forward20near1', 'forward20near2'],
  ['Backward planner, 20 looks', 'backward20'],
  ['Meet planner, 20 looks', 'meet20', 'meet20near1', 'meet20near2'],
  ['Forward planner, 40 looks', 'forward40', 'forward40near1', 'forward40near2'],
  ['Meet planner, 40 looks', 'meet40', 'meet40near1', 'meet40near2'],
  ['Forward planner, 20 looks, sees half the 2–3 letter doors', 'forward20h'],
  ['Meet planner, 20 looks, sees half the 2–3 letter doors', 'meet20h'],
];
const SHORT = ['walkGoal', 'forward20', 'walkMeet', 'meet10', 'meet20', 'meet20h'];
const HEAD = 'fwd walker | fwd planner 20 | meet walker | meet planner 10 | meet planner 20 | meet planner 20, half the 2–3 letter doors';

function poolTables(rows: Row[], dailies: Row[]) {
  console.log(`\n### Players: share of games at par (mean over ${rows.length} puzzles)\n`);
  console.log('| Player | par | ≤ 1 over | ≤ 2 over | median puzzle | puzzles at par in half the games or more |\n|---|---|---|---|---|---|');
  for (const [name, k, k1, k2] of PLAYERS)
    console.log(`| ${name} | ${pct(mean(col(rows, k)))} | ${k1 ? pct(mean(col(rows, k1))) : '–'} | ${k2 ? pct(mean(col(rows, k2))) : '–'} | ${pct(median(col(rows, k)))} | ${col(rows, k).filter((x) => x >= 0.5).length} |`);

  // The daily thirds as scripts/daily.ts ranks them: hardest first by par chance, then deeper, then more (kept) traps.
  const thirds = (key: (r: Row) => number) => {
    const ranked = [...rows].sort((a, b) => key(a) - key(b) || n(b, 'depth') - n(a, 'depth') || Math.min(3, n(b, 'traps')) - Math.min(3, n(a, 'traps')) || String(a.pair).localeCompare(String(b.pair)));
    const t = Math.round(rows.length / 3);
    return { hard: ranked.slice(0, t), middle: ranked.slice(t, 2 * t), easy: ranked.slice(2 * t) };
  };
  const today = thirds((r) => n(r, 'walkGoal'));
  const groups: [string, Row[]][] = [
    ['all', rows],
    ['4 doors', rows.filter((r) => n(r, 'doors') === 4)],
    ['5 doors', rows.filter((r) => n(r, 'doors') === 5)],
    ['6 doors', rows.filter((r) => n(r, 'doors') === 6)],
    ['7+ doors', rows.filter((r) => n(r, 'doors') >= 7)],
    ['goal with 2 doors', rows.filter((r) => adj[index.get(String(r.goal))!].length === 2)],
    ['goal in a pocket', rows.filter((r) => pockets.pocketOf[index.get(String(r.goal))!] >= 0)],
    ['tricky goal → start too', rows.filter((r) => n(r, 'trickyBack') === 1)],
    ['not tricky goal → start', rows.filter((r) => n(r, 'trickyBack') === 0)],
    ['meet depth 1', rows.filter((r) => n(r, 'meetDepth') === 1)],
    ['meet depth 2+', rows.filter((r) => n(r, 'meetDepth') > 1)],
    ['daily third: easy', today.easy],
    ['daily third: middle', today.middle],
    ['daily third: hard', today.hard],
  ];
  console.log(`\n### By kind of puzzle: share of games at par\n\n| Puzzles | n | ${HEAD} |\n|---|---|---|---|---|---|---|---|`);
  for (const [name, rs] of groups) if (rs.length) console.log(`| ${name} | ${rs.length} | ${SHORT.map((k) => pct(mean(col(rs, k)))).join(' | ')} |`);
  for (const r of dailies) console.log(`| daily ${r.date}: ${r.pair} (lowest ${r.best}, ${r.doors} doors) | 1 | ${SHORT.map((k) => pct(n(r, k))).join(' | ')} |`);

  console.log('\n### Solved from the goal (the reversed puzzle)\n');
  const count = (f: (r: Row) => boolean) => rows.filter(f).length;
  console.log(`- fewest wrong letters makes par goal → start: ${count((r) => n(r, 'obviousBack') === 1)} of ${rows.length}; fewest strokes left (depth 1): ${count((r) => n(r, 'depthBack') === 1)}; tricky both ways: ${count((r) => n(r, 'trickyBack') === 1)}`);
  console.log(`- planning depth from the start 1/2/3/4+: ${[1, 2, 3, 4].map((d) => count((r) => n(r, 'depth') === d)).join('/')}; from the goal: ${[1, 2, 3, 4].map((d) => count((r) => n(r, 'depthBack') === d)).join('/')}`);
  console.log(`- meet depth (goal's side mapped 3 doors back) 1/2/3/4+: ${[1, 2, 3, 4].map((d) => count((r) => n(r, 'meetDepth') === d)).join('/')}; mapped 4 doors back: ${[1, 2, 3, 4].map((d) => count((r) => n(r, 'meetDepth4') === d)).join('/')}`);

  console.log('\n### Both ends of the maze\n');
  console.log('| | start | goal |\n|---|---|---|');
  for (const [name, a, b] of [
    ['words within 1 door (median)', 'start1', 'goal1'],
    ['words within 2 doors', 'start2', 'goal2'],
    ['words within 3 doors', 'start3', 'goal3'],
    ['share of its doors on a lowest route (mean)', 'startShare', 'goalShare'],
  ] as const)
    console.log(`| ${name} | ${a.endsWith('Share') ? pct(mean(col(rows, a))) : median(col(rows, a))} | ${b.endsWith('Share') ? pct(mean(col(rows, b))) : median(col(rows, b))} |`);
  console.log(`\n- every door on a lowest route: start ${count((r) => n(r, 'startShare') === 1)}, goal ${count((r) => n(r, 'goalShare') === 1)}; at least half: start ${count((r) => n(r, 'startShare') >= 0.5)}, goal ${count((r) => n(r, 'goalShare') >= 0.5)}`);
  console.log(`- one lowest route only: ${count((r) => n(r, 'routes0') === 1)}; words on every lowest route (median): ${median(col(rows, 'gates'))} of ${median(rows.map((r) => n(r, 'doors') - 1))} between the ends`);
  console.log(`- every lowest route needs a door changing 2–3 letters: ${count((r) => n(r, 'hidden') > 0)}; fewest such doors 0/1/2/3+: ${[0, 1, 2].map((k) => count((r) => n(r, 'hidden') === k)).join('/')}/${count((r) => n(r, 'hidden') >= 3)}`);
  const byHidden = [0, 1, 2, 3].map((k) => rows.filter((r) => (k < 3 ? n(r, 'hidden') === k : n(r, 'hidden') >= 3)));
  console.log(`- with half the 2–3 letter doors seen, meet planner (20 looks) at par by fewest such doors 0/1/2/3+: ${byHidden.map((rs) => (rs.length ? pct(mean(col(rs, 'meet20h'))) : '–')).join('/')}`);

  // How far off judging by eye is, by doors still to go (along each stored route, both ways).
  const off = new Map<number, { gap: number[]; share: number[] }>();
  for (const r of rows) {
    const p = maze.puzzles.find((x: { puzzle: Puzzle }) => `${x.puzzle.start} → ${x.puzzle.goal}` === r.pair)?.puzzle as Puzzle | undefined;
    if (!p) continue;
    for (const route of [p.path, [...p.path].reverse()]) {
      const to = route[route.length - 1];
      const d = distancesFrom(adj, index.get(to)!);
      route.slice(0, -1).forEach((w, i) => {
        const left = route.length - 1 - i;
        const e = off.get(left) ?? off.set(left, { gap: [], share: [] }).get(left)!;
        e.gap.push(d[index.get(w)!] - strokeDiff(w, to));
        e.share.push(strokeDiff(w, to) / d[index.get(w)!]);
      });
    }
  }
  console.log('\n### Judging by eye, by doors still to go\n\n| Doors to go | route words | strokes the eye misses (mean) | the eye’s estimate, as a share of the truth |\n|---|---|---|---|');
  for (const k of [...off.keys()].sort((a, b) => a - b)) console.log(`| ${k} | ${off.get(k)!.gap.length} | ${mean(off.get(k)!.gap).toFixed(1)} | ${pct(mean(off.get(k)!.share))} |`);

  console.log(`\n### Measures against each player: rank correlation with the share of games at par\n\n(0 is no relation; −1, the bigger the measure, the harder. Last column: with the meet planner at 10 looks, once today’s par chance is held fixed.)\n`);
  const MEASURES: [string, string][] = [
    ['parChance', 'walkGoal'],
    ['planning depth', 'depth'],
    ['traps', 'traps'],
    ['pockets beside the route', 'pocketsBeside'],
    ['a trap into a pocket', 'pocketTrap'],
    ['tricky goal → start', 'trickyBack'],
    ['meet depth', 'meetDepth'],
    ['doors on the route', 'doors'],
    ['words within 2 doors of the goal', 'goal2'],
    ['share of the goal’s doors on a lowest route', 'goalShare'],
    ['words on every lowest route (gates)', 'gates'],
    ['words to remove to cut start from goal', 'cut'],
    ['highest betweenness on the route', 'betweenness'],
    ['lowest routes', 'routes0'],
    ['words on any lowest route, per word on one', 'spread'],
    ['routes within 2 strokes of par', 'routes2'],
    ['near misses within 3 doors of the goal', 'goalNear'],
    ['one-letter decoys of the goal', 'falseDoors'],
    ['words MM must expand (bidirectional search)', 'mm'],
    ['words A* must expand', 'astar'],
    ['fewest 2–3 letter doors on a lowest route', 'hidden'],
  ];
  console.log(`| Measure | median | ${HEAD} | meet planner 10, given par chance |\n|---|---|---|---|---|---|---|---|---|`);
  for (const [name, k] of MEASURES) {
    if (rows[0][k] === undefined) continue;
    const x = col(rows, k);
    console.log(`| ${name} | ${f2(median(x))} | ${SHORT.map((o) => f2(spearman(x, col(rows, o)))).join(' | ')} | ${k === 'walkGoal' ? '–' : f2(partial(x, col(rows, 'meet10'), col(rows, 'walkGoal')))} |`);
  }
  console.log(`\nPockets beside the route against near misses (within 2 strokes of par): forward walker ${f2(spearman(col(rows, 'pocketsBeside'), col(rows, 'walkGoal2')))}, meet walker ${f2(spearman(col(rows, 'pocketsBeside'), col(rows, 'walkMeet2near')))}`);
  console.log(`\nPlayers against each other:\n\n| | ${SHORT.join(' | ')} |\n|---|${SHORT.map(() => '---').join('|')}|`);
  for (const a of SHORT) console.log(`| ${a} | ${SHORT.map((b) => f2(spearman(col(rows, a), col(rows, b)))).join(' | ')} |`);

  // Each puzzle's place, easiest last: by par chance, and by search effort (the most first).
  const rankOf = (key: (r: Row) => number) => new Map([...rows].sort((a, b) => key(a) - key(b)).map((r, i) => [r, i]));
  const [byChance, byEffort] = [rankOf((r) => n(r, 'walkGoal')), rankOf((r) => -n(r, 'mm'))];
  console.log(`\n### The daily thirds, ranked other ways: share of games at par\n\n| Ranked by | third | ${HEAD} |\n|---|---|---|---|---|---|---|---|`);
  for (const [name, key] of [
    ['forward walker (today)', (r: Row) => n(r, 'walkGoal')],
    ['meet walker', (r: Row) => n(r, 'walkMeet')],
    ['the two walkers’ mean', (r: Row) => (n(r, 'walkGoal') + n(r, 'walkMeet')) / 2],
    ['meet planner, 10 looks', (r: Row) => n(r, 'meet10')],
    ['par chance and search effort (their places added)', (r: Row) => byChance.get(r)! + byEffort.get(r)!],
  ] as const) {
    const t = thirds(key);
    for (const band of ['hard', 'middle', 'easy'] as const) console.log(`| ${name} | ${band} | ${SHORT.map((k) => pct(mean(col(t[band], k)))).join(' | ')} |`);
  }
  console.log(`\nOther player settings (temperature 0.5 is steadier, 2 looser): meet walker ${pct(mean(col(rows, 'walkMeetT05')))} / ${pct(mean(col(rows, 'walkMeetT2')))}, meet planner 20 ${pct(mean(col(rows, 'meet20T05')))} / ${pct(mean(col(rows, 'meet20T2')))}`);
  const ends = new Set(rows.flatMap((r) => [String(r.start), String(r.goal)]));
  console.log(`${ends.size} different start and goal words; lowest strokes ${[...new Set(col(rows, 'best'))].sort((a, b) => a - b).map((b) => `${b}: ${rows.filter((r) => n(r, 'best') === b).length}`).join(', ')}; doors ${[4, 5, 6, 7, 8].map((d) => `${d}: ${rows.filter((r) => n(r, 'doors') === d).length}`).join(', ')}`);
}

if (mode === 'pool') {
  const games = Number(option('--games') ?? 400);
  const bc = betweenness();
  const rows: Row[] = maze.puzzles.map(({ puzzle }: { puzzle: Puzzle }) => study(puzzle, games, bc));
  const dir = new URL(`src/daily/days${suffix}/`, root);
  const dailies = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(new URL(f, dir), 'utf8')) as { date: string; puzzle: Puzzle })
    .map((d) => ({ ...study(d.puzzle, games, bc), date: d.date }));
  poolTables(rows, dailies);
} else if (mode === 'stream') {
  // Candidates as scripts/mazes.ts draws them (everyday start and goal words, any lowest strokes in range).
  const [lo, hi] = (option('--best') ?? '12-15').split('-').map(Number);
  const N = Number(option('--candidates') ?? 3000);
  const games = Number(option('--games') ?? 200);
  const everyday = new Set(parseWordList(readFileSync(new URL(`data/everyday-${LETTERS}.txt`, root), 'utf8')));
  const definitions = JSON.parse(readFileSync(new URL(`public/definitions${suffix}.json`, root), 'utf8'));
  const endpoint = (w: string) => {
    const d = definitions[w];
    return everyday.has(w) && Array.isArray(d) && d.length === 2 && ['n.', 'v.', 'adj.'].includes(d[0]) && !/old-fashioned|\(past of/.test(d[1]) && !/[^s]s$/i.test(w);
  };
  const random = seededRandom(11);
  const seen = new Set<string>();
  const rows: Row[] = [];
  while (rows.length < N) {
    const p = randomPuzzle(words, adj, random, endpoint, { best: [lo, hi], steps: [4, 8] });
    if (seen.has(p.start + p.goal) || seen.has(p.goal + p.start)) continue;
    seen.add(p.start + p.goal);
    const r = study(p, games, null, false);
    Object.assign(r, {
      walkGoal: walkChance(words, adj, p, { games }).par,
      walkMeet: walkChance(words, adj, p, { games, target: 'meet', sure: true }).par,
      forward20: planChance(words, adj, p, 'forward', { games, budget: 20 }).par,
      meet10: planChance(words, adj, p, 'meet', { games, budget: 10 }).par,
      meet20: planChance(words, adj, p, 'meet', { games, budget: 20 }).par,
      meet20h: planChance(words, adj, p, 'meet', { games, budget: 20, hidden: 0.5 }).par,
      walkMeetT05: walkChance(words, adj, p, { games, target: 'meet', sure: true, temperature: 0.5 }).par,
      walkMeetT2: walkChance(words, adj, p, { games, target: 'meet', sure: true, temperature: 2 }).par,
      meet20T05: planChance(words, adj, p, 'meet', { games, budget: 20, temperature: 0.5 }).par,
      meet20T2: planChance(words, adj, p, 'meet', { games, budget: 20, temperature: 2 }).par,
    });
    rows.push(r);
  }
  const today = (r: Row) => n(r, 'tricky') === 1 && n(r, 'pocketsBeside') > 0;
  const RULES: [string, (r: Row) => boolean][] = [
    ['every candidate', () => true],
    ['today: tricky, a pocket beside the route', today],
    ['tricky, no pocket needed', (r) => n(r, 'tricky') === 1],
    ['today, and tricky goal → start', (r) => today(r) && n(r, 'trickyBack') === 1],
    ['today, and 5+ doors', (r) => today(r) && n(r, 'doors') >= 5],
    ['today, and meet depth 2+', (r) => today(r) && n(r, 'meetDepth') > 1],
    ['tricky, meet depth 2+ (no pocket needed)', (r) => n(r, 'tricky') === 1 && n(r, 'meetDepth') > 1],
    ['tricky both ways, meet depth 2+ (no pocket needed)', (r) => n(r, 'tricky') === 1 && n(r, 'trickyBack') === 1 && n(r, 'meetDepth') > 1],
  ];
  const bests = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
  console.log(`\n### Selection rules on ${N} candidates, lowest strokes ${lo}–${hi}: share kept, and share of games at par among those kept\n`);
  console.log(`| Rule | kept | ${bests.map((b) => `kept at ${b}`).join(' | ')} | ${HEAD} |\n|---|---|${bests.map(() => '---').join('|')}|---|---|---|---|---|---|`);
  for (const [name, f] of RULES) {
    const kept = rows.filter(f);
    console.log(`| ${name} | ${pct(kept.length / rows.length)} | ${bests.map((b) => pct(rows.filter((r) => n(r, 'best') === b && f(r)).length / rows.filter((r) => n(r, 'best') === b).length)).join(' | ')} | ${SHORT.map((k) => pct(mean(col(kept, k)))).join(' | ')} |`);
  }
  console.log(`\n| Rule | meet walker, steadier / looser | meet planner 20, steadier / looser | different start and goal words in the first 140 kept |\n|---|---|---|---|`);
  for (const [name, f] of RULES) {
    const kept = rows.filter(f);
    console.log(`| ${name} | ${pct(mean(col(kept, 'walkMeetT05')))} / ${pct(mean(col(kept, 'walkMeetT2')))} | ${pct(mean(col(kept, 'meet20T05')))} / ${pct(mean(col(kept, 'meet20T2')))} | ${new Set(kept.slice(0, 140).flatMap((r) => [String(r.start), String(r.goal)])).size} |`);
  }
  console.log(`\n### By lowest strokes: share kept, and share of games at par among those kept (today's rule / the meet rule)\n`);
  const meetRule = (r: Row) => n(r, 'tricky') === 1 && n(r, 'meetDepth') > 1;
  console.log(`| Lowest strokes | candidates | kept | doors (mean) | ${HEAD} |\n|---|---|---|---|---|---|---|---|---|---|`);
  for (const b of bests) {
    const at = rows.filter((r) => n(r, 'best') === b);
    const [x, y] = [at.filter(today), at.filter(meetRule)];
    const both = (k: string) => `${pct(mean(col(x, k)))} / ${pct(mean(col(y, k)))}`;
    console.log(`| ${b} | ${at.length} | ${pct(x.length / at.length)} / ${pct(y.length / at.length)} | ${mean(col(x, 'doors')).toFixed(1)} / ${mean(col(y, 'doors')).toFixed(1)} | ${SHORT.map(both).join(' | ')} |`);
  }
  const pocketless = rows.filter((r) => n(r, 'tricky') === 1 && n(r, 'pocketsBeside') === 0);
  const pocketed = rows.filter(today);
  console.log(`\nTricky candidates with no pocket beside (${pocketless.length}) against those with one (${pocketed.length}): ${SHORT.map((k) => `${k} ${pct(mean(col(pocketless, k)))} / ${pct(mean(col(pocketed, k)))}`).join(', ')}`);
} else throw new Error('usage: vite-node scripts/difficulty-study.ts pool|stream [options]');


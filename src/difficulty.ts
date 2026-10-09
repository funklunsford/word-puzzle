// How tricky a puzzle is, measured on the maze graph: scripts/mazes.ts picks the pool with it, and
// scripts/daily.ts sets the week's rhythm by it.
//
// A player judges how far a word is from the goal by eye, roughly its stroke difference (strokeDiff),
// so a door "looks" like its cost plus that. What it really costs comes from the true distances to
// the goal. A puzzle is tricky where the two disagree:
// - traps: doors that look at least as good as the right step but lead off every lowest-stroke route;
// - pockets: parts of the maze that hang off the rest by a single word, so every stroke spent in one is
//   lost (a trap into a pocket is the strongest kind);
// - depth: how many steps ahead a player must look to make par;
// - strategies: no simple rule of thumb makes par;
// - par chance: how often a simulated player, who leans towards doors that look closer, makes par.
//
// Those all look forward from the start. A player can also work back from the goal first, then join
// up from the start (docs/difficulty-5-letters.md), so there are measures for that too:
// - meet depth: how far ahead a player must look after mapping the goal's side (goalSide);
// - walkChance and planChance: simulated players who walk or plan, heading for the goal or working
//   back from it first;
// - search effort: how much a search from both ends must look at before it can be sure of par.

import { isObvious, seededRandom, type Graph, type Puzzle } from './maze';
import { strokeDiff } from './strokes';

/** Cheapest strokes from `src` to every word (door costs are small whole numbers, so a bucket queue). */
export function distancesFrom(adj: Graph, src: number): Float64Array {
  const dist = new Float64Array(adj.length).fill(Infinity);
  dist[src] = 0;
  const buckets: number[][] = [[src]];
  for (let d = 0; d < buckets.length; d++) {
    for (const u of buckets[d] ?? []) {
      if (dist[u] !== d) continue;
      for (const { to, cost } of adj[u]) {
        const nd = d + cost;
        if (nd < dist[to]) {
          dist[to] = nd;
          (buckets[nd] ??= []).push(to);
        }
      }
    }
  }
  return dist;
}

// ---------- Pockets ----------

export interface Pockets {
  /** Each word's pocket (an index into `sizes`), or -1: in the maze's core, or cut off from the maze. */
  pocketOf: Int32Array;
  /** Words in each pocket. */
  sizes: number[];
}

/**
 * The maze's pockets: its core is the largest part with no single word whose loss would cut it in two
 * (its largest biconnected block); every other word of the main maze sits in a pocket, which can only
 * be left through the word it was entered by. Words joined to each other outside the core make one pocket.
 */
export function findPockets(adj: Graph): Pockets {
  const n = adj.length;
  // The main maze: the largest connected part.
  const comp = new Int32Array(n).fill(-1);
  let main = -1;
  let mainSize = 0;
  for (let i = 0; i < n; i++) {
    if (comp[i] >= 0) continue;
    const stack = [i];
    comp[i] = i;
    let size = 0;
    while (stack.length) {
      const u = stack.pop()!;
      size++;
      for (const { to } of adj[u]) if (comp[to] < 0) (comp[to] = i), stack.push(to);
    }
    if (size > mainSize) [main, mainSize] = [i, size];
  }
  // Its biconnected blocks (Tarjan's, without recursion: a hub has 30 doors and chains run long).
  const disc = new Int32Array(n).fill(-1);
  const low = new Int32Array(n);
  const parent = new Int32Array(n).fill(-1);
  const next = new Int32Array(n);
  const edges: [number, number][] = [];
  let core: number[] = [];
  let time = 0;
  const stack = [main];
  disc[main] = low[main] = time++;
  while (stack.length) {
    const u = stack[stack.length - 1];
    if (next[u] < adj[u].length) {
      const v = adj[u][next[u]++].to;
      if (disc[v] < 0) {
        parent[v] = u;
        disc[v] = low[v] = time++;
        edges.push([u, v]);
        stack.push(v);
      } else if (v !== parent[u] && disc[v] < disc[u]) {
        low[u] = Math.min(low[u], disc[v]);
        edges.push([u, v]);
      }
      continue;
    }
    stack.pop();
    const p = parent[u];
    if (p < 0) continue;
    low[p] = Math.min(low[p], low[u]);
    if (low[u] >= disc[p]) {
      // p closes a block: the edges pushed since p → u.
      const block = new Set<number>();
      for (;;) {
        const [a, b] = edges.pop()!;
        block.add(a).add(b);
        if (a === p && b === u) break;
      }
      if (block.size > core.length) core = [...block];
    }
  }
  const inCore = new Uint8Array(n);
  for (const v of core) inCore[v] = 1;
  const pocketOf = new Int32Array(n).fill(-1);
  const sizes: number[] = [];
  for (let i = 0; i < n; i++) {
    if (comp[i] !== main || inCore[i] || pocketOf[i] >= 0) continue;
    const id = sizes.length;
    const group = [i];
    pocketOf[i] = id;
    for (let k = 0; k < group.length; k++) for (const { to } of adj[group[k]]) if (!inCore[to] && pocketOf[to] < 0) (pocketOf[to] = id), group.push(to);
    sizes.push(group.length);
  }
  return { pocketOf, sizes };
}

// ---------- One puzzle ----------

export interface Trap {
  /** A word on a lowest-stroke route... */
  at: string;
  /** ...and the door from it that looks at least as good as the right step, but isn't on any. */
  door: string;
  /** Strokes lost by taking it, at best. */
  loses: number;
  /** It leads into a pocket the route doesn't use. */
  pocket: boolean;
}

export interface Difficulty {
  /** Steps a player must look ahead to make par (judging the rest by eye): 1, 2, 3, or 4 for more than 3. */
  depth: number;
  /** The rules of thumb that make par (see STRATEGIES); none, for a tricky puzzle. */
  obvious: string[];
  traps: Trap[];
  /** Pockets the route doesn't use that a word on it opens onto. */
  pocketsBeside: number;
  /** How often the simulated player makes par (see parChance), to two places; -1 when not measured. */
  parChance: number;
}

/** The rules of thumb a puzzle is checked against: a tricky one defeats them all. */
export const STRATEGIES = {
  /** Take the door leaving the fewest letters wrong (then the fewest strokes left, then the cheapest): see isObvious. */
  letters: 'fewest wrong letters',
  /** Take the door that looks cheapest to the goal: its cost plus the strokes difference left (depth 1). */
  strokes: 'fewest strokes left',
};

/** Everything about a puzzle bar its par chance, which takes longer: the cheap measures, for filtering. */
export function measure(words: string[], adj: Graph, puzzle: Puzzle, pockets: Pockets): Difficulty {
  const s = words.indexOf(puzzle.start);
  const g = words.indexOf(puzzle.goal);
  const fromStart = distancesFrom(adj, s);
  const toGoal = distancesFrom(adj, g);
  const best = puzzle.best;
  const looks = (v: number) => strokeDiff(words[v], puzzle.goal);
  const onRoute = (v: number) => fromStart[v] + toGoal[v] === best;
  const routePockets = new Set<number>();
  for (let v = 0; v < words.length; v++) if (onRoute(v) && pockets.pocketOf[v] >= 0) routePockets.add(pockets.pocketOf[v]);

  const traps: Trap[] = [];
  const beside = new Set<number>();
  for (let u = 0; u < words.length; u++) {
    if (!onRoute(u) || u === g) continue;
    // The right steps from here, and the best any of them looks.
    let right = Infinity;
    for (const { to, cost } of adj[u]) if (onRoute(to) && fromStart[to] === fromStart[u] + cost) right = Math.min(right, cost + looks(to));
    for (const { to, cost } of adj[u]) {
      if (onRoute(to)) continue;
      const pocket = pockets.pocketOf[to] >= 0 && !routePockets.has(pockets.pocketOf[to]);
      if (pocket) beside.add(pockets.pocketOf[to]);
      if (cost + looks(to) <= right) traps.push({ at: words[u], door: words[to], loses: cost + toGoal[to] - toGoal[u], pocket });
    }
  }
  traps.sort((a, b) => b.loses - a.loses || a.at.localeCompare(b.at) || a.door.localeCompare(b.door));

  const depth = planningDepth(words, adj, puzzle, toGoal);
  const obvious = [...(isObvious(words, adj, puzzle.start, puzzle.goal, best) ? [STRATEGIES.letters] : []), ...(depth === 1 ? [STRATEGIES.strokes] : [])];
  return { depth, obvious, traps, pocketsBeside: beside.size, parChance: -1 };
}

/**
 * How many steps ahead a player must look to make par: at each word they weigh every run of `k`
 * doors (no word twice), judge where it ends by eye (its strokes difference to the goal), and take
 * the first door of the best run; runs that look equally good are all tried. The smallest `k` from
 * 1 to 3 that makes par, or 4 when even 3 doesn't.
 */
export function planningDepth(words: string[], adj: Graph, puzzle: Puzzle, toGoal = distancesFrom(adj, words.indexOf(puzzle.goal))): number {
  return depthTowards(words, adj, puzzle, toGoal, null);
}

/**
 * planningDepth for a player who first works back from the goal, mapping its side `steps` doors deep
 * (see goalSide), then plays forward towards it: a run ends at a word on that side, judged by its known
 * strokes to the goal; a word off it looks as close as the cheapest-looking way to finish through a
 * word there; and a door onto it that makes par is always taken. 1 means working back and then taking
 * the door that looks best makes par: the strategy is a rule of thumb for that puzzle.
 */
export function meetDepth(words: string[], adj: Graph, puzzle: Puzzle, steps = 3, toGoal = distancesFrom(adj, words.indexOf(puzzle.goal))): number {
  return depthTowards(words, adj, puzzle, toGoal, goalSide(adj, words.indexOf(puzzle.goal), steps));
}

/** planningDepth towards the goal (`side` null) or towards a mapped goal's side (meetDepth). */
function depthTowards(words: string[], adj: Graph, puzzle: Puzzle, toGoal: Float64Array, side: Map<number, number> | null): number {
  const s = words.indexOf(puzzle.start);
  const g = words.indexOf(puzzle.goal);
  const ends = side ?? new Map([[g, 0]]);
  const end = (u: number) => (u === s ? undefined : ends.get(u));
  const cache = new Float64Array(words.length).fill(-1);
  const looks = (v: number) => {
    if (cache[v] < 0) {
      let m = Infinity;
      for (const [b, c] of ends) m = Math.min(m, (b === v ? 0 : strokeDiff(words[v], words[b])) + c);
      cache[v] = m;
    }
    return cache[v];
  };
  const seen = new Uint8Array(words.length);
  // The best a run of up to `k` more doors from u looks (stopping early at the goal, or the goal's side).
  const ahead = (u: number, k: number): number => {
    const known = end(u);
    if (known !== undefined) return known;
    if (k === 0) return looks(u);
    let m = Infinity;
    for (const { to, cost } of adj[u]) {
      if (seen[to]) continue;
      seen[to] = 1;
      m = Math.min(m, cost + ahead(to, k - 1));
      seen[to] = 0;
    }
    return Number.isFinite(m) ? m : looks(u) + 99; // a dead end looks worst
  };
  for (let k = 1; k <= 3; k++) {
    const walk = (u: number, spent: number): boolean => {
      const known = end(u);
      if (known !== undefined) return spent + known === puzzle.best;
      // (The cheapest a goal can still be reached from here, so hopeless walks stop early.)
      if (spent + toGoal[u] > puzzle.best) return false;
      // Working back from the goal, a door onto its side that makes par is a sure thing.
      if (side) for (const { to, cost } of adj[u]) if (!seen[to] && end(to) !== undefined && spent + cost + end(to)! === puzzle.best) return true;
      const moves: { to: number; cost: number; v: number }[] = [];
      for (const { to, cost } of adj[u]) {
        if (seen[to]) continue;
        seen[to] = 1;
        moves.push({ to, cost, v: cost + ahead(to, k - 1) });
        seen[to] = 0;
      }
      const top = Math.min(...moves.map((m) => m.v));
      for (const m of moves) {
        if (m.v !== top) continue;
        seen[m.to] = 1;
        const ok = walk(m.to, spent + m.cost);
        seen[m.to] = 0;
        if (ok) return true;
      }
      return false;
    };
    seen.fill(0);
    seen[s] = 1;
    if (walk(s, 0)) return k;
  }
  return 4;
}

/**
 * How often a simulated player makes par, out of `games`. At each word they pick a door they haven't
 * used, at random but leaning towards those that look closer to the goal (cost plus strokes
 * difference): each point worse is `e^(1/temperature)` times less likely. Going back is free, as in
 * the game, so a dead end sends them back the way they came. Seeded by the puzzle itself, so the same
 * puzzle always scores the same, whatever else is measured.
 */
export function parChance(words: string[], adj: Graph, puzzle: Puzzle, { games = 400, temperature = 1 } = {}): number {
  return walkChance(words, adj, puzzle, { games, temperature }).par;
}

/** A puzzle no rule of thumb solves at par. */
export const isTricky = (d: Difficulty) => d.obvious.length === 0;

// ---------- Working back from the goal ----------

/**
 * The goal's side, as a player working back from the goal maps it: every word at most `steps` doors
 * from the goal, with the fewest strokes from it to the goal in at most that many doors (so a word's
 * strokes are what that player knows, never less than its true distance).
 */
export function goalSide(adj: Graph, g: number, steps = 3): Map<number, number> {
  let known = new Map([[g, 0]]);
  for (let k = 0; k < steps; k++) {
    const next = new Map(known);
    for (const [u, c] of known) for (const { to, cost } of adj[u]) if (c + cost < (next.get(to) ?? Infinity)) next.set(to, c + cost);
    known = next;
  }
  return known;
}

/**
 * How much searching from both ends a puzzle takes: the words a search that works from both ends and
 * meets in the middle (MM: Holte, Felner, Sharon and Sturtevant, 2016) must look at before it can be
 * sure of par, judging by eye how far each word is from the other end (its strokes difference). A word
 * reached from the start is one when twice its strokes from the start, and those strokes plus how far
 * the goal looks, are both under par; the same from the goal. The same either way round. More means a
 * puzzle that's harder to join up from both ends (and from one).
 */
export function searchEffort(words: string[], adj: Graph, puzzle: Puzzle): number {
  const fromStart = distancesFrom(adj, words.indexOf(puzzle.start));
  const toGoal = distancesFrom(adj, words.indexOf(puzzle.goal));
  let count = 0;
  for (let v = 0; v < words.length; v++) {
    if (2 * fromStart[v] < puzzle.best && fromStart[v] + strokeDiff(words[v], puzzle.goal) < puzzle.best) count++;
    if (2 * toGoal[v] < puzzle.best && toGoal[v] + strokeDiff(words[v], puzzle.start) < puzzle.best) count++;
  }
  return count;
}

export interface WalkOptions {
  games?: number;
  /** As in parChance: each point a door looks worse makes it `e^(1/temperature)` times less likely. */
  temperature?: number;
  /**
   * What the walker heads for:
   * - 'goal': the goal, judged by eye (parChance's walker);
   * - 'meet': the goal's side, mapped before the first move (see goalSide): a door looks like its cost
   *   plus the cheapest-looking way to finish through a word there (its strokes difference to that
   *   word plus that word's strokes to the goal). Once on that side, the walker finishes along it.
   */
  target?: 'goal' | 'meet';
  /** For 'meet': how many doors back from the goal the map goes. */
  steps?: number;
  /** Keep walking until this many strokes over par, to count near misses (0: stop once par is lost, as parChance does). */
  slack?: number;
  /** Take a door that is sure to make par (onto the mapped side, or the goal, within par) whenever there is one. */
  sure?: boolean;
}

export interface WalkOdds {
  /** The share of games that made par, to two places. */
  par: number;
  /** ...that finished at most 1 stroke over par (counted up to `slack`). */
  near1: number;
  /** ...at most 2 strokes over. */
  near2: number;
}

/**
 * How often a simulated walker makes par (and comes close), out of `games`: parChance's walker, heading
 * for the goal or for the goal's side (see WalkOptions). Moves after par is lost draw from a second
 * random stream, so a game's par result never depends on `slack`: with the defaults, `par` is parChance.
 */
export function walkChance(words: string[], adj: Graph, puzzle: Puzzle, { games = 400, temperature = 1, target = 'goal', steps = 3, slack = 0, sure = false }: WalkOptions = {}): WalkOdds {
  const s = words.indexOf(puzzle.start);
  const g = words.indexOf(puzzle.goal);
  const best = puzzle.best;
  const known = target === 'meet' ? goalSide(adj, g, steps) : new Map([[g, 0]]);
  const ends = [...known];
  const lookCache = new Float64Array(words.length).fill(-1);
  const looks = (v: number) => {
    if (lookCache[v] < 0) {
      let m = Infinity;
      for (const [b, c] of ends) m = Math.min(m, (b === v ? 0 : strokeDiff(words[v], words[b])) + c);
      lookCache[v] = m;
    }
    return lookCache[v];
  };
  let seed = 7;
  for (const ch of puzzle.start + puzzle.goal) seed = (Math.imul(seed, 31) + ch.charCodeAt(0)) | 0;
  const random = seededRandom(seed);
  const spare = seededRandom(seed ^ 0x5bd1e995);
  const visited = new Uint8Array(words.length);
  const tally = { par: 0, near1: 0, near2: 0 };
  for (let game = 0; game < games; game++) {
    visited.fill(0);
    visited[s] = 1;
    const trail = [s];
    let spent = 0;
    let end = Infinity;
    for (let moves = 0; trail.length && moves < 60 && spent <= best + slack; moves++) {
      const u = trail[trail.length - 1];
      if (u === g) {
        end = spent;
        break;
      }
      if (u !== s && known.has(u)) {
        end = spent + known.get(u)!;
        break;
      }
      const doors = adj[u].filter((e) => !visited[e.to]);
      if (!doors.length) {
        trail.pop(); // back the way they came, for free
        continue;
      }
      // The cheapest door sure to make par, if `sure` and there is one (the first, of equals).
      let i = -1;
      if (sure) {
        let top = best - spent;
        doors.forEach((e, k) => {
          const total = e.cost + (known.get(e.to) ?? Infinity);
          if (total < top || (total === top && i < 0)) [top, i] = [total, k];
        });
      }
      if (i < 0) {
        const score = doors.map((e) => e.cost + looks(e.to));
        const least = Math.min(...score);
        const weight = score.map((x) => Math.exp(-(x - least) / temperature));
        let r = (spent > best ? spare : random)() * weight.reduce((a, b) => a + b, 0);
        i = 0;
        while ((r -= weight[i]) > 0 && i < doors.length - 1) i++;
      }
      spent += doors[i].cost;
      visited[doors[i].to] = 1;
      trail.push(doors[i].to);
    }
    if (end === Infinity && trail[trail.length - 1] === g) end = spent;
    if (end <= best) tally.par++;
    if (end <= best + Math.min(1, slack)) tally.near1++;
    if (end <= best + Math.min(2, slack)) tally.near2++;
  }
  const share = (x: number) => Math.round((100 * x) / games) / 100;
  return { par: share(tally.par), near1: share(tally.near1), near2: share(tally.near2) };
}

// ---------- Both ends ----------

/** How many letters differ between two words of the same length. */
export const lettersApart = (a: string, b: string) => {
  let n = 0;
  for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) n++;
  return n;
};

/** The puzzle the other way round, goal to start: doors cost the same both ways, so its best is the same. */
export const reversed = (p: Puzzle): Puzzle => ({ start: p.goal, goal: p.start, best: p.best, path: [...p.path].reverse() });

/**
 * Tricky from both ends: no rule of thumb makes par walking from the start to the goal, nor walking
 * back from the goal to the start. A player who works back from the goal is using the second, and
 * the pool's own checks (`measure`) only ever look forward. `back` is `measure` of the reversed puzzle.
 */
export const isTrickyBothWays = (d: Difficulty, back: Difficulty) => isTricky(d) && isTricky(back);

// ---------- Planners: thinking before moving ----------

/**
 * How a planner searches, in their head (so it costs nothing) before making a move:
 * - 'forward': out from the start, towards the goal;
 * - 'backward': back from the goal, towards the start;
 * - 'meet': first back from the goal, at most `steps` doors, then out from the start towards any word
 *   found on the goal's side, joining up in the middle (working back about 3 steps from the goal,
 *   then about 3 from the start, as playtesting found works).
 */
export type Plan = 'forward' | 'backward' | 'meet';

export interface PlanOptions {
  games?: number;
  /** As in parChance: each point a word looks worse makes it `e^(1/temperature)` times less likely to be looked at next. */
  temperature?: number;
  /** Words the planner looks at (lists the doors of) before settling for the best plan so far. For 'meet', half go to the goal's side. */
  budget?: number;
  /** For 'meet': how many doors back from the goal the first half goes. */
  steps?: number;
  /** The chance of seeing each door of a word looked at that changes one letter (1, every door, as parChance assumes). */
  notice?: number;
  /** The chance of seeing a door that changes two or three letters at once (a stroke moved between letters, say), which a player thinking in letter swaps misses more often. Defaults to `notice`. */
  hidden?: number;
}

export interface PlanOdds {
  /** The share of games that found a par plan within the budget, to two places. */
  par: number;
  /** ...whose best plan was at most 1 stroke over par. */
  near1: number;
  /** ...at most 2 strokes over. */
  near2: number;
}

/**
 * How often a planner finds a par route before moving, out of `games`. A planner keeps the words
 * they've found on each side with the cheapest strokes they know from that end, and looks next at
 * one of them at random, leaning towards those that look closer to the other end (strokes so far plus
 * the strokes difference left, judged by eye as in parChance). Looking at a word finds its doors.
 * A plan is a word found from both ends; the player knows par (the game shows it), so they stop at
 * a par plan, or after `budget` words with the best plan they have. Seeded by the puzzle and the plan,
 * so the same puzzle always scores the same.
 *
 * 'meet' heads from the start towards the goal's side as a whole: a word looks as close as the
 * cheapest-looking way to finish through a word found there (its strokes difference to that word
 * plus that word's known strokes to the goal).
 */
export function planChance(words: string[], adj: Graph, puzzle: Puzzle, plan: Plan, { games = 400, temperature = 1, budget = 20, steps = 3, notice = 1, hidden = notice }: PlanOptions = {}): PlanOdds {
  const n = words.length;
  const s = words.indexOf(puzzle.start);
  const g = words.indexOf(puzzle.goal);
  const pairs = new Map<number, number>();
  const diff = (a: number, b: number) => {
    if (a === b) return 0;
    const k = a < b ? a * n + b : b * n + a;
    let v = pairs.get(k);
    if (v === undefined) pairs.set(k, (v = strokeDiff(words[a], words[b])));
    return v;
  };
  let seed = 7;
  for (const ch of `${puzzle.start}${puzzle.goal}${plan}`) seed = (Math.imul(seed, 31) + ch.charCodeAt(0)) | 0;
  const random = seededRandom(seed);
  const tally = { par: 0, near1: 0, near2: 0 };
  for (let game = 0; game < games; game++) {
    // Side 0 is found from the start, side 1 from the goal: each word's cheapest known strokes from that
    // end, its words from that end, and the words not looked at yet (or found cheaper since).
    const sides = [s, g].map((root) => ({ cost: new Map([[root, 0]]), hops: new Map([[root, 0]]), open: new Set([root]) }));
    // Each door is seen or missed once per game, whichever end it's looked at from.
    const seen = new Map<number, boolean>();
    const sees = (u: number, v: number) => {
      if (notice >= 1 && hidden >= 1) return true;
      const k = u < v ? u * n + v : v * n + u;
      let x = seen.get(k);
      if (x === undefined) seen.set(k, (x = random() < (lettersApart(words[u], words[v]) > 1 ? hidden : notice)));
      return x;
    };
    // How close a word looks to the far end, from each side (cached: in 'meet', the goal's side is
    // fixed by the time the start's side is searched).
    const looks = [new Map<number, number>(), new Map<number, number>()];
    const look = (k: number, w: number) => {
      let v = looks[k].get(w);
      if (v !== undefined) return v;
      if (k === 1) v = diff(w, s);
      else if (plan !== 'meet') v = diff(w, g);
      else {
        v = Infinity;
        for (const [b, c] of sides[1].cost) v = Math.min(v, diff(w, b) + c);
      }
      looks[k].set(w, v);
      return v;
    };
    let found = Infinity;
    const lookAt = (k: number, limit: number): boolean => {
      const side = sides[k];
      if (!side.open.size) return false;
      const open = [...side.open];
      const f = open.map((w) => side.cost.get(w)! + look(k, w));
      const least = Math.min(...f);
      const weight = f.map((x) => Math.exp(-(x - least) / temperature));
      let r = random() * weight.reduce((a, b) => a + b, 0);
      let i = 0;
      while ((r -= weight[i]) > 0 && i < open.length - 1) i++;
      const u = open[i];
      side.open.delete(u);
      const far = k === 0 ? g : s;
      for (const { to, cost } of adj[u]) {
        if (!sees(u, to)) continue;
        const c = side.cost.get(u)! + cost;
        if (c >= (side.cost.get(to) ?? Infinity)) continue;
        side.cost.set(to, c);
        side.hops.set(to, side.hops.get(u)! + 1);
        if (to !== far && side.hops.get(to)! < limit) side.open.add(to);
        const other = sides[1 - k].cost.get(to);
        if (other !== undefined) found = Math.min(found, c + other);
      }
      return true;
    };
    let used = 0;
    if (plan === 'meet') while (used < budget >> 1 && found > puzzle.best && lookAt(1, steps)) used++;
    const k = plan === 'backward' ? 1 : 0;
    while (used < budget && found > puzzle.best && lookAt(k, Infinity)) used++;
    if (found <= puzzle.best) tally.par++;
    if (found <= puzzle.best + 1) tally.near1++;
    if (found <= puzzle.best + 2) tally.near2++;
  }
  const share = (x: number) => Math.round((100 * x) / games) / 100;
  return { par: share(tally.par), near1: share(tally.near1), near2: share(tally.near2) };
}

/** What the pool and the day files keep of a puzzle's difficulty: the worst few traps describe it. */
export interface KeptDifficulty {
  depth: number;
  pocketsBeside: number;
  traps: Trap[];
  /** Some trap leads into a pocket (the strongest kind). */
  pocketTrap: boolean;
  parChance: number;
}

export const keep = ({ depth, pocketsBeside, traps }: Difficulty, chance: number): KeptDifficulty => ({
  depth,
  pocketsBeside,
  traps: traps.slice(0, 3),
  pocketTrap: traps.some((t) => t.pocket),
  parChance: chance,
});

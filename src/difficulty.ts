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
  const s = words.indexOf(puzzle.start);
  const g = words.indexOf(puzzle.goal);
  const looks = words.map((w) => strokeDiff(w, puzzle.goal));
  const seen = new Uint8Array(words.length);
  // The best a run of up to `k` more doors from u looks (stopping early at the goal).
  const ahead = (u: number, k: number): number => {
    if (u === g) return 0;
    if (k === 0) return looks[u];
    let m = Infinity;
    for (const { to, cost } of adj[u]) {
      if (seen[to]) continue;
      seen[to] = 1;
      m = Math.min(m, cost + ahead(to, k - 1));
      seen[to] = 0;
    }
    return Number.isFinite(m) ? m : looks[u] + 99; // a dead end looks worst
  };
  for (let k = 1; k <= 3; k++) {
    const walk = (u: number, spent: number): boolean => {
      if (u === g) return spent === puzzle.best;
      // (The cheapest a goal can still be reached from here, so hopeless walks stop early.)
      if (spent + toGoal[u] > puzzle.best) return false;
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
  const s = words.indexOf(puzzle.start);
  const g = words.indexOf(puzzle.goal);
  const looks = words.map((w) => strokeDiff(w, puzzle.goal));
  let seed = 7;
  for (const ch of puzzle.start + puzzle.goal) seed = (Math.imul(seed, 31) + ch.charCodeAt(0)) | 0;
  const random = seededRandom(seed);
  const visited = new Uint8Array(words.length);
  let par = 0;
  for (let game = 0; game < games; game++) {
    visited.fill(0);
    visited[s] = 1;
    const trail = [s];
    let spent = 0;
    for (let moves = 0; trail.length && trail[trail.length - 1] !== g && moves < 60 && spent <= puzzle.best; moves++) {
      const u = trail[trail.length - 1];
      const doors = adj[u].filter((e) => !visited[e.to]);
      if (!doors.length) {
        trail.pop(); // back the way they came, for free
        continue;
      }
      const score = doors.map((e) => e.cost + looks[e.to]);
      const least = Math.min(...score);
      const weight = score.map((x) => Math.exp(-(x - least) / temperature));
      let r = random() * weight.reduce((a, b) => a + b, 0);
      let i = 0;
      while ((r -= weight[i]) > 0 && i < doors.length - 1) i++;
      spent += doors[i].cost;
      visited[doors[i].to] = 1;
      trail.push(doors[i].to);
    }
    if (trail[trail.length - 1] === g && spent === puzzle.best) par++;
  }
  return Math.round((100 * par) / games) / 100;
}

/** A puzzle no rule of thumb solves at par. */
export const isTricky = (d: Difficulty) => d.obvious.length === 0;

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

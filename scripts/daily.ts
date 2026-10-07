// Choose a daily puzzle, and check it in.
//
//   npm run daily                            # candidates for the day after the latest daily
//   npm run daily -- 2026-10-09              # candidates for that date
//   npm run daily -- 2026-10-09 COLD WARM    # check that pair in as that date's puzzle
//
// Candidates come from the puzzle pool (public/mazes.json, see scripts/mazes.ts), so every one is
// tricky, passes a pocket, starts and ends on everyday words, and fits the pool's rules. The script
// cycles through it: never a pair already used (either way round), no start or goal word from the
// last 30 days, the day's difficulty from a weekly rhythm (the easiest third of the pool early in the
// week, the hardest by the weekend, by how often a simulated player makes par: see
// src/difficulty.ts), and the kind of route (see classifyNeed in src/maze.ts) the last week has had
// least of. The same date and history always give the same candidates.
//
// Checking in writes src/daily/days/{DATE}.json and prints what the celebration prompt needs (see
// docs/daily-celebration-prompt.md). The history is the day files themselves.

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { findPockets, isTricky, keep, measure, parChance, type KeptDifficulty } from '../src/difficulty';
import { placePots, potRoute } from '../src/inkpots';
import { POOL_MIX, buildGraph, classifyNeed, routeWords, seededRandom, solve, type Need, type Puzzle } from '../src/maze';
import type { DailyPuzzle } from '../src/daily/daily';
import { dayNumber } from '../src/daily/daily';

const DAYS = new URL('../src/daily/days/', import.meta.url);
const LOG = new URL('../src/daily/LOG.md', import.meta.url);
const CANDIDATES = 10;
/** Start and goal words rest this long before they come back. */
const REST_DAYS = 30;
/** How hard each weekday's puzzle is, Sunday first: easier early in the week, hardest by the weekend. */
type Band = 'easy' | 'middle' | 'hard';
const RHYTHM: Band[] = ['middle', 'easy', 'easy', 'middle', 'middle', 'hard', 'hard'];
const THIRD: Record<Band, string> = { easy: 'easiest third', middle: 'middle third', hard: 'hardest third' };
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const NEED_TEXT: Record<Need, string> = {
  none: 'needs no C, I or V',
  letter: 'changes a C, I or V the start or goal has',
  stone: 'needs a stepping stone through C, I or V',
};

type PoolEntry = Omit<DailyPuzzle, 'date'>;
const data: { words: string[]; puzzle: Puzzle; inkPots: DailyPuzzle['inkPots']; onRoute: DailyPuzzle['onRoute']; puzzles: PoolEntry[] } = JSON.parse(
  readFileSync(new URL('../public/mazes.json', import.meta.url), 'utf8'),
);
const definitions: Record<string, [string, string]> = JSON.parse(readFileSync(new URL('../public/definitions.json', import.meta.url), 'utf8'));

const days: DailyPuzzle[] = readdirSync(DAYS)
  .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
  .sort()
  .map((f) => JSON.parse(readFileSync(new URL(f, DAYS), 'utf8')));

const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const weekday = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();
const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);
const define = (w: string) => (definitions[w] ? `${definitions[w][0]} ${definitions[w][1]}` : '(no definition)');
const pairKey = (p: { start: string; goal: string }) => [p.start, p.goal].sort().join('|');
const percent = (x: number) => `${Math.round(100 * x)}%`;

/** The pool in thirds by difficulty: hardest first (least often at par, then the deepest plan, then the most traps). */
const harder = (a: PoolEntry, b: PoolEntry) => {
  const [x, y] = [a.difficulty!, b.difficulty!];
  return x.parChance - y.parChance || y.depth - x.depth || y.traps.length - x.traps.length || pairKey(a.puzzle).localeCompare(pairKey(b.puzzle));
};
const ranked = data.puzzles.filter((p) => p.difficulty).sort(harder);
const bandOf = new Map<string, Band>(ranked.map((p, i) => [pairKey(p.puzzle), i < ranked.length / 3 ? 'hard' : i < (2 * ranked.length) / 3 ? 'middle' : 'easy']));

/** What makes a puzzle tricky, in a line. */
function describe(d: KeptDifficulty | undefined) {
  if (!d) return 'tricky';
  const plan = d.depth > 3 ? 'plan more than 3 steps ahead' : `plan ${d.depth} steps ahead`;
  const traps = d.traps.length ? `traps ${d.traps.map((t) => `${t.door} from ${t.at} (loses ${t.loses}${t.pocket ? ', into a pocket' : ''})`).join(', ')}` : 'no traps';
  return `makes par ${percent(d.parChance)} of the time; ${plan}; ${traps}; ${d.pocketsBeside} pocket${d.pocketsBeside === 1 ? '' : 's'} beside the route`;
}

const [date = days.length ? addDays(days[days.length - 1].date, 1) : '2026-10-06', start, goal, ...flags] = process.argv.slice(2);
if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) throw new Error(`"${date}" isn't a date (YYYY-MM-DD)`);
const before = days.filter((d) => d.date < date);
const used = new Set(days.filter((d) => d.date !== date).map((d) => pairKey(d.puzzle)));
const resting = new Set(before.filter((d) => d.date >= addDays(date, -REST_DAYS)).flatMap((d) => [d.puzzle.start, d.puzzle.goal]));

if (!start) {
  // ---------- Candidates ----------
  const band = RHYTHM[weekday(date)];
  const inBand = (p: PoolEntry) => bandOf.get(pairKey(p.puzzle)) === band;
  // The kind of route the last week has had least of, against the pool's mix.
  const week = before.filter((d) => d.date >= addDays(date, -7));
  const needs = Object.keys(POOL_MIX.need) as Need[];
  const owed = (n: Need) => POOL_MIX.need[n] * (week.length + 1) - week.filter((d) => d.need === n).length;
  const need = needs.reduce((a, b) => (owed(b) > owed(a) ? b : a));
  const fresh = data.puzzles.filter((p) => !used.has(pairKey(p.puzzle)) && !resting.has(p.puzzle.start) && !resting.has(p.puzzle.goal));
  const random = seededRandom(hash(date));
  const shuffled = (xs: PoolEntry[]) => xs.map((x) => ({ x, r: random() })).sort((a, b) => a.r - b.r).map((o) => o.x);
  // The day's band and kind first; then the day's band of other kinds; then anything fresh.
  const picks = [
    ...shuffled(fresh.filter((p) => inBand(p) && p.need === need)),
    ...shuffled(fresh.filter((p) => inBand(p) && p.need !== need)),
    ...shuffled(fresh.filter((p) => !inBand(p))),
  ].slice(0, CANDIDATES);

  const range = ranked.filter((p) => bandOf.get(pairKey(p.puzzle)) === band).map((p) => p.difficulty!.parChance);
  console.log(
    `Daily #${dayNumber(date)}, ${WEEKDAYS[weekday(date)]} ${date}: a puzzle from the ${THIRD[band]} of the pool (made at par ${percent(Math.min(...range))}–${percent(Math.max(...range))} of the time), preferably one that ${NEED_TEXT[need]}.`,
  );
  console.log(`${fresh.filter(inBand).length} unused puzzles in the pool in that third.\n`);
  picks.forEach((p, i) => {
    const { start: s, goal: g, best: b, path } = p.puzzle;
    console.log(`${String(i + 1).padStart(2)}. ${s} → ${g}   lowest strokes ${b} in ${path.length - 1} steps, ${NEED_TEXT[p.need]}${inBand(p) ? '' : ` (from the ${THIRD[bandOf.get(pairKey(p.puzzle)) ?? 'middle']})`}`);
    console.log(`    route: ${path.join(' → ')}`);
    console.log(`    ${describe(p.difficulty)}`);
    console.log(`    ${s}: ${define(s)}`);
    console.log(`    ${g}: ${define(g)}\n`);
  });
  if (fresh.filter(inBand).length < 30)
    console.log(`The pool is running low: regenerate it with a new seed (scripts/mazes.ts), then rerun this.\n`);
  console.log(`Check one in with: npm run daily -- ${date} START GOAL`);
} else {
  // ---------- Check in ----------
  const S = start.toUpperCase();
  const G = goal!.toUpperCase();
  const any = flags.includes('--any'); // a hand-picked pair outside the pool's rules
  if (used.has(pairKey({ start: S, goal: G }))) throw new Error(`${S} → ${G} (or ${G} → ${S}) is already a daily`);
  if (!any && (resting.has(S) || resting.has(G))) throw new Error(`${resting.has(S) ? S : G} was a start or goal in the last ${REST_DAYS} days`);
  const file = new URL(`${date}.json`, DAYS);
  if (existsSync(file) && !flags.includes('--replace')) throw new Error(`${date} already has a puzzle (pass --replace to change it)`);

  let entry: PoolEntry | undefined = data.puzzles.find((p) => p.puzzle.start === S && p.puzzle.goal === G);
  if (!entry && S === data.puzzle.start && G === data.puzzle.goal) {
    // The original puzzle (WILD → TAME), kept with its route and ink pots as the game has always had them.
    const { need, tricky, difficulty } = needOf(data.words, buildGraph(data.words), data.puzzle);
    entry = { puzzle: data.puzzle, inkPots: data.inkPots, need, tricky, difficulty, onRoute: data.onRoute };
  }
  if (!entry) {
    if (!any) throw new Error(`${S} → ${G} isn't in the pool; pick a candidate, or pass --any to check in a pair by hand`);
    const words = data.words;
    const adj = buildGraph(words);
    const solved = solve(words, adj, S, G);
    if (!solved) throw new Error(`${G} can't be reached from ${S} (are both in the word list?)`);
    const { need, tricky, difficulty, path } = needOf(words, adj, solved);
    const pots = placePots(words, adj, S, G, solved.best, path, seededRandom(hash(date)));
    const { bound: _bound, ...inkPots } = potRoute(words, adj, S, G, pots);
    entry = { puzzle: { ...solved, path }, need, tricky, difficulty, inkPots, onRoute: routeWords(words, adj, S, G) };
  }

  const day: DailyPuzzle = { date, ...entry };
  writeFileSync(file, `${JSON.stringify(day, null, 2)}\n`);
  const { puzzle } = day;
  const recent = existsSync(LOG)
    ? readFileSync(LOG, 'utf8')
        .split('\n')
        .filter((l) => l.startsWith('- '))
        .slice(-14)
    : [];
  console.log(`Wrote src/daily/days/${date}.json: ${puzzle.start} → ${puzzle.goal}, lowest strokes ${puzzle.best}.\n`);
  console.log('For the celebration prompt:');
  console.log(`  DATE: ${date}`);
  console.log(`  NUMBER: ${dayNumber(date)}`);
  console.log(`  START: ${puzzle.start}`);
  console.log(`  GOAL: ${puzzle.goal}`);
  console.log(`  ROUTE: ${puzzle.path.join(' → ')}`);
  console.log(`  BEST: ${puzzle.best}`);
  console.log(`  START_DEFINITION: ${define(puzzle.start)}`);
  console.log(`  GOAL_DEFINITION: ${define(puzzle.goal)}`);
  console.log(`  RECENT_CONCEPTS:${recent.length ? `\n${recent.map((l) => `    ${l}`).join('\n')}` : ' (none yet)'}`);
}

function needOf(words: string[], adj: ReturnType<typeof buildGraph>, p: Puzzle) {
  const { need, path } = classifyNeed(words, adj, p.start, p.goal, p.best);
  const d = measure(words, adj, p, findPockets(adj));
  return { need, path, tricky: isTricky(d), difficulty: keep(d, parChance(words, adj, p)) };
}

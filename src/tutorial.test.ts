import { describe, expect, it } from 'vitest';
import maze5Json from '../public/mazes-5.json';
import poolText from '../public/pool-5.json?raw';
import easyPoolText from '../public/pool-5-easy.json?raw';
import simpleText from '../data/simple-5.txt?raw';
import { TRAY_TURN, type Placement } from './glyphs';
import { nextSteps, type Doors } from './hints';
import { EMPTY_CELL_X, STEP_LIMIT, oneWayCost, recognize, slotKey, slotsFor } from './strokes';
import { restingTurn } from './turns';
import { SAMPLE, SAMPLE_STEP, applyMove, coachPlan, moveLines, planStep, sayMove, spell, stepChanges, trayLands, wordCells, type WordMove } from './tutorial';
import { parseWordList } from './wordlist';
import type { DailyPuzzle } from './daily/daily';

const { words, doors } = maze5Json as { words: string[]; doors: number[][] };
const dict = new Set(words);
const index = new Map(words.map((w, i) => [w, i]));
const doorsOf: Doors = (w) => {
  const flat = doors[index.get(w) ?? -1] ?? [];
  return Array.from({ length: flat.length / 2 }, (_, k): [string, number] => [words[flat[2 * k]], flat[2 * k + 1]]);
};
const norm = (r = 0) => ((r % 360) + 360) % 360;
const same = (a: Placement, b: Placement) => slotKey(a) === slotKey(b);

/**
 * Checks a move against the editor's own rules (see WordEditor): a stroke goes only on a spot its
 * letter offers, landing the only way that spot takes it, or as it's held (the tray's way, from the
 * tray); a turn is the next way round that fits its spot; a removed stroke was there.
 */
function expectLegal(cells: Placement[][], m: WordMove, touch: boolean) {
  const g = m.ghost;
  const where = `${spell(cells) ?? cells.map((c) => recognize(c) ?? '?').join('')}: ${JSON.stringify(m)}`;
  if (g.kind === 'remove') return expect(cells[m.cell].some((p) => same(p, g.at)), where).toBe(true);
  const source = g.kind === 'turn' ? g.at : g.from === 'tray' ? null : g.from;
  const fromCell = m.from ?? m.cell;
  if (source) expect(cells[fromCell].some((p) => same(p, source)), where).toBe(true);
  const base = cells[m.cell].filter((p) => !(source && fromCell === m.cell && same(p, source)));
  let slots = slotsFor(base, g.kind === 'turn' ? g.at.tile : g.tile).map((s) => s.placement);
  // A stroke alone in its letter is offered that letter's spots at its own x.
  if (source && fromCell === m.cell && !base.length) slots = slots.map((q) => ({ ...q, x: Math.round((q.x + source.x - EMPTY_CELL_X) * 100) / 100 }));
  expect(slots.some((q) => same(q, g.to)), where).toBe(true);
  const ways = slots.filter((q) => q.x === g.to.x && q.y === g.to.y).map((q) => norm(q.rot));
  if (g.kind === 'turn') {
    const turned = ways.filter((r) => r !== norm(g.at.rot)).sort((a, b) => norm(a - norm(g.at.rot)) - norm(b - norm(g.at.rot)));
    return expect(turned[0], where).toBe(norm(g.to.rot));
  }
  if (ways.length > 1) {
    const held = source ? (source.rot ?? 0) : TRAY_TURN[g.tile];
    const settles = restingTurn({ ways, held, tile: g.tile, fromLetter: touch && !!source && fromCell !== m.cell, intoEmpty: !base.length });
    expect(norm(settles), where).toBe(norm(g.to.rot));
  }
}

/**
 * Plays the sample as the game does, doing each move the coach shows: a word spelled becomes the
 * word you're in (it must be the one planned), and a step never runs past its strokes. `first` is
 * a move made before the coach's.
 */
function playCoached(touch: boolean, first?: (cells: Placement[][]) => WordMove) {
  let room = SAMPLE.start;
  let cells = wordCells(room);
  let used = 0;
  const visited = new Set([room]);
  const steps: { word: string; cost: number }[] = [];
  const said: string[] = [];
  let planned: string | null = null;
  const land = () => {
    const word = spell(cells);
    if (word && dict.has(word) && word !== room) {
      if (planned) expect(word).toBe(planned);
      steps.push({ word, cost: used });
      room = word;
      cells = wordCells(word);
      used = 0;
      visited.add(word);
    }
    expect(used).toBeLessThanOrEqual(STEP_LIMIT);
  };
  if (first) {
    const m = first(cells);
    expectLegal(cells, m, touch);
    cells = applyMove(cells, m);
    used++;
    land();
  }
  for (let n = 0; n < 12 && room !== SAMPLE.goal; n++) {
    const on = SAMPLE.path.indexOf(room);
    const targets = [...(on >= 0 ? [SAMPLE.path[on + 1]] : []), ...nextSteps(doorsOf, room, SAMPLE.goal, visited).map((s) => s.next)];
    const plan = coachPlan(cells, targets, used, { touch, stops: (w) => dict.has(w) || w === room });
    expect(plan, `from ${room}, ${used} used`).not.toBeNull();
    planned = plan!.target;
    const m = plan!.moves[0];
    expectLegal(cells, m, touch);
    said.push(sayMove(cells, m, touch));
    cells = applyMove(cells, m);
    used++;
    land();
  }
  return { steps, said };
}

describe('the sample puzzle', () => {
  it('is everyday words, all in the maze, 2 steps and its lowest strokes', () => {
    const simple = new Set(parseWordList(simpleText));
    for (const w of SAMPLE.path) {
      expect(dict.has(w), w).toBe(true);
      expect(simple.has(w), w).toBe(true);
    }
    expect(SAMPLE.path.length).toBe(3);
    const costs = SAMPLE.path.slice(1).map((w, i) => oneWayCost(SAMPLE.path[i], w));
    expect(costs).toEqual([2, 3]);
    expect(costs[0] + costs[1]).toBe(SAMPLE.best);
    // The whole maze's lowest (searched from the goal, over the doors shipped with the game).
    expect(nextSteps(doorsOf, SAMPLE.start, SAMPLE.goal, new Set())[0].remaining).toBe(SAMPLE.best);
    // Not one step: the goal isn't a door of the start.
    expect(doorsOf(SAMPLE.start).some(([w]) => w === SAMPLE.goal)).toBe(false);
  });

  it('has one lowest route, so the coach and the card agree on it', () => {
    let routes = 0;
    const walk = (w: string, spent: number) => {
      if (w === SAMPLE.goal) return void routes++;
      for (const step of nextSteps(doorsOf, w, SAMPLE.goal, new Set())) if (spent + step.cost <= SAMPLE.best) walk(step.next, spent + step.cost);
    };
    expect(nextSteps(doorsOf, SAMPLE.start, SAMPLE.goal, new Set()).map((s) => s.next)).toEqual([SAMPLE.path[1]]);
    walk(SAMPLE.start, 0);
    expect(routes).toBe(1);
  });

  it("gives away no daily: no daily or pool puzzle has its start and goal, or either of its steps", () => {
    const days = Object.values(import.meta.glob<DailyPuzzle>('./daily/days-5/*.json', { eager: true, import: 'default' }));
    const pools = [poolText, easyPoolText].flatMap((t) => (JSON.parse(t) as { puzzles: Pick<DailyPuzzle, 'puzzle' | 'inkPots'>[] }).puzzles);
    const pair = (a: string, b: string) => [a, b].sort().join('-');
    const taken = new Set<string>();
    for (const p of [...days, ...pools]) {
      taken.add(pair(p.puzzle.start, p.puzzle.goal));
      for (const route of [p.puzzle.path, p.inkPots.walk]) route.forEach((w, i) => i && taken.add(pair(route[i - 1], w)));
    }
    expect(days.length).toBeGreaterThan(10);
    expect(taken.has(pair(SAMPLE.start, SAMPLE.goal))).toBe(false);
    SAMPLE.path.forEach((w, i) => i && expect(taken.has(pair(SAMPLE.path[i - 1], w)), `${SAMPLE.path[i - 1]} → ${w}`).toBe(false));
  });
});

describe("the sample's coach", () => {
  it('solves it at its lowest by the moves it shows, each one the editor allows, on touch and with a mouse', () => {
    for (const touch of [true, false]) {
      const { steps } = playCoached(touch);
      expect(steps).toEqual([
        { word: 'JUDGE', cost: 2 },
        { word: 'FUDGE', cost: 3 },
      ]);
    }
  });

  it('says each move in a line, a tap or a click as the device has it', () => {
    expect(playCoached(true).said).toEqual([
      'Drag the bar from the tray onto the C to make G.',
      'Drag the big curve from the tray onto the I to make D.',
      "Tap the J's curve to remove it.",
      'Drag the bar from the tray onto the I.',
      'Drag the bar from the tray onto the 1st letter to make F.',
    ]);
    expect(playCoached(false).said[2]).toBe("Click the J's curve to remove it.");
  });

  it('follows the player when they do the letters the other way round', () => {
    const curveFirst = (cells: Placement[][]): WordMove => ({ cell: 2, ghost: { kind: 'carry', tile: 'C', from: 'tray', to: trayLands(cells[2], 'C')[0] } });
    const { steps, said } = playCoached(true, curveFirst);
    expect(said[0]).toBe('Drag the bar from the tray onto the C to make G.');
    expect(steps.map((s) => s.cost)).toEqual([2, 3]);
  });

  it('has nothing to show once the letters have gone where the step can’t make a word on the route', () => {
    // The J's curve off in the first step: JUDGE now needs 3 more strokes, with 2 left.
    const cells = applyMove(wordCells(SAMPLE.start), { cell: 0, ghost: { kind: 'remove', at: wordCells('J')[0][1] } });
    expect(coachPlan(cells, ['JUDGE'], 1, { touch: true, stops: (w) => dict.has(w) })).toBeNull();
    // From the start it's two strokes, not three.
    expect(planStep(wordCells(SAMPLE.start), 'JUDGE', STEP_LIMIT, { touch: true, stops: (w) => dict.has(w) })?.length).toBe(2);
  });

  it('never passes another word on the way: a step that would land early is planned another way, or not at all', () => {
    // Were JUIGE a word, the bar onto the C would land there: the curve goes first instead.
    const plan = planStep(wordCells('JUICE'), 'JUDGE', STEP_LIMIT, { touch: true, stops: (w) => w === 'JUIGE' })!;
    expect(sayMove(wordCells('JUICE'), plan[0], true)).toBe('Drag the big curve from the tray onto the I to make D.');
    expect(spell(plan.reduce(applyMove, wordCells('JUICE')))).toBe('JUDGE');
    // Were JUDCE one too, it would take a stroke more (the C's curve carried over to the I, then the
    // G built afresh), and with only two strokes left, there'd be no way.
    const stops = (w: string) => w === 'JUIGE' || w === 'JUDCE';
    const longer = planStep(wordCells('JUICE'), 'JUDGE', STEP_LIMIT, { touch: true, stops })!;
    expect(longer.length).toBe(3);
    longer.reduce((cells, m) => {
      const next = applyMove(cells, m);
      expect(stops(spell(next) ?? '')).toBe(false);
      return next;
    }, wordCells('JUICE'));
    expect(planStep(wordCells('JUICE'), 'JUDGE', 2, { touch: true, stops })).toBeNull();
  });
});

describe("How to play's card", () => {
  it('tells a finger to tap and double-tap, and a mouse to click and swipe', () => {
    expect(moveLines(true)).toEqual(['Drag a stroke in from the tray', 'Tap one to remove it', 'Drag one to move it', 'Double-tap one to turn it']);
    expect(moveLines(false)).toEqual(['Drag a stroke in from the tray', 'Click one to remove it', 'Drag one to move it', 'To turn one, swipe it as you place it']);
  });

  it("shows the sample's step with the strokes that come off and go on: the J's curve off, two bars on for F", () => {
    const from = SAMPLE.path[SAMPLE_STEP];
    const to = SAMPLE.path[SAMPLE_STEP + 1];
    const changes = stepChanges(from, to);
    expect(changes.slice(1).every((c) => !c.removed.length && !c.added.length)).toBe(true);
    expect(changes[0].removed.map((p) => p.tile)).toEqual(['P']);
    expect(changes[0].added.map((p) => `${p.tile}@${p.y}`)).toEqual(['H@0', 'H@1']);
    // As many strokes as the step costs.
    expect(changes[0].removed.length + changes[0].added.length).toBe(oneWayCost(from, to));
  });
});

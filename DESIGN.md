# Segment Smush: game design draft

## Context
The game is a daily word puzzle modeled on Hank Green's *Smush*. In Smush, letter tiles have 5 uses each, a gold center tile is required in every word and never runs out, a "spicy" tile doubles a word's score, and using a tile's last charge (smushing it) also doubles the score. Players hunt for the pangram.

In this version, **the tiles are pen strokes instead of letters**. Players type words normally, and each letter costs a fixed set of stroke tiles from the board. This document settles the game design before we choose a technical architecture. The repo is `~/Code/word-puzzle`, which is currently empty apart from a README.

Decisions so far:
- **Core loop:** the player types a word, and each letter's stroke recipe is deducted from the board.
- **Charges:** per word. A tile loses 1 charge for each word that uses it, no matter how many times the word uses it. Each tile has 5 charges.
- **Design rule:** no tile may appear only alongside another tile. Under per-word charges, such a tile is redundant because it can never be used up on its own.
- **Tile identity (version B):** straight bars keep their orientation. Chevrons and arcs are rotatable shapes.

## 1. Tile inventory (10 types)
**Rule: every stroke type is used by at least two letters** (enforced in `src/game.test.ts`).
Every letter sits in a box 1 unit wide and 2 units tall.

| Tile | Shape | Letters |
|---|---|---|
| `LV` | Long vertical | B D E F H I K L M N P R T |
| `SV` | Short vertical | G J U Y |
| `H`  | Horizontal | A E F G H L T Z |
| `LD` | Long `/` | X Z |
| `LB` | Long `\` | N X |
| `SB` | Short `\` (tail) | Q R |
| `BV` | Big chevron, rotates | A (`^`), V, W |
| `SC` | Small chevron, rotates | K (`<`), M and Y (`v`) |
| `C`  | Big arc (half circle, full height), rotates | C D G O Q |
| `P`  | Bowl (half circle with straight ends), rotates | B P R S J U |

## 2. Letter recipes (uppercase)
```
A BV H      H LV LV H     O C C       V BV
B LV P P    I LV          P LV P      W BV BV
C C         J SV P        Q C C SB    X LD LB
D LV C      K LV SC       R LV P SB   Y SC SV
E LV H H H  L LV H        S P P       Z H H LD
F LV H H    M LV LV SC    T LV H
G C H SV    N LV LV LB    U SV SV P
```
Letter renderings (position and rotation of each tile instance) are stored with the recipe. Recipes are data and can be tuned.

**Verified (system dictionary, words of 4+ letters):** no tile appears only alongside another. A 5-tile board has about 22 words at the median, and a 6-tile board about 105. About 50 boards of 5–7 tiles have a pangram and 30–600 words. Combined with the choice of center and spicy tile, that gives a few hundred distinct puzzles. These numbers need re-checking against a curated word list.

## 3. The board
- **About 6 tiles** per puzzle (to be tuned), each drawn graphically with charge dots.
- The puzzle is generated **from the pangram first**: the board is the union of the pangram's tiles.
- The **center tile** is required in every word and has unlimited uses.
- **Playable letters** are those whose full recipe fits the board. All other letters are greyed out on the keyboard.
- **Generator checks:** a pangram exists, the word count is within the target range, and no tile appears only alongside another across the board's valid words.

## 4. Scoring
- **Base score = total stroke instances in the word** (BEE = 3 `LV` + 6 `H` + 4 `P` = 13).
- **Spicy tile:** one tile is spicy and moves after each word. Using it doubles the word's score.
- **Smush:** using a tile's last charge doubles the word's score. Both bonuses stack.
- **Pangram:** a flat bonus (for example +25).
- **Minimum word length:** 4 letters (to be decided).

## 5. Interface sketch
- **Top:** the board tiles, each a small drawing of the stroke with charge dots. The center tile is gold and the spicy tile has a flame.
- **Middle:** the word in progress, drawn letter by letter from the stroke shapes. The tiles the word will use light up and show which charge they'll lose.
- **Bottom:** an on-screen keyboard with unplayable letters greyed out, plus a SMUSH button. A found-words list and the score sit alongside.

## 6. Content pipeline (for later)
- A curated public-domain word list (such as ENABLE) with a profanity filter.
- An offline generator script whose output is a JSON file per day.

## Proof-of-concept goal
The PoC answers two questions: **is the game feasible, and is it fun as a puzzle?** Board size and tuning numbers are not a focus yet. The glyphs must look good even in the PoC, because the stroke-built letters are the hook.

### Glyph aesthetics
- Uniform stroke weight, round caps and joins, and true circular arcs. Letter proportions come from a geometric sans-serif (in the spirit of Futura or Avenir), not a 7-segment display.
- Each tile type has its own color, so a letter shows at a glance which tiles built it. The palette is muted and harmonious, with light and dark themes.
- As the player types, each stroke flies from its tile and snaps into the letter with a spring. Backspace sends it back. On SMUSH, the letters collapse, the strokes return to their tiles, and the charge dots drain.
- Polish the glyphs first: a gallery page of A–Z, iterated until every letter reads cleanly and looks good, before the game UI goes on top.

### PoC scope
- **Stack:** Vite + TypeScript + React + **Motion** (formerly Framer Motion), rendering SVG. Motion's spring physics and shared-layout animations (`layoutId`) handle the core effect: a stroke leaves its board tile, then rotates, scales and **snaps** into place in the letter. On SMUSH, it springs back. The game logic stays framework-free.
- `src/glyphs.ts`: tile shapes plus per-letter placements (position and rotation), all as data.
- `src/game.ts`: pure logic, covering the recipe lookup, playable letters, word validation, charges, spicy and smush bonuses, pangram detection and scoring. Unit-tested with Vitest.
- `src/components/`: `Board`, `Tile`, `Glyph`, `WordLine`, `Keyboard`, `FoundWords`, plus a `GlyphGallery` route for polishing the look.
- `scripts/boards.py`: the board analysis script (already sketched) made permanent. It writes about 5 hand-picked boards to `public/boards.json`. The PoC has a board picker so several puzzles can be play-tested.
- **Word list:** ENABLE (public domain). Downloading it needs your approval at build time. The fallback is `/usr/share/dict/words`, which lacks plurals and inflections.
- **Not in scope:** daily rotation, persistence, sharing, and stats.

### Open questions (to answer through play-testing)
- Does the charge pressure create interesting choices, or is it just friction?
- Does spending strokes feel meaningfully different from Smush's letters?
- Board size, minimum word length and the pangram bonus, all tuned from play.

## Next steps after approval
1. Scaffold the Vite + React + TS project (adding `motion` and `vitest`) in `~/Code/word-puzzle` and write `DESIGN.md` from this plan.
2. Build the glyph gallery and iterate on the look.
3. Build the game logic with tests, then the playable UI with the board picker.
4. Commit at each milestone.

## Verification
- Run `npm test` to unit-test the logic: recipes, charges, pangram and scoring.
- Run `npm run dev` and check in the browser pane: the A–Z gallery is legible and looks good in light and dark themes; play a full board end to end, including a smush, a spicy bonus and a pangram; check at phone width.

## PoC findings (2026-10-01)
- **Glyphs:** all 26 letters are readable from the 10-tile set (see `#gallery`). S was adjusted so its two bowls share one middle spine.
- **Board generator** (`scripts/boards.ts`, written in TypeScript so it shares recipes with the game): with ENABLE and words of 4+ letters, 75 of 252 five-tile boards have a pangram, and 141 board/center combinations have 40–600 words. Only 21 of them are fully *untied*.
- **Tied tiles are structural.** Some strokes are only used by one or two letters (for example `LB` is used only by N and X), so on a given board they nearly always appear alongside another tile. The generator records these as `tied` and penalizes them instead of rejecting the board.
- **Games are short.** With 5 charges per tile, a 6-tile board ran out after **6 words**, because each word spends about 3–4 of the ~25 charges. That may be a tight optimization puzzle or may feel too short; the play-test footer has a charges selector (3/5/7/10) for comparison.
- **The word list is permissive.** ENABLE accepts obscure words (SWINK, OXIM). A daily game would need a curated list.
- **S is made of two bowls (2026-10-02).** A brief detour gave S its own small-arc tile; that broke the rule that every stroke is shared by at least two letters, so S went back to the bowl stroke of B/P/R. The bowls are offset by a quarter so their middle ends overlap into a short spine (no full-width middle bar, only a slight lean).

## Pivot: Stroke Maze (2026-10-01)
In Smush-style play the letters, not the strokes, did the work. The new core loop makes strokes the mechanism.

- **Rooms are words; doors are stroke edits.** From the current word, drag strokes on, off or to a new position (each drag is 1 stroke). Landing on a real 4-letter word opens a door into that room. A step may use **up to 3 strokes**.
- **Fog of war:** you see the rooms you've visited and how many doors the current room has, but not where they lead.
- **Goal and score:** get from a start word to a goal word using the **fewest total strokes**. Each puzzle shows the best possible total (Dijkstra over the word graph).
- **Placement rules** (`slotsFor` in `src/strokes.ts`):
  - A drop must keep the cell part of one real letter, at that letter's exact positions. A complete letter accepts nothing unless a bigger letter contains it (F→E, P→R, O→Q, V→W).
  - Letters grow rightward from the strokes already there, so a stroke never has two equivalent spots.
  - One spot can take a rotatable stroke in several orientations (an empty cell's chevron as V's `v` or A's `^`); the player chooses by twisting (see below). *(Briefly, the upright orientation won automatically; twisting replaced that.)*
  - Every letter-to-letter change is still possible (remove the extra strokes, then add the new ones); `src/strokes.test.ts` checks all 676 letter pairs.
- **Dragging:** only the hovered cell reacts. Fixed strokes preview at the spot nearest the pointer. Rotatable strokes (chevrons, arcs, bowls) lock onto the nearest spot and keep the orientation they're held at; see *Twisting* below. A cell where nothing fits, or where the held orientation doesn't fit, turns the whole letter red. Rotatable strokes carry a ↻ badge in the tray.
- **Why 3 strokes per step** (ENABLE, 4-letter words):

  | Strokes per step | Main connected maze | Typical doors |
  |---|---|---|
  | 1 | 11 words | 0 |
  | 2 | 6% of words | 1 |
  | **3** | **75% of words** | **5–6** |
  | 4 | 97% of words | 11 (routes too short) |

- Words: originally ENABLE-only (rooms like PEAN, LUNT); now familiar words only, see below.
- The old Smush prototype is still at `/#smush`.

## Familiar words, one maze, tap-to-remove, ink (2026-10-02)
- **Words.** Rooms are the 1,845 four-letter words in `data/familiar-4.txt`: SCOWL size 35 (everyday vocabulary), lowercase entries only (no names or abbreviations), also valid in ENABLE, minus a small blocklist of sexual terms, slurs and swears (`src/wordlist.ts`). With 3 strokes per step, 72% of them form one connected maze (median 4 doors), about as connected as the old ENABLE maze (75%, 6). SCOWL size 50 added almost no connectivity and brought back esoteric words (ABBE, KITH, TYRO), so it isn't used.
- **One maze.** WILD → TAME, best 14 strokes over 5 rooms (WILD → WILL → VILE → TILE → TALE → TAME), 5 doors at the start. Set by `START`/`GOAL` in `scripts/mazes.ts`.
- **Removing strokes.** Tap a placed stroke to remove it (1 stroke); dragging moves it. *(Dragging a stroke off the word used to remove it too; that was dropped on 2026-10-03, so a stroke dropped off the word springs back to its slot.)* Hovering a stroke lifts it.
- **Ink.** Strokes are drawn as filled outlines from a broad nib held at 38° (downstrokes thicker than crossbars) with a gentle seeded wobble and slightly lighter ends (`src/ink.ts`). The wobble ignores horizontal position, so a letter looks the same everywhere, like a font. Small glyphs keep a minimum weight of about 1.2 px. Game geometry still uses the plain centreline paths.
- **Palette.** Stroke colours are earth pigments (slate, terracotta, ochre, sage, moss, verdigris, plum, heather, clay); backgrounds are unchanged.

### Word list credit
`data/familiar-4.txt` is derived from SCOWL / the English Speller Database, whose license asks that this notice appear in copies and supporting documentation:

> Copyright 2000-2026 by Kevin Atkinson
>
> Permission to use, copy, modify, distribute, and sell any part of the English Speller Database (ESDB, previously known as SCOWLv2), or word lists created from it, is hereby granted without fee, provided that the above copyright notice appears in all copies and that both the above copyright notice and this notice appear in supporting documentation. Kevin Atkinson makes no representations about the suitability of this database for any purpose. It is provided "as is" without express or implied warranty.

## Twisting, step panel, squeezed W (2026-10-02)
- **Twisting.** A held chevron, arc or bowl keeps the orientation it's held at (a tray chevron arrives as `<`). Over a cell it locks onto the nearest spot, drawn in place with a faint ring. Bring the cursor right over the spot (within 0.45 units) and it's armed: circling the cursor around the spot then turns the stroke with it, snapping to quarter turns. Straight moves don't turn it, so dragging past a spot is safe. Moving more than 1.6 units away lets it lock onto another spot, and the lock holds past the cell's edge (a V's partner spot for W sits right at the edge). Release drops the stroke only if its current orientation makes a letter; otherwise the letter is red and the label says "↻ circle to turn".
- **Step panel.** Left of the word (above it on narrow screens): this step's dots ("2 of 3 strokes"), a status line, the instructions, and Undo / Reset step.
- **W.** Two full chevrons make W 4 wide; once formed it's drawn squeezed to 2.5 wide (`squeeze` in `LETTERS`, display only; tap areas squeeze to match). A lone V's chevron is never squeezed.

## Motion and feedback (2026-10-03, reviewed against Apple's fluid-interface principles)
- **One held stroke, one continuous life.** A pressed stroke lifts on pointer-down from exactly where it sits (slightly larger, with a shadow), follows the cursor at the point it was grabbed, grows to word size, and glides onto the spot it's locked to. On release it springs into its slot from where it was let go, carrying the cursor's velocity. Removed (tapped) or refused strokes fly back into their tray tile; a move that's dropped anywhere without a spot, including off the word, springs back to its own slot.
- **Springs** (Motion `bounce` + `duration`, Apple's damping ratio + response): things moving on their own are critically damped (`bounce 0`, 0.35 s); the held stroke glides with `bounce 0`, 0.18 s; a released stroke lands with `bounce 0.2`, 0.4 s (the drag carried momentum). Word re-centering is a spring, not a CSS curve.
- **Feedback:** press states on tray tiles and buttons; hovering a placed stroke lifts it (red is reserved for "doesn't fit"); the twist ring turns solid once armed; opening a door glows the word, says "Door opened: WORD (+n)" in the step panel, and grows the new pill into the path.
- **Reduced motion:** with `prefers-reduced-motion`, transform animations are skipped (Motion's `reducedMotion="user"`), the floating stroke jumps instead of gliding or flying, and CSS press/scale transitions are off; colour and opacity changes remain.

## Rotation only when starting a letter (2026-10-03)
- **Twisting only in an empty cell.** Starting a new letter with a chevron, arc or bowl, you can turn it by circling the cursor around its spot (no ring is drawn; the cursor doesn't have to trace anything). Adding to a letter that's already there, the stroke snaps in the orientation its spot needs (a cell with strokes never offers two orientations at one spot), turning smoothly as it snaps; e.g. a second chevron beside a V lands upright to make W.
- **Defaults:** chevrons are picked up as they sit in V, M and Y (`v`); the tray shows them that way. Arcs and bowls keep their tray orientations.
- No ↻ badges on the tray. A stroke on a spot stays on it while the cursor is nearby, even past the cell's edge (W's second spot is at the edge).

## Layout (2026-10-03)
Four regions, each answering one question:
- **Top bar — where am I going?** Title, the goal word, strokes used and the best.
- **Left — what's happening this step?** Step dots, status, Undo / Reset; "How to play" below it.
- **Centre — where do I play?** "You are in" + doors, the word, the tray right under it, and the letter reference as a strip under the tray (it lights up for hovered strokes).
- **Bottom — where have I been?** The path so far, Restart and Show best route.
Wide screens (≥ 760 px) use two columns (left panel 220 px); narrower screens stack top → this step → play area → how to play → path. The word grows to fill the play area (up to 34 px per unit).

## Visual style (2026-10-03, after Hank Green's Smush and 4x3)
Borrowed the style, not the branding: a header graphic, a raised score card (big stroke count, goal, best, doors, and a **?** that toggles How to play, open on load), the word as raised letter tiles on a board card with a soft pastel glow, tray strokes as key-like tiles tinted in their stroke colour, Undo / Reset step as pill buttons with "This step ● ○ ○" centred under the board, and the path in a side card (right of the main column at ≥ 1000 px, below it otherwise). Cards sit on a solid "ledge" shadow; type is the system's rounded face (SF Rounded on Apple). This supersedes the left step panel from the earlier layout pass.

**Header graphic** (`Masthead.tsx`): the ten stroke types sit in a row of tinted part tiles (the same tints as the tray), and the "STROKES" wordmark below is built from them. On load, each stroke leaves its part tile, turns and snaps into its letter one after another, the way players build words. After that the header stays still. With reduced motion, the strokes fade in already in place.

**Goal:** the score card leads with the goal word in ink on a gold-ringed tile (green once reached), with the stroke count, best and doors beside it. The path card ends with the goal as a dashed gold chip, so the route reads start → … → goal.

**Dev tools** (only on the Vite dev server): the side card has **New start & goal**, which picks a random puzzle shaped like WILD → TAME (`randomPuzzle` in `src/maze.ts`). The start has at least 3 doors, and the goal is 4–7 rooms and 10–20 strokes away. **Back to WILD → TAME** returns to the fixed puzzle. A random puzzle lasts until reload. `scripts/mazes.ts` uses the same graph code.

**Name:** the game is called **Strokes** (renamed from Stroke Maze, 2026-10-03). **How to play** opens on a player's first visit only. A `localStorage` flag remembers it was seen, and the **?** button reopens it any time.

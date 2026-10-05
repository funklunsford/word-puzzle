# Segment Smush: game design draft

## Context
The game is a daily word puzzle modeled on Hank Green's *Smush*. In Smush, letter tiles have 5 uses each, a gold center tile is required in every word and never runs out, a "spicy" tile doubles a word's score, and using a tile's last charge (smushing it) also doubles the score. Players hunt for the pangram.

In this version, **the tiles are pen strokes instead of letters**. Players type words normally, and each letter costs a fixed set of stroke tiles from the board. This document settles the game design before we choose a technical architecture. The repo is `~/Code/word-puzzle`, which is currently empty apart from a README.

Decisions so far:
- **Core loop:** the player types a word, and each letter's stroke recipe is deducted from the board.
- **Charges:** per word. A tile loses 1 charge for each word that uses it, no matter how many times the word uses it. Each tile has 5 charges.
- **Design rule:** no tile may appear only alongside another tile. Under per-word charges, such a tile is redundant because it can never be used up on its own.
- **Tile identity (version B):** straight bars keep their orientation. Chevrons and arcs are rotatable shapes.

## 1. Tile inventory (9 types; the short bar merged into the bar on 2026-10-04)
**Rule: every stroke type is used by at least two letters** (enforced in `src/game.test.ts`).
Every letter sits in a box 1 unit wide and 2 units tall.

| Tile | Shape | Letters |
|---|---|---|
| `LV` | Long vertical | B D E F H I K L M N P R T |
| `H`  | Bar (1 unit), flat or upright | A E F H L T Z flat; G and Y upright |
| `LD` | Long `/` | X Z |
| `LB` | Long `\` | N X |
| `SB` | Short `\` (tail) | Q R |
| `BV` | Big chevron, rotates | A (`^`), V, W |
| `SC` | Small chevron, rotates | K (`<`), M and Y (`v`) |
| `C`  | Big arc (half circle, full height), rotates | C D G O Q |
| `P`  | Bowl (half circle with straight ends), rotates | B P R S; J U (turned) |

## 2. Letter recipes (uppercase)
```
A BV H      H LV LV H     O C C       V BV
B LV P P    I LV          P LV P      W BV BV
C C         J LV P        Q C C SB    X LD LB
D LV C      K LV SC       R LV P SB   Y SC H
E LV H H H  L LV H        S P P       Z H H LD
F LV H H    M LV LV SC    T LV H
G C H       N LV LV LB    U LV LV P
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
- **Words.** *(Originally:)* Rooms are the 1,845 four-letter words in `data/familiar-4.txt`: SCOWL size 35 (everyday vocabulary), lowercase entries only (no names or abbreviations), also valid in ENABLE, minus a small blocklist of sexual terms, slurs and swears (`src/wordlist.ts`). With 3 strokes per step, 72% of them form one connected maze (median 4 doors), about as connected as the old ENABLE maze (75%, 6). SCOWL size 50 added almost no connectivity and brought back esoteric words (ABBE, KITH, TYRO), so it isn't used.
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
Borrowed the style, not the branding: a header graphic, a raised score card (big stroke count, goal, best, doors, and a **?** that toggles How to play), the word as raised letter tiles on a board card with a soft pastel glow, tray strokes as key-like tiles tinted in their stroke colour, Undo / Reset step as pill buttons with "This step ● ○ ○" centred under the board, and the path in a side card (right of the main column at ≥ 1000 px, below it otherwise). Cards sit on a solid "ledge" shadow; type is the system's rounded face (SF Rounded on Apple). This supersedes the left step panel from the earlier layout pass.

**Header graphic** (`Masthead.tsx`): the stroke types sit in a row of tinted part tiles (the same tints as the tray), and the "STROKES" wordmark below is built from them. On load, each stroke leaves its part tile, turns and snaps into its letter one after another, the way players build words. After that the header stays still. With reduced motion, the strokes fade in already in place.

**Goal:** the score card leads with the goal word in ink on a gold-ringed tile (green once reached), with the stroke count, best and doors beside it. The path card ends with the goal as a dashed gold chip, so the route reads start → … → goal.

**Dev tools** (only on the Vite dev server): the side card has **New start & goal**, which picks another puzzle from the pool (`randomPuzzle` in `src/maze.ts` made them). The start has at least 3 doors, and the goal is 7–9 strokes away at best (about 8), over at least 3 words (`PUZZLE_SHAPE`). Until 2026-10-05 it was 10–20 strokes over 4–7 words, which playtesters found too hard to start with. **Back to WILD → TAME** returns to the fixed puzzle. A random puzzle lasts until reload. `scripts/mazes.ts` uses the same graph code.

**Name:** the game is called **Strokes** (renamed from Stroke Maze, 2026-10-03). **How to play** opens on a player's first visit only. A `localStorage` flag remembers it was seen, and the **?** button reopens it any time.

## Reachability: one bar, U and J on long bars (2026-10-04)
Playtesting found the short bar rarely useful and G, J, U and Y hard to reach. The cause was the glyphs. The short bar appeared only in those four letters, and U and J were built from a hook (the bowl turned 90°) that no other letter used. **None of the 282 words with U were reachable from the main maze.**

- **One bar.** The short bar and the crossbar were already the same length (1 unit), so they're now one stroke, `H`, which lies flat or stands upright. The tray has 9 strokes.
- **U and J on long bars, with the bowl.** U = two long bars + the bowl turned under them; J = a long bar + the bowl curled under its left side. The long bar is what connects them to everyday letters: a bowl dropped onto "||" snaps into a U (H, N → U are 2 strokes; J → U is 1), and I → J is one bowl. Once formed, the stems are drawn stopping halfway, where the bowl's tails take over, so they look like the original curved U and J.
  - *History:* first built square with the bar along the bottom (H, L → U in 1), then drawn curved by bending that bar into a cup. Playtesting preferred building them with the bowl that's actually drawn, which also makes U discoverable. It costs a little reachability (U 93% → 90%).
- **G as arc + chin.** G = arc + an upright bar at its lower right, drawn **¾ length** from the baseline (a look), so there's air between the chin and the arc's top end. The chin sits on Y's stem spot, so an empty cell offers one upright bar spot (toward G and Y). *(Tried first: a half-length bar inside the mouth, which read like Є; then a full-length chin, which looked heavy. Picked from rendered variants.)*
- **Formed looks** (`Placement.look`) are display-only, like W's squeeze. A look keeps part of a straight stroke from one end (U's and J's stems, G's chin).
  - **When they apply:** only once the letter is formed (`formedLooks`). Offered slots and half-built letters always show plain strokes, and recognition, slots and distances never see looks.
  - **In the editor:** strokes ease between their own centreline and the look's (`inkMorph`, settle spring; instant with reduced motion). Looks are **previewed while you hover**: with a held stroke on a spot that completes a letter, the cell is drawn as if it were dropped. So U's stems draw back to meet the bowl as it glides in, instead of jutting out below it until release. A held stem shows at half height over U's or J's spot, and lands without a jump. Moving away, or lifting the bowl out of a formed U, lets the stems grow back.
  - **Hit areas** follow the drawn shape, so tapping the bowl takes the bowl and tapping a stem's upper half takes that stem.
- **Snap unless there's a real choice.** A rotatable stroke over a spot that fits it only one way snaps to that orientation, following the nearest spot on every move. Examples: the bar upright for Y, K's chevron on its side, the bowl under "||" for U, the bowl curled left of a stem for J.
  - Twisting is only for spots that fit a stroke several ways: in an empty cell, chevron V/A, arc C/D and bowl P/S at the top, and the bowl at the bottom (B/S flat, J/U turned). Under a stem's right side, the bowl can be B's (flat) or U's (turned). That is the one case in a non-empty cell, so twisting is no longer limited to empty cells.
  - Once the cursor is circling such a spot, it stays locked there within 1.6 units.
  - The tray tooltip mentions twisting only for strokes that can need it.

Measured on the familiar-word graph (3 strokes per step):

| | U | G | J | Y | words in the main maze | median doors |
|---|---|---|---|---|---|---|
| before | 0% of 282 | 47% | 66% | 42% | 72% | 4 |
| after | 90% | 86% | 91% | 69% | 89% | 5 |

- WILD → TAME is unchanged (best 14, same route).
- In 8 of 20 random puzzles, the best route passes through a G/J/U/Y word.
- X (26%) and Z (48%) are still weakly connected but rare (19 and 29 words).
- `src/maze.test.ts` guards G/J/U/Y at ≥ 60% and the main maze at ≥ 85%.
- The `/#smush` prototype's boards were regenerated for the 9 strokes.

## Visited words are free (2026-10-04)
- **The path lists each word once.** Walking back into a word you've already visited doesn't add it again. The path card just moves "here" to it.
- **No charge for going back.** A step that lands on a visited word costs 0 strokes, and the status says "Back in WORD: free, you've been here before." How to play says so too.
- **Why it stays fair:** every new word is first reached by a charged step from somewhere already visited, so the charged steps always contain a real route from the start to the goal. The score can never beat `best`, and backing out of a dead end costs only what the dead end cost.

## Bigger word list (2026-10-04)
Playtesters missed words like POSH and PITH. Rooms are now **2,112** words (up from 1,845):
- **Base:** every lowercase 4-letter word up to **SCOWL size 40**.
- **Extra:** **171 hand-reviewed words from size 50** (`data/familiar-extra.txt`): familiar but less everyday, such as KALE, PITH, LYNX, WHEY, YOGI and ZING.
- **Left out:** the rest of size 50 is rare, archaic or technical (ADZE, AGUE, KITH, LIMN, TYRO, WADI, YAWL). SemCor frequency was tried as an automatic filter but is too sparse (ALOE, LYNX and WHEY all score 0), hence the review.
- **Blocklist:** extended for size 40's swears, sexual terms and slurs (FUCK, SHIT, PISS, DICK, TURD, PORN, BOOB, PIMP, FAGS, GYPS, COON, GOOK).
- **Effect:** 90% of words are in the main maze, with a median of 6 words within reach. WILD → TAME's best drops from 14 to **13**: WILD → WILL → WILE → VALE → KALE → TAME.

## Definitions (2026-10-04)
- **Where:** each word's meaning shows **right above it**, under "You are in" (grouping & mapping: it sits next to what it describes). It fades in as each new word is made, as part of the completion feedback. Two lines are reserved so the board never jumps; longer definitions are clipped there. **Tapping a word in Your path** shows its full definition under the path (detail one level deeper).
- **Source:** `public/definitions.json` (136 KB) is built by `scripts/definitions.ts` from **WordNet 3.0** (Princeton; free to use and redistribute with its notice, in `data/WORDNET-LICENSE.txt`).
  - It takes the most-used part of speech and that part's first sense, first clause only.
  - Inflections show their base form, e.g. *went (go)*.
  - Offensive or obscene senses and proper names are skipped: WordNet's first senses of TACO and TOMS are slurs, and HALE is Nathan Hale.
- **Reviewed by hand:** about 200 picks were wrong for a game, e.g. KALE as "money", LYNX as "a text browser", MOLE as a molecular weight, LEST as "ten more than forty". So were 61 words WordNet lacks (THAT, WITH, OOPS…). All of these live in `data/definitions-extra.tsv`, which overrides WordNet; edit it to fix any definition. A test checks that every word has a clean definition.
- **Fallback:** the game plays fine if the file fails to load.

## Modifiers and feature flags (2026-10-04)
Modifiers are prototyped behind **feature flags** (`src/flags.ts`).
- **Setting them:** each flag has a default. The Dev section of the side card toggles it, remembered in the browser, and a link can set it with `?flags=inkPots` or `?flags=-inkPots`.
- **Toggling restarts the puzzle,** so a modifier's state never mixes with another setting's best score.
- Brainstormed but not built yet: an extra charge (one 4-stroke step), a stroke of the day (one stroke type is free), and a clean-step refund.

### Ink pots (`inkPots`, off by default since 2026-10-04; turn on in Dev or with `?flags=inkPots`)
- **The rule:** three words in the puzzle hold an ink pot, shown as chips in the side card (hollow until collected). Reaching one for the first time banks a free stroke. Banked ink pays for strokes on later steps to new words, one stroke per drop (`payStep`). The path shows ink spent as a drop with a count, the score card shows the bank, and it hints when a pot is within reach.
- **Why it's a decision:** going back to a visited word is free, so a pot one stroke off the route is break-even, and anything further away costs strokes. A pot only pays when it sits on a route nearly as cheap as the best one.
- **Placement** (`placePots`) gives each puzzle one pot that saves a stroke (on an equally cheap route, off the best path), one break-even pot, and one that tempts but costs a stroke. If no pot can save a stroke, two break-even pots stand in. WILD → TAME: **TALE** (saves), **TIME** (break-even), **WAIL** (costs); best **12** with pots, 13 without.
- **Best score with pots** (`potRoute`): every new word is first reached by a charged step from a visited one, so the charged steps form a tree. The best is therefore a Steiner tree over the start and any subset of pots, solved exactly with Dreyfus–Wagner, minus one per pot, plus the last leg to the goal. The goal is kept out of the tree, since reaching it ends the game. The tree is walked with pot branches first and returns free, and that walk is replayed through the game's own scoring (`scoreWalk`) in tests. About 10–20 ms per puzzle, so random dev puzzles get pots too.
- **Data:** the fixed puzzle's pots are in `mazes.json` under `inkPots`, placed with a fixed seed. `puzzle.best`/`path` stay the plain answer. "Show best route" shows the route with pots when the flag is on.

### Ink pot graphics and motion (2026-10-04)
- **Graphic:** a squat glass inkwell with a quill (`InkPot.tsx`), deep blue ink and a cream feather in both themes.
  - The side card's pot chips show it full until collected, then its ink drains.
  - A pot within reach gets a solid ink-blue border, and its inkwell **hops once** as it comes in range. Nothing loops (the design skill warns against slow looping motion).
  - Pot words in Your path carry a small drained inkwell.
- **Ink travels where it's used** (`InkFlights.tsx`; spatial consistency, causality).
  - Reaching a pot word sends a drop arcing **up out of the word into the ink bank**. The bank counts it when it lands, with a small spring pop.
  - Ink paying for a step **pours from the bank down into the new word**, and that step's path entry springs in its drop and count.
  - Flights are skipped with reduced motion: the bank just updates.
- **The bank** is a row of drops, one per free stroke banked, with a hollow drop when empty. It names the pots within reach.
- **Wording:** "best" now reads **"lowest strokes possible"** in the score card and the win message, and the reveal button says "Show lowest-stroke route".

## A new puzzle on every load (2026-10-04)
- **What players get:** each page load plays a random puzzle from a pool of **400** in `mazes.json`, pre-generated by `scripts/mazes.ts` (seeded, so the pool is reproducible). Picking from a pool needs no word graph in the browser, which would mean about half a second of work on every load. Ink pots are computed for every puzzle in the pool, so the flag still works.
- **Starts and goals** are everyday base words, so a puzzle never opens on HAST, SOPS or APED:
  - in `data/everyday-4.txt` (also in SCOWL size 35, written by `scripts/familiar.ts`);
  - defined as a noun, verb or adjective;
  - not inflected, not old-fashioned, not a plural.
  The words in between are any in the maze. Examples: BALL → BUNK, ITEM → LEFT, ROOF → FELT.
- **Restart** replays the same puzzle; reloading the page gives a new one. WILD → TAME stays in the data as the reference puzzle: tests use it, and Dev can play it ("Play WILD → TAME"). Dev's "New start & goal" picks another puzzle from the pool.
- **Ink pots** are off by default (see above).

## Deploys and browser caches (2026-10-04)
- **The cache:** GitHub Pages lets browsers cache every file for 10 minutes. The data files (`mazes.json`, `definitions.json`, `boards.json`) keep their names across builds, so new code could meet old cached data. That happened right after the puzzle pool shipped: a stale `mazes.json` had no pool, and the page hung on "Loading…".
- **Versioned data:** the game now requests data with the build's data version (a hash of the files, `src/data.ts` and `vite.config.ts`). As a backstop, a missing pool falls back to WILD → TAME.
- **Previous version kept:** `npm run deploy` keeps the live version's scripts and styles alongside the new ones, so a browser still holding the old page for those 10 minutes doesn't ask for missing files.

## Phones and touch (2026-10-05)
Playtesting on a phone found the layout awkward, strokes too small to place, and twisting impossible: it needs the finger within about 6 px of a spot, then circling it. Phones (under 600 px wide, `.maze.compact`) now get their own layout, touch gets its own handling, and desktop is unchanged (checked box for box at 1280 px).

**Layout** (the `compact` class from `MazeApp`, styles in `styles.css`):
- **Header:** a slim wordmark only. Its strokes fly in from above; the parts row is hidden.
- **Score card:** two rows. The goal tile, the stroke count and **?** sit on top; the lowest possible and words within reach run across the full width below. At 360 px a single row left "13" alone on a line.
- **Board:** starts about 150 px down, instead of 375.
- **Word:** four narrower cells (2.6 units instead of 4; a formed letter is drawn at most 2.2 units wide there, so W, 2.5 units elsewhere, is a little narrower on phones and its pen keeps clear of the cell border) share the row, with slim gaps and padding around them. The editor measures its unit from them with a `ResizeObserver`: about 30.5 px at 375 px wide, against 14 before. A half-built W spills over its neighbours for a moment.
- **Tray:** five tiles a row, about 65 px each at 375 px wide (up to 72), with the strokes drawn larger inside them.

**Touch** (per gesture, `pointerType === 'touch'`, so a mouse or pen on any screen behaves as before):
- **The held stroke** floats about 1.7 units above the fingertip (44–72 px). It and its target spot stay visible, and it glides up there when lifted.
- **Turning:** there's no twisting under a finger. Double-tapping a chevron, arc or bowl in the tray (two taps within 400 ms) turns it, cycling through the ways it goes into letters (the arc starts as C on touch screens). It goes in the way it's turned. Spots that fit a stroke only one way still turn it automatically. Over a spot that needs the other way, it shows red and the cell says "double-tap tray". A single tap gives the stroke a small wiggle, a hint that it turns.
- **Turning a placed stroke:** double-tapping a stroke in the word turns it on its spot, to the next way round that fits there (a chevron V ↔ Λ, a bowl as B's ↔ U's), for a stroke like any move. A stroke alone in its cell (V's chevron) is matched by height only, since an empty cell offers its spots at the cell's centre rather than where the stroke sits in its letter. Only strokes that fit their spot another way wait for a second tap: their single tap removes them after 400 ms, everything else still goes at once. A finger pressing a placed stroke leaves it in place (and in the page, so the tap's release reaches it) until it moves; a phone that cancels the second tap as its own gesture still gets the double tap, and double-tap zoom is off on touch screens (`touch-action: manipulation`; pinch zoom still works). A press on anything else in that moment lets the removal go ahead and is spent (the word just changed); Undo, Reset or a new word drop it. How to play says so on touch screens.
- **Taps:** a tap on a tray stroke doesn't lift it, so turning it doesn't flicker. The tap slop is 10 px instead of 6.
- **Pointer capture:** the editor captures the pointer while you drag, because a pressed placed stroke leaves the page as it lifts and would otherwise lose the touch.
- **Comfort:** hit areas are wider (1.1 units), pills are at least 44 px tall, How to play's × has a 44 px target, and there are no callouts or double-tap zoom.
- **Letter strip:** it lights up for the held stroke.

**Tested** in the browser pane at 375 px with synthetic touch events:
- turning in the tray, then V or A in an empty cell;
- the bowl under a stem as B (flat) or U (turned);
- tap to remove;
- a stroke moved between letters;
- W built by dropping a chevron on a V;
- undo and reset;
- a new word, going back to a visited one free, and a full WILD → TAME win;
- path definitions, help and the route reveal;
- the misfit hint.

No horizontal scroll at 360–430 px. Not yet tried on a real phone.

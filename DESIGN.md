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

**Dev tools** (only on the Vite dev server): the side card has **New start & goal**, which picks another puzzle from the pool (`randomPuzzle` in `src/maze.ts` made them). The start has at least 3 doors, and the goal is 8–10 strokes away at best (9 on average), over at least 3 words (`PUZZLE_SHAPE`). It was 10–20 strokes over 4–7 words until 2026-10-05, which playtesters found too hard to start with, then 7–9 for a day, which with obvious puzzles was too easy (see "Tricky puzzles, fewer hub letters"). **Back to WILD → TAME** returns to the fixed puzzle. A random puzzle lasts until reload. `scripts/mazes.ts` uses the same graph code.

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
- **W's middle peak:** where W's two chevrons meet, their two pen ends left a small dip in the peak. Once W is formed, its left chevron is drawn carrying on 0.12 units past its end and back down into the right one (`Look.over`), so the peak is one pointed turn like W's bottoms. Looks now work on chevrons (kept along the path, corner included) and take the letter's squeeze.
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

## Tricky puzzles, fewer hub letters (2026-10-05, branch `core-loop`)
- **What playtesters noticed:** transitions leaned on the one-stroke letters, C, I and V. Measured on the live pool:
  - **Vowels are locked.** A, E, O and U are 4–6 strokes apart, so no vowel can become another in a step (none of the 565 word pairs like BALL/BELL is one step apart). Every vowel change goes through I.
  - **I is the hub of the stem letters.** It's one stroke from D J K L P T, so L, T, P and D carry 44% of all letter changes. A, E, O and S (35% of letters) get 8%. A H M N S X Y Z have no letter one stroke away.
  - **Most mazes needed them.** In 75% of mazes every shortest route turned a letter into or out of C, I or V, mostly because the start or goal had one in a spot that changes. 28% needed a *stepping stone*: a word on the way with a C, I or V that neither the start nor the goal has there (BALL → BILL → BELL).
- **Options weighed** (simulated on the word graph): a vowel swap (any vowel for 2 strokes), an eraser, re-ink tokens, a 4-stroke step and a two-letter discount. The rules mostly unlock vowels but barely change how many mazes need the hubs, and the vowel swap risked making the game easier and less about shapes. Which puzzles are picked mattered far more, so the pool is rebalanced instead and the rules are unchanged.
- **The new pool** (`POOL_MIX` and `PUZZLE_SHAPE` in `src/maze.ts`, filled by quota in `scripts/mazes.ts`, 420 puzzles):
  - **Par 8–10, evenly** (9 on average, up from 8).
  - **No obvious puzzles** (`isObvious`): the straightforward approach (always take the move leaving the fewest letters different from the goal, then the fewest strokes from it, then the cheapest, trying every equally good move) never makes par. On the old pool it made par 73% of the time.
  - **What each needs from C, I and V** (`classifyNeed`), tagged per puzzle as `need`: 30% need none, 50% change one the start or goal has (the most varied kind), 20% need a stepping stone. "None" mazes can't change a vowel, so they aren't pushed higher. A puzzle's stored route avoids the hubs as far as its kind allows.
- **The difficulty jump** (old pool → new): par 8.0 → 9.0 over 3.1 → 3.5 steps; the straightforward player goes from 1.3 strokes over par on average (at par 73%) to 4.8 over (never at par), and gets lost 3% → 7% of the time. Variety holds: 80% of routes change a vowel, the top ten swaps take 40% of changes (38% before), 541 different start and goal words (571). To soften it, lower `POOL_MIX.tricky` (the share of tricky puzzles) and regenerate.
- **Tests** recompute every puzzle's kind and trickiness, check its route, the 9 average and the mix. WILD → TAME and its ink pots are unchanged. A sparse corner can leave a puzzle with fewer than three pots (26 of 420, 65 of 400 before); the pot test now checks what placement guarantees.

## Swipe to turn, and strokes stay in the row (2026-10-05, branch `core-loop`)
- **The problem:** every other rotation happens by itself (a stroke dropped where it fits one way turns to fit), but a chevron in an empty cell fits as V or Λ, so making a Λ for A meant circling the cursor around the spot. The arc also sat on its side in the tray (∩), a way it never goes in, so it showed red over an empty cell until twisted. (A tray flyout of the other ways round was tried first and dropped.)
- **Swipe to turn (mouse):** circling is gone. On a spot that fits a stroke more than one way, it settles the way it's held (or the nearest way that fits), and once the cursor is on the spot (within 0.6 units) a swipe of half a unit snaps it to whichever way round points most along the swipe: the chevron's point, or the back of an arc or bowl, follows the cursor. Up turns V into Λ, down back to V; right reverses a C; down gives a bowl under a stem U's cup, right B's bowl. The approach from the tray doesn't count, so a V brought up from below stays a V. Every turn is an animated snap; the stroke never shows a way that doesn't fit, so the cell no longer goes red there.
- **Strokes stay in the row:** once a held stroke reaches the letters' row it stays within the row's height, so a swipe up doesn't carry it off; it goes back down only when the pointer is over the tray, to put it back.
- **The tray** shows every stroke a way it goes into letters (the arc as C), as phones already did. Phones keep double-tap to turn.

## Quality of life, hints and a celebration pilot (2026-10-05, branch `qol`)
- **How to play** is a pop-up over the game on a player's first visit (blurred backdrop; Escape, ×, "Let's play" or a click outside closes it; focus goes into it and back to ?). `?help` in the address opens it again, for testing.
- **Tab icon:** `public/favicon.svg`, the wordmark's S drawn by the game's own ink renderer on the dark board colour (`scripts/favicon.ts`).
- **Word filter:** a review of the whole list blocked ORGY, SMUT, LEWD, SLAG, DIKE, NIPS and MUFF (sexual, crude, or a slur in one sense). Everyday words with a slang second meaning stay (KNOB, BUST, RUMP, STUD, TOOL, KINK, LUBE, TEAT, HAGS, WINO, KILL…). The SCOWL downloads aren't kept, so the words were removed from the generated lists directly; the pool was regenerated (WILD → TAME unchanged).
- **Hints** (`src/hints.ts`): the first tap outlines the letter(s) to change next, the second names the next word and what it costs. They follow a cheapest remaining route from the word the step started from, counting returns to visited words as free (as the game does), found by searching outward from the goal only when asked (well under half a second). Hints are free but counted; the win message says how many.
- **Win celebration (pilot, WILD → TAME only)** (`src/celebration/`): drawn live with three.js, loaded only when it plays. Particles sampled from WILD's strokes burst into four roaming whirlpools of hot ink, the swirls unwind as the colours cool, and they settle onto TAME's strokes in the game's own stroke colours as the stormy background calms to the page's; then "Tamed!" with the score. Every particle's path is a function of time in the vertex shader, so any moment can be drawn on its own (`?celebrate=2.2` in development holds 2.2 s; Dev has "Preview celebration"). Tap, click or Escape carries on; reduced motion shows the settled frame; phones get fewer particles and a capped pixel ratio. Each puzzle's colours, words and timing are a theme (`themes.ts`), so a daily puzzle can get its own. three.js is a 187 KB (gzipped) chunk; the main bundle grew about 13 KB.

## Half-built U merges (2026-10-05, branch `qol`)
- **The problem:** a long bar with the cup to its right isn't a letter yet (U needs both bars), so no look applied and the bar ran through the cup's left tail.
- **The rule** (`formedLooks`): a shape that isn't a letter but fits inside exactly one letter, at one alignment, is drawn with that letter's looks. One bar and the cup can only become U, so the bar stops where the cup starts, while the cup hovers and once it's dropped (the bar's tap area is then its top half, as in U). A test goes through every half-built shape of every letter: this is the only one that gains a look ("‖", a lone cup and G's lone chin stay as they are, since several letters fit them). Display only.

## Double-tap on a phone never removes two strokes (2026-10-05, branch `qol`)
- **The bug** (from the mobile playtest): a tap removed a stroke at once unless it could turn on its spot, so a double tap on, say, R's bowl removed the bowl and then whatever stroke sat under the second tap (two strokes spent).
- **Now, on a touch screen, every tap on a placed stroke waits 400 ms** (the stroke dims; it stays tappable) before removing it. A second tap on it in that time turns it on its spot where it fits the other way round, or wiggles it where it doesn't, and removes nothing. This supersedes "only strokes that fit their spot another way wait" above.
- **A press on anything else in that moment** lets the removal go ahead and then carries on normally (it used to be spent): edits are made against the latest cells (a ref kept up to date as edits are applied; `onEdit` reports whether the game took the edit), and a pressed stroke is found again by its key. Three quick taps on three strokes remove all three.
- **The mouse is unchanged:** a click removes at once.
- **Not done** (from the same playtest): turn badges (rejected before), the small chevron turning (it never needs to), hit areas picked by draw order where strokes meet.

## The celebration, second pass: flora (2026-10-05, branch `qol`)
- **Direction:** organic, with vines, ferns and flowers that are tamed (replacing the first pass's ink particles, which are in the history).
- **The scene** (`src/celebration/flora.ts`, colours in `themes.ts`):
  - **Holding:** WILD is drawn in vines, its strokes split into 44 pieces (30 on phones), with tiny buds.
  - **Wild:** each piece peels off into a tendril that bends, coils at the tip and sways, or a fern whose tip unrolls, with big leaves and bright flowers bursting open at the tips, on a dark jungle green.
  - **Taming:** the wild growth is gathered onto TAME's nearest strokes as it shrinks away, while the background calms to the page's own.
  - **Tamed:** one neat vine grows along each stroke of TAME (stroke by stroke, about the game's stroke weight, tapering only at real ends), with leaves unfolding at even spacing, fern fronds on the bars, and at last a small flower at each stroke's tip in the game's colour for that stroke; then a gentle breeze.
- **Drawing:** a ribbon mesh for the stems and instanced leaves, petals and flower centres, all recomputed from the time each frame (walking along each stem, never from the last frame), so any moment can be held (`?celebrate=2.9`). Phones fit the words to 88% of the width.

## Strokes this step (2026-10-05, branch `qol`)
- The three step dots stay under Undo / Reset step / Hint, labelled "Strokes this step", now as 16 px rings that fill white (the text colour, so dark in light mode) as strokes are used, with a small pop, and all turn red once the step is out of strokes. (Tried at the top right of the board, then in the score card, before settling back here.)
- The step line no longer says "Change the word into another real word." when there's nothing new: it's hidden until a stroke is used, a word is made or a hint is shown. The definition text under the word is a little larger (16 px, 15 px on phones).

## WILD → TAME ships; the pool goes behind a flag (2026-10-05)
- **Every load plays WILD → TAME** (best 13), the puzzle with the celebration. The random pool (420 tricky puzzles averaging 9) stays in `mazes.json` behind the `freshPuzzle` flag ("New puzzle each load", off): `?flags=freshPuzzle` turns it on for a visit, and Dev can toggle it (it switches puzzle at once).

## How to play, for touch and for mouse (2026-10-05)
- How to play shows one of two lists, picked by whether the device's main pointer is a finger (`(pointer: coarse)`: phones and tablets) or a mouse, since the controls differ: tap vs click to remove, double-tap vs a swipe while placing to turn, tap vs click Hint.
- Player-facing text calls every stroke just a stroke (no chevrons, arcs or bowls): How to play, and the tray tooltips ("Drag into a letter · double-tap to turn" / "· swipe as you place it to turn"). Screen readers still get each stroke's name, the only description they have.

## M built like H (2026-10-06, branch `oct-6`)
- **The problem** (playtest): M's bars sat two units apart, so after a first bar the second had to go in a third spot to the right; put a unit away (as for H) it could never become M.
- **Now M is two bars a unit apart with the small chevron on top**: "‖" can become H, M, N or U, and the chevron snaps on to make M. No letter has bars two apart any more, so that third spot is gone. M is drawn as it always was (bars two apart, the chevron's ends on their tops) by a display-only `spread` of 2 (positions only; `squeeze`, as in W, narrows positions and strokes). While the chevron hovers, the bars already part, so nothing jumps on the drop.
- **Rules:** M is now 2 strokes from H, N, U, K and I. The maze gained 4 connected words (1,984); WILD → TAME is unchanged (13, the same route and ink pots), and the pool was regenerated with the same mix.

## Picking the stroke under a finger or cursor (2026-10-06, branch `oct-6`)
- **The problem** (playtest): each placed stroke had its own wide tap area, and where they overlapped the one drawn last won. T's top bar was nearly impossible to take on a phone (its stem's area covered it), and a tap on N's right bar took the diagonal.
- **Now a press or hover anywhere on a letter takes the stroke whose drawn line is nearest** (as drawn: looks, squeeze, spread), and where two are within 0.06 units (a junction) the shorter one, so T's bar wins where it meets the stem. Tested with phone taps: along T's bar and at the junction take the bar, the stem takes the stem; N's right bar takes the bar.
- **Hover (mouse only):** the stroke a click would remove turns pale red (`--remove`, per theme; full red stays "doesn't fit") and lifts slightly. Never while dragging or when the step is locked.
- **Tray hover (mouse only, `(hover: hover) and (pointer: fine)`):** a tray stroke under the mouse invites a grab: its tile rises 2 px on a deeper ledge and brightens, and the stroke grows 10%; pressed, the tile sinks onto its ledge with a grabbing cursor. Not for taken tiles or a locked step; no movement with reduced motion.

## How to play, clearer (2026-10-06, branch `oct-6`)
- **Bigger and brighter:** the pop-up's text is now the full text colour at 16 px (15 on phones), the lead 17 px, the title 23 px.
- **Shorter, and about this puzzle:** "Turn **WILD** into **TAME**, one real word at a time, in as few strokes as you can.", then: change up to 3 strokes a step to make another real word; drag strokes in, tap/click one to remove it or drag it to move it; double-tap to turn (touch) or swipe as you place it, swiping up flips a V (mouse); going back is free; stuck? Hint.
- **A tiny demo** (`HowToDemo`): a looping drawing of a bar carried from a tray tile into an I, which becomes L, by a fingertip on touch screens (the stroke riding above it) or a cursor. Reduced motion shows the L. It fits a 360×640 screen without scrolling.

## The daily puzzle (2026-10-06, branch `oct-6`)
- **One puzzle a day, the same for everyone on that date in their own time zone.** Each day is two files in `src/daily/days/`: `{DATE}.json`, the puzzle (start, goal, best, route, ink pots, and its need and tricky labels), and `{DATE}.ts`, its own win celebration. Both load only when needed. The game plays the player's local date, else the latest day before it, else the first; `?day=YYYY-MM-DD` replays an earlier day (any day in development). The masthead shows "No. N · Tuesday, October 6", numbered from the first daily (2026-10-06, No. 1).
- **WILD → TAME is No. 1,** and the flora scene moved in as its celebration, with identical frames. The pool stays behind the `freshPuzzle` flag; off now means today's daily.
- **Choosing the next one** (`npm run daily`): candidates come from the pool, so each is tricky with everyday endpoints. The script cycles through it:
  - never a pair already used, either way round;
  - no start or goal word from the last 30 days;
  - lowest strokes by weekday: Monday and Tuesday 8, Wednesday and Thursday 9, Friday and Saturday 10, Sunday 9;
  - the kind of route (none, letter or stone) the last week has had least of, against the pool's mix.

  The same date and history always give the same ten. `npm run daily -- DATE START GOAL` checks one in and prints the fields the celebration prompt needs. The history is the day files themselves.
- **Making it:** `/daily` in Claude Code follows `docs/daily-celebration-prompt.md`: choose the pair with the clearest picture of change, write three concepts and pick one, build the scene to the contract, check it with the tests and stills, log the concept in `src/daily/LOG.md`, and open a pull request. Merging it deploys.
- **The scene contract** (`src/celebration/scene.ts`): a scene is a pure function of time, starts on the start word, ends on the goal word's strokes and holds still, keeps to 6 meshes, 20,000 vertices and 5,000 instances (about 40% less on a phone), and is self-contained. `src/celebration/scenes.test.ts` checks each of these for every day's scene. It fails on a scene that uses `Math.random` in `update` and on one that never finishes the goal word, both tried. `src/daily/daily.test.ts` re-solves every daily against the current word list, so a word-list change that alters a day's best fails the tests.

## The Perfect encore (2026-10-06, branch `oct-6`)
- **A solve in the lowest possible strokes** (with ink pots, the best with them) earns an encore after the day's celebration, or on its own for a pool puzzle.
- **What it shows:** the stage dims to deep violet in both themes, so gold and sparkles shine in light mode too. The goal word turns gold, its strokes scatter into a swirl, and they come together as PERFECT, with a band of shine sweeping across, a burst of sparkles and glints at the tops of strokes.
- **Then the languages:** every 2.4 s the strokes re-form, stroke by stroke, into "perfect" in another language. Each stroke flies to the same kind of stroke in the next word, extras arrive and leave, and the language's name shows under the word. The languages are French PARFAIT, Spanish PERFECTO, Italian PERFETTO, German PERFEKT, Portuguese PERFEITO, Indonesian SEMPURNA, Swahili KAMILI, Tagalog PERPEKTO and Irish FOIRFE: only those whose own spelling is plain A–Z, never with accents stripped.
- **Framing:** fitted once to the widest word (SEMPURNA), so it never zooms between languages; the zoom from the goal word happens while the strokes are in the air.
- **Taps:** during the day's scene a tap skips to the encore; then a tap carries on. Reduced motion shows the day's last frame, then (tap) PERFECT, still.
- **Development:** `?perfect` previews it after the day's scene, and `?perfect=1.6` holds it 1.6 s in. Dev has "Preview Perfect".

## Deploying on every merge (2026-10-06, branch `oct-6`)
- **Every push to `main` deploys.** `.github/workflows/deploy.yml` runs the tests, builds, and publishes with `scripts/deploy.sh` to the `funklunsford/strokes` Pages site. Pull requests are tested and built, not published.
- **Credentials:** the workflow pushes with an SSH deploy key that can write to `funklunsford/strokes`, kept as the `STROKES_DEPLOY_KEY` secret. `scripts/setup-deploy-key.sh` creates both, run once by the owner. Until it's set, runs on main pass with a warning instead of publishing. The site repo stays separate, so the source repo can go private without changing the site's address.

## Practice in How to play, a redder hover, GitHub Pages only (2026-10-06, branch `misc`)
- **How to play now has a "Try it" practice in place of the looping demo:** the game's own editor with one letter cell and a three-stroke tray (long bar, bar, chevron). There are four moves, each making a letter:
  - **add:** a bar onto I makes T;
  - **move:** that bar down to the foot makes L;
  - **turn:** V turned over, then a bar across it, makes A (double-tap on a touch screen; with a mouse, drag it up a little);
  - **remove:** E's bottom bar makes F.

  A ghost shows each move over the practice letter: a fingertip on touch screens (the stroke riding above it, as in play) or a cursor. It loops until the player touches the practice, and comes back after 2.5 s left alone. Each made letter glows and ticks a dot, and the next step follows. A wrong turn says "Not quite" with "Start over". With reduced motion the ghost is a still, faint stroke where the move puts it.
- **The rules are tested** (`src/tutorial.ts`, `src/tutorial.test.ts`): doing each step's shown move reaches its letter under the game's rules. The two gesture bullets are now one line, since the practice teaches them.
- **Turning a placed stroke with a mouse:** a stroke lifted from a spot that fits it more than one way (a lone V) is now armed there at once, so a swipe from wherever it was pressed turns it. Before, the cursor had to come within 0.6 units of the spot's centre first, which a press on a V's arm often wasn't.
- **The phone layout's editor rules** (`.maze.compact …`) now reach only the board's editor, so the practice keeps its size on phones. It fits a 375×812 screen without scrolling.
- **Hover red:** the stroke a click would remove is now clearly red, `--remove` #e5484d light and #ff6b6b dark (was a pale #e8907f / #f2a49a). "Doesn't fit" keeps the orange-red `--spicy`.
- **GitHub Pages only:** the repo no longer mentions Netlify (the `.netlify/` ignore and the local CLI folder are gone). The site is served only from https://funklunsford.github.io/strokes/.

## A half-built M sits right (2026-10-06, branch `tweaks`)
- **The bug** (playtest screenshot): a long bar with the small chevron on top (M missing its second bar) drew the chevron overhanging the bar by half a unit. Since M became two bars a unit apart, its strokes are only spread to their drawn width once the letter is complete, and this shape wasn't yet.
- **Now a shape that can only become one letter is drawn as that letter is** (`onlyFit` in `src/strokes.ts`, already the rule for a half-built U's look). A bar with the chevron on top can only become M, so it gets M's spread, and the chevron's end sits on the bar. "‖" could still be H, M, N or U, so it's drawn as it is.
- **The same layout is used everywhere a stroke's position matters** (`across` in `WordEditor`): drawing, picking the stroke under a finger or cursor, where a held stroke sits on its spot, and where a dropped one springs in from. Nothing jumps when M's second bar or its chevron lands.

## Intro and goal tweaks (2026-10-06, branch `tweaks`)
- **No "One step away" under the goal.** The game no longer says when the goal is within one step.
- **How to play's lead is general:** "Turn one word into another, in as few strokes as you can." It no longer names the day's words.
- **The practice turns a C too:** after V → A comes C → D: turn the C around (double-tap; with a mouse, drag it a little to the right), then add a long bar on its left. That makes five moves, and the practice tray gains the arc. The mouse ghost swipes the way the turned stroke will point: up for a V, right for a C. It still fits a 375×812 phone without scrolling.

## Lowest strokes the editor can actually make (2026-10-06, branch `stroke-cost`)
- **The bug** (playtest): WILD → TAME's lowest-stroke route went KALE → TAME in 3, which can't be done. Counting a stroke moved between letters as one, the two words differ by 3: K's chevron to the L (for M), L's foot bar to the K (for T), and a long bar. But the editor only takes a stroke where a letter's strokes stay part of a real letter, so each of those is blocked until another has gone. The fewest the editor allows is 4, over a step's 3.
- **Now a step costs what the editor needs** (`wordDistance` in `src/strokes.ts`). The game searches stroke orders one action at a time: add from the tray, remove, or move to another letter or another spot (turning it). Every letter in between must be part of a real letter. The old count (now `strokeDiff`) is a lower bound that cuts the search short. A finger can't turn a stroke it's carrying, so a move only lands turned if the spot fits it one way, or if it's turned where it sits. Steps that a finger can only make one way round count what both ways need. Results are cached by the letters that change, and the whole graph builds in about a second.
- **Effect:**
  - of 7,127 steps, 296 (4%) turn out impossible and are gone, and 58 cost more;
  - in the old pool, 39 of 420 puzzles had a wrong lowest count and 2 couldn't be solved;
  - the pool was rebuilt with the same mix (420 tricky puzzles averaging 9);
  - WILD → TAME is still 13, by WILD → WILL → WILE → VALE → TALE → TAME;
  - its ink pots are now WILT, TILE and KALE.
- The obvious-approach check still judges distance to the goal by `strokeDiff`, as a player would estimate it.

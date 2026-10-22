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
- **Now a step costs what the editor needs** (`wordDistance` in `src/strokes.ts`). The game searches stroke orders one action at a time: add from the tray, remove, or move to another letter or another spot (turning it). Every letter in between must be part of a real letter. The old count (now `strokeDiff`) is a lower bound that cuts the search short. A move may land turned, since a mouse or a finger can turn a carried stroke (see below). Results are cached by the letters that change, and the whole graph builds in about a second.
- **Effect:**
  - of 7,127 steps, 282 (4%) turn out impossible and are gone, and 56 cost more;
  - in the old pool, 39 of 420 puzzles had a wrong lowest count and 2 couldn't be solved;
  - the pool was rebuilt with the same mix (420 tricky puzzles averaging 9);
  - WILD → TAME is still 13, by WILD → WILL → WILE → VALE → TALE → TAME;
  - its ink pots are now WILT, TILE and KALE.
- The obvious-approach check still judges distance to the goal by `strokeDiff`, as a player would estimate it.

- **Phones turn a carried stroke too:** on a spot that fits a stroke more than one way, a finger's swipe turns it, as a mouse's does (up flips a V into Λ). A finger's swipe must be a bit longer (0.8 units, a mouse's is 0.5), so a wobble doesn't flip it; a wobbly straight drop stays as it was. A finger used to keep a carried stroke the way it was picked up, so moves that needed a turn on the way (W's chevron to an empty letter as Λ) took a phone an extra stroke. 14 steps that only a mouse could make are now open to phones as well. Double-tapping still turns a stroke in the tray or where it sits.
- **Double-click turns too, so mouse and touch match:** double-clicking a stroke turns it in the tray, or where it sits if it fits the other way round there (otherwise it wiggles), just as a double tap does. So a click on a placed stroke now waits a moment, dimmed, before removing it, as a tap does. A pressed stroke lifts out only once the pointer moves. Swiping as you place still turns a carried stroke. The tooltips, How to play and the practice say "double-click", and the practice's ghost double-clicks.

## Daily No. 1 is PINK → DUNE (2026-10-06, branch `daily/2026-10-06`)
- At the owner's request, today's puzzle was regenerated with `/daily` and replaced WILD → TAME. WILD → TAME is still the reference puzzle in `public/mazes.json`, and its vine scene is in git history.
- **PINK → DUNE** is lowest 8 (PINK → PINT → PINE → DUNE). It was the clearest picture of change among the ten candidates.
- **The celebration, "Windswept!":** PINK in pink sand is stripped left to right by the wind into a swirling cloud of grains with streaks of wind, turning sand-coloured as it flies. The grains settle stroke by stroke into DUNE, ochre grains with a few pink flecks over two-tone ridges.

## Confetti for Perfect, puzzles at 10, hardcore, a shorter phone swipe (2026-10-06, branch `core-and-perfect`)
- **Perfect is confetti and sparkles, before the day's scene** (`src/celebration/confetti.ts`). This replaces the gold PERFECT in ten languages.
  - Confetti fires from both bottom corners, tumbling and drifting down, with sparkles twinkling over it. It sits over the start word, drawn as the scene's first frame.
  - The day's scene starts at 1.7 s, as the confetti falls away, and the confetti has gone by 3.2 s.
  - It's drawn over the whole screen, in its own layer, and narrow screens fire it less far across.
  - A tap during the confetti skips to the scene; then a tap carries on. Reduced motion shows the scene's finished frame.
  - A pool puzzle (no scene) gets the confetti on a dark stage, titled "Perfect!".
  - `?perfect` previews it, and `?perfect=1.0` holds it at 1 s.
- **Puzzles average 10 strokes:** `PUZZLE_SHAPE.best` is now 9–11, picked evenly, over 3–8 words. The pool was rebuilt with the same mix (420 tricky puzzles averaging 10.00). The daily rhythm moves up one: Monday and Tuesday 9, Wednesday, Thursday and Sunday 10, Friday and Saturday 11.
- **Hardcore** (the flame button, remembered in this browser): only words on a lowest-stroke route open, and only when reached on par.
  - The flame sits in the top-right corner of the word box (the definition and win banner keep clear of it). Unlit, it's an outline; lit, it burns white and gold on the spicy colour, with a little ignite pop. It's kept away from Undo, Reset step and Hint, which are tapped mid-step, because turning it on starts the puzzle over.
  - Switching it says what it does in the step line ("Hardcore on: only words on a lowest-stroke route open. Started over."), a "HARDCORE" label sits by the lowest-strokes line, and How to play mentions the flame.
  - Each puzzle stores those words with their strokes from the start (`routeWords` in `src/maze.ts`; `onRoute` in the pool and the daily files, checked by the daily tests). A word opens only if its strokes from the start equal the player's strokes so far plus this step's.
  - Anything else is turned away: the stroke goes back where it came from, and the step line says "Hardcore: LINK isn't on a lowest-stroke route." Going back to a visited word counts as off the route.
  - Turning hardcore on starts the puzzle over.
- **The phone swipe to turn is shorter:** half a unit, the same as a mouse (was 0.8, about 24 px; now about 15 px). To keep a stroke carried onto its spot from counting as a swipe, swipes now count from where the pointer stopped coming in (its closest point to the spot), not from where it first came near. Checked with a finger: carried straight onto its spot with a wobble, a V stays a V; carry on 17 px further, and it turns to Λ.

## Fixes from the second phone playtest (2026-10-06, branch `core-and-perfect`)
- **Swipe to turn** flipped after 6–8 px, not about 15. A swipe counted from the stroke's closest approach to its spot, so an overshoot then a nudge turned it.
  - Now a pause restarts the swipe where the pointer rested, and a pointer slower than 1.5 letter units a second (creeping or lining up) carries the swipe's start along with it.
  - Checked: carried straight on, a V stays a V; a quick 12 px swipe stays a V; a quick 18 px swipe turns; overshoot, rest, then 12 px stays a V; a slow 30 px creep never turns; mouse swipes still turn.
- **Hardcore:**
  - Going back to a visited word is free here too, as How to play says (every visited word is on the route).
  - The refusal reads "Hardcore: RINK is off the lowest-stroke route."
  - The latest action wins the step line, so a hint clears a refusal or notice.
  - With progress on the board, the flame asks first ("Hardcore starts over. Tap the flame again to go.", glowing); a second tap within 5 s starts over.
  - The HARDCORE label sits by the stroke count; notices fit on one line; "within reach" counts only words that would open ("1 route word within reach").
- **Tapping to remove:** a stroke that can't turn where it sits goes at once. Only turnable strokes wait the 0.4 s for a second tap. A quick second tap where one just went is ignored, so a double tap still removes one stroke.
- **After a win:** the result replaces Undo, Reset step and Hint ("DUNE in 8 strokes · lowest possible 8 · perfect ⭐"), with Share and Watch again, and "A new puzzle comes at midnight." The banner no longer pushes the board down.
  - A daily's best result is kept in this browser (`strokes:result:{DATE}`), and a return visit says "Solved today in 8 · perfect ⭐. Play it again any time."
  - Share uses the phone's share sheet, else copies a spoiler-free line: the puzzle, strokes and par, a star for perfect, and dots for the strokes in each step. If there's no clipboard either, the line appears under the buttons, to copy by hand.
- **Hints are instant:** the maze's graph ships in `mazes.json` (each word's doors and costs), so hints and "within reach" look them up. A first hint takes about 5 ms (was 0.6–1 s on desktop since the exact step cost). `mazes.json` is 58 KB compressed (+28 KB).
- **Smaller fixes:**
  - a stroke let go over a letter it doesn't fit says so ("That stroke doesn't fit in that letter.", or that it fits turned the other way);
  - a shape that isn't a letter is labelled "no letter" (was "·");
  - path pills take taps over the whole pill and half the gap round it (a little taller, 8 px apart, never a neighbour's area); ?, the flame and the practice's Start over take 44 px taps without looking bigger, and practice tray tiles are 54 px;
  - the Hint button keeps one width (Hint, Next word, Hint used);
  - the step line is announced to screen readers;
  - the celebration line keeps "· 3 hints" together;
  - a short screen (a phone on its side) gets the slim wordmark, so the score card starts at about 105 px, not 245;
  - a puzzle swap can no longer look like a win (the path must start at this puzzle's start).
- **No hints in hardcore** (the owner's call): the Hint button gives way to a "No hints" note in the same space, switching hardcore on clears any hint shown, and How to play and the notice say so. Playtest reports stay local (`reports/` is in .gitignore).
- **Left open, for decisions:**
  - the tray wrapping onto two rows on phones;
  - a full landscape layout;
  - the shortest phones (375×667), where the controls fall below the fold.

## Sharing, settings, and centring by eye (2026-10-06, branch `share-and-settings`)
- **A result card to share** (`src/share.ts`, `ShareSheet.tsx`), Wordle's grid in this game's terms. Share (after a win, or "share it" on the "Solved today" line) opens a sheet with:
  - **the picture** (1080×1350, a portrait post, always on paper): the wordmark, the day's number and date, the score with ★ PERFECT and 🔥 HARDCORE badges, then the solve as a ladder: the start word in ink, a row of squares per step under the letters it changed, the goal word in ink, each step's strokes beside its row, and the link;
  - **the text to paste:** "Strokes No. 1 🔥", "PINK → DUNE · 9 strokes (lowest 8) · 1 hint", a row of squares per step (⬜ kept, 🟨 1 stroke, 🟧 2, 🟥 3) with its strokes, and the link. No word from the route appears; the start and goal are the day's puzzle, not a spoiler.
  - **Share** hands the phone's share sheet the picture and the text together (where it takes files; the text alone otherwise), **Copy text**, and **Save image**. The picture is drawn as the sheet opens, so Share needs no waiting (iPhones refuse a share that waits). With no clipboard, the text box is outlined to copy by hand.
  - A stroke moved from one letter to another colours both squares, so a row can add up to more than the number beside it, which is the step's true cost.
  - Each step now records the word it left (going back is free, so it isn't always the word before it). Results kept before this have no grid and share without one.
- **Link previews:** Open Graph and Twitter tags in `index.html`, with `public/og.png` (1200×630, drawn by `drawPreviewCard` in headless Chrome against the dev server).
- **Settings** (the gear, top right of the header): Appearance is System, Light or Dark (`strokes:theme`). The page's dark colours moved from the media query to `:root[data-theme='dark']`, set before the first paint by a script in `index.html`; System follows the device as it changes.
- **More settings** (`src/prefs.ts`, kept as `strokes:prefs`):
  - **Motion:** System, Less or Full. Less snaps strokes instead of springing them and shows a win's finished picture; Full plays everything even when the device asks for less. The editor, practice, ink and celebration ask `useReduceMotion()` (the setting, else the device), Motion's own animations follow `<MotionConfig>`, and the CSS follows `<html data-motion>`, which `index.html` sets before the first paint, like the theme.
  - **Swipe to turn** (on by default): off, a swipe over a spot no longer turns the stroke; it settles the way it's held, and a double-tap or double-click turns it, in the tray or in a letter. How to play's practice and its text follow it.
  - **Letter guide** and **Definitions** (both on by default) hide the A to Z under the word and the meaning above it. Tapping a word in Your path still looks it up.
  - **Colour-blind squares** (off by default): the shared squares are yellow, blue and red (⬜🟨🟦🟥) instead of yellow, orange and red, so no step's colour depends on telling orange from red. The card's squares follow.
  - Checked at 375×812: the panel fits without scrolling; a tap anywhere on a row flips its switch once; with swipe off a 24 px swipe leaves a V a V and a double-click turns it; with swipe on an 18 px swipe turns it (in Less motion too).
- **Tray strokes are centred by eye** (`opticalOffset` in `ink.ts`): halfway between the drawn outline's middle and the centre line's balance point. The C sat 2 px left of its tile's centre on phones; it's now 0.7 px right, which looks centred because its weight is on the left. The bowl got the mirror fix. The practice in How to play uses the same offsets.
- **Swiping a placed V on a phone** keeps it in its letter while the finger swipes (it no longer jumps up above the finger); dragged away, it lifts above the finger as before.

## Share the card, a tray preview, Perfect confetti from the board (2026-10-06, branch `share-card`)
- **Sharing is the picture card and the link, nothing to paste** (the owner's call). Share hands the phone's share sheet the card and the link (the link alone where a phone can't take a picture); Copy image (where the browser can put a picture on the clipboard) and Save image are there for anywhere else, and the link is printed on the card. The emoji grid and its text are gone; Colour-blind squares now colours the card's squares.
- **The link preview** (`og.png`) keeps its wordmark and lines, with the game's tray of strokes under them in place of the coloured squares, drawn as the tray draws them (`TRAY_TURN` and `ORIENTS` moved to `glyphs.ts` for this).
- **Perfect pops confetti out of the word on the board** (`confetti.ts`; the owner's call: from the word's own cells, more pop, 2.5D). As the celebration starts it asks the board for points along the strokes drawn in its word cells (`inkSources`, the `.word-cells` ink, kept to what's in view), with their colours. On a clear canvas over the page, a gold ring bursts out round the word and the confetti pops out of its strokes, mostly upwards, in the strokes' colours (brightened) with some gold, pink, white and blue: 70% at once, the rest a moment after. Each piece is paper turning in 3D about its own axis: it narrows edge-on, is lit brightest face-on with a darker back, and glints as it turns through the light; nearer pieces are bigger and faster, and drawn over farther ones. It springs to size as it appears, slows in the air, and flutters down. Pieces are held softly inside the screen's sides, and are bigger on wider screens. The stage (the day's scene, on its own canvas) fades in over the board from 1.25 s to 1.7 s. A puzzle with no day's scene gets the goal word, still, on the page's colour (`plain.ts`).

## Tricky by measure, pockets, and linking words (2026-10-06, branch `difficulty`)
- **Why:** a look at the old pool showed the tricky label was fragile and par was a weak difficulty knob.
  - 45% of the pool (all labelled tricky) made par for a player taking the door that looks cheapest to the goal: `isObvious` only defeated one rule of thumb (fewest wrong letters).
  - Par barely predicted how hard a puzzle plays: its rank correlation with a simulated player's strokes over par was 0.17. Traps (0.33) and how far ahead you must plan (0.31) did better. TAIL → TOTE, par 9, was among the very hardest.
- **What makes a puzzle tricky** (`src/difficulty.ts`). A door "looks" like its cost plus the strokes difference to the goal (a player's estimate by eye); what it really costs comes from the true distances to the goal.
  - **Traps:** doors from a word on a lowest-stroke route that look at least as good as the right step but lead off every lowest route; what each loses, and whether it leads into a pocket.
  - **Pockets** (`findPockets`): the maze's core is its largest biconnected block; every other word of the main maze sits in a pocket, which can only be left through the word it was entered by. A pocket trap costs a player every stroke spent exploring it.
  - **Depth** (`planningDepth`): how many steps ahead a player must look (judging the rest by eye) to make par: 1, 2, 3, or more.
  - **Strategies:** tricky means no rule of thumb makes par: neither fewest wrong letters (`isObvious`) nor fewest strokes left (depth 1).
  - **Par chance** (`parChance`): how often a simulated player makes par in 400 games. They pick unused doors at random, leaning towards those that look closer (each point worse is e times less likely), and go back for free from dead ends. Seeded by the puzzle, so a puzzle always scores the same. It knows every door, unlike a real player, so it ranks puzzles rather than predicting real results.
- **No one-way steps:** every step the editor allows between maze words costs the same both ways (`oneWayCost`; a test checks all 2,121 words), so a player can never be stranded: a pocket wastes strokes, never the game.
- **Linking words** (`data/familiar-links.txt`, read by `scripts/familiar.ts`): 28 words that join cut-off words to the maze, mostly as pockets (definitions in `data/definitions-extra.tsv`).
  - 21 familiar: AXEL, COCO, DOJO, FILO, GHEE, GOGO, KENO, LIMA, LOCI, LUGE, LULU, LUNA, LUTZ, MAKO, MOJO, PHEW, PRIG, TREY, TZAR, WONK, YECH.
  - 7 less common, picked by the owner's rule (at least 3 more words in pockets, a meaning I'm sure of, not informal or slang): ARIL, DEVA, OLIO, PHON, PIMA, TAIN, VELD. Added one at a time, keeping only those still worth 3: THIO and INTI reach the same cut-off group as OLIO (they'd close a loop and remove the pocket), and JURA the same as PIMA. OPED is left out: in ENABLE it's most likely the past of "ope" (to open), not op-ed.
  - 52 everyday words become playable for the first time: ALTO, ARCH, AREA, ARIA, AUTO, AXLE, BEVY, CHEW, CZAR, DEMO, DEWY, DODO, DRUG, FIZZ, FUTZ, FUZZ, HUGE, INFO, INTO, JUDO, KETO, KILO, LAMA, LEVY, LOCO, LOGO, LUAU, MAMA, MAYO, MEMO, MONO, NEON, ONTO, PEON, PREY, PUMA, PUPA, THEE, THOU, TUBA, TUNA, TUTU, TWIG, TWIN, TWIT, UNDO, UNTO, VETO, VIEW, WHEW, WONT, YEAH.
  - The main maze grows from 1,900 to 1,980 words (93%), and pockets from 136 (236 words) to 151 (303).
  - Bulk additions would do the opposite: all of ENABLE would cut today's pocket words from 236 to 96, as new words close loops. The rest of the candidates are in a review list (`reports/word-candidates.md`, local), with MANA (which would make MANY playable), LIDO and BOLO at the top as borderline familiar.
  - PINK → DUNE (today's daily) and WILD → TAME keep their par and route words. (One unused puzzle of the old pool, VAIN → EVIL, would have changed; the pool is rebuilt.)
- **The new pool** (`scripts/mazes.ts`): every puzzle is tricky by both rules and has a pocket beside a lowest route.
  - Requiring a trap into a pocket would starve the pool: only 0.4% of candidates qualified, from 21 different start and goal words in 3,000. So pocket traps are kept and flagged instead.
  - 420 puzzles from 25,007 candidates (about 4 minutes), best 10.00 on average, the same mix of needs. Par chance median 3% (0–32%; the old pool's was 4%, up to 40%); planning depth 2 for 318, 3 for 84, more for 18; 28 with a trap into a pocket; 479 different start and goal words (541 before).
  - Each puzzle keeps its difficulty: depth, pockets beside, its worst three traps, whether one leads into a pocket, and its par chance (`mazes.json` grows by 10 KB compressed).
- **The daily rhythm is by difficulty** (`scripts/daily.ts`): the pool in thirds by par chance (ties: the deeper plan, then more traps). Monday and Tuesday pick from the easiest third (made at par 5–32% of the time); Wednesday, Thursday and Sunday the middle (2–5%); Friday and Saturday the hardest (0–2%). Each candidate says what makes it tricky, and the runbook prefers a pocket trap between equally good pictures. Best stays 9–11.
- **Tests:** pockets on hand-made mazes and on the real one (each pocket has one way in); the pool is all tricky with a pocket beside its route, and keeps its difficulty as measured; traps lead off every lowest route; par chance repeats exactly; no step is one-way.

## The 5-letter game on desktop (2026-10-07, branch `five-letters`)
- **Why:** the 4-letter game's supply of fresh daily pairs runs low within a few years under the pool's balance rules. Desktop players get a 5-letter game; phones and tablets keep today's 4-letter game, unchanged.
- **Who gets it** (`src/letters.ts`): a wide window (900 px or more) with a mouse or trackpad at load (`(hover: hover) and (pointer: fine)`). Decided once per load, so resizing never swaps games mid-play. `?letters=4` or `?letters=5` overrides it, for testing.
- **Words** (`scripts/familiar.ts --letters 5`): 4,041 familiar 5-letter words, from SCOWL size 40 and ENABLE, minus a reviewed 5-letter blocklist (swears, sexual terms and slurs, on the same terms as the 4-letter one) and a reviewed list of obscure words. 3,314 are everyday words, which puzzles start and end on. The sources are downloaded into a git-ignored `sources/` folder (see README); the 4-letter list rebuilds identically from them.
  - **Familiar words beyond size 40** (`data/familiar-extra-5.txt`): a playtest found SHILL, SHALE, STILE and SPILT missing. Size 40 alone was too narrow, so a hand review added 414 familiar words from SCOWL size 50 (KEBAB, LATTE, NINJA, SHALE) and 115 from outside SCOWL that most players know (SUSHI, TAPAS, EXPAT, REMIX, SPILT, SPELT). The rest of size 50 (301 rare, archaic or technical words, ACMES among them since the obscure-word review), 12 flagged words, British-only spellings (FIBRE, METRE) and borderline informal ones are in a review list (`reports/word-candidates-5.md`, local). CLAVE is left out as rare.
  - **Obscure words left out** (`data/obscure-5.txt`, 2026-10-08): a playtest found HALER (a Czech coin) accepted. SCOWL's size doesn't track how well known a word is (HALER is in size 35), so a hand review of the whole list left out 89 words most players wouldn't know or think of: rare comparatives (ABLER, APTER, DIRER, WRYER), odd verb forms (WAKED, PAYED, FLIED, GUYED, HIDED), plurals nobody uses (VASTS, WHENS, YESES, GENII, LAVAS), and rare or technical words (HALER, INFIX, OCTAL, MIENS). Common words in the same shapes stay (PALES, SHIES, MAXES, LUCKS, BODED, TIDED). The 11 of them with hand-written definitions keep those, so any can come back by deleting its line and rebuilding. The same review blocked DIKES, FANNY, GYPSY and WELSH, matching DIKE and GYPS at 4 letters, and re-worded CORGI's definition ("Welsh breeds"). The 4-letter list hasn't had an obscure-word pass.
- **Definitions** (`scripts/definitions.ts --letters 5`, `public/definitions-5.json`): WordNet 3.0's, plus 105 hand-written for words it lacks (function words like AMONG, WHICH, WOULD, and newer or informal ones like CELEB, CHEMO, REMIX, YIKES) and 9 overrides where WordNet's gloss used a blocked word (PILES as hemorrhoids, CRABS, BIDET, CORGI, among others). Blocking HORNY also re-worded BEAK and CLAW in the 4-letter definitions. A broader hand review, like the 4-letter one, is still to do.
- **The maze** (`scripts/mazes.ts --letters 5`, `public/mazes-5.json`) is much sparser than the 4-letter one:
  - a median of 2 doors per word (5 at 4 letters), and 20% of words have none;
  - only 61% of words are in the main maze (93% at 4 letters; 58% before the familiar extras), and 246 pockets hold 693 of them;
  - two words are typically 33 strokes apart (19 at 4 letters), and most vivid opposites can't reach each other at all (LIGHT and HEAVY, RIGHT and WRONG), so the reference puzzle is SHARP → BLUNT (20 strokes).
- **Its puzzles run longer** (`PUZZLE_SHAPES[5]` in `src/maze.ts`): lowest strokes 12–15 over 4–8 words (the owner's choice).
  - The pool: 420 puzzles from 3,468 candidates (under a minute), all tricky with a pocket beside the route, 13.5 strokes on average. Par chance median 3% (0–27%); planning depth 2 for 238, 3 for 117, more for 65; 98 with a trap into a pocket (28 at 4 letters); 408 different start and goal words.
  - It's balanced by best total alone (`POOL_MIXES[5]` is null): puzzles that need no C, I or V are rare at 5 letters (about 6%), so the 4-letter 30/50/20 mix can't be had. The daily picker rotates through the pool's own mix instead.
- **Dailies** (`src/daily/days-5/`, `npm run daily -- --letters 5`): one 5-letter puzzle a date, numbered like the 4-letter ones ("No. 2 · 5 letters"). The first is 2026-10-07, SNARE → SHOUT (14 strokes; rechecked after the familiar extras, which make it a little easier: par chance 6%; unchanged by the obscure-word review). They have no scenes of their own: a Perfect gets the confetti, then the goal word (`plainScene`); the 4-letter day's scene never plays in the 5-letter game. The daily runbook now checks in both.
- **In the game** (`src/MazeApp.tsx`): the 5-letter game loads its own data, dailies and definitions, keeps its results apart (`strokes:result5:{DATE}`), and gets a wider column (760 px, the path card beside it from 1,100 px) so five letters keep the size four have. The word's unit is sized from the number of letters. The share card draws one ladder column per letter and says "5 letters".
- **Download:** the desktop game loads about 79 KB of maze and 98 KB of definitions (gzipped) instead of the 4-letter files.
- **Tests** run over both lengths: the word lists and definitions, the pools and their difficulty, the dailies, and the check that every step works both ways (no 5-letter step is one-way either); and the device rule.
- **Projected experience:** steps are much harder to find (half the doors per word, among more possible edits) and a little easier to choose between (fewer decoys); puzzles take about 5 steps instead of 4; more of the maze is pockets and cut-off corners. Desktop and phone players get different puzzles each day.
- **Next:** linking words for 5 letters, to join more of the maze (61% connected); the same obscure-word pass over the 4-letter list; the hand review of the 5-letter definitions; counting the 5-letter puzzle supply.

## 5 letters on phones, behind a flag (2026-10-08, branch `five-letters-phones`)
- **Why:** desktop plays and looks good at 5 letters; before phones get it, the owner tests it on a real phone. Measured at phone widths, the layout fits as is (no sideways scroll, the tray and buttons don't change, the page gets shorter); only the letters shrink, to about 78% of the 4-letter phone size.
- **The flag** (`fiveLetters` in `src/flags.ts`, off by default): on, phones and tablets get the 5-letter game too (`chooseLetters` in `src/letters.ts`; `?letters=4` or `?letters=5` still overrides it). A link turns it on for that visit: `?flags=fiveLetters` (bookmark it to keep it). In Dev it's remembered, and toggling it reloads the page, since the game is chosen once per load. Turning it on for everyone is changing its default.
- **Phone layout for five letters** (`.maze.compact.five`, and `CELL_W_COMPACT_5` in `WordEditor.tsx`): the cells are 2.4 units wide instead of 2.6, so the same width draws each letter bigger, and the page, board and cell padding and the gaps between cells are trimmed. No formed letter is drawn wider than 2 units, keeping the pen as clear of the cell's sides as W is at four letters: A, O, V, Y and M fill the width, and W is drawn a little narrower.
- **Letter size**, cell width by height:

  | Phone width | 4 letters | 5 letters before | 5 letters now |
  |---|---|---|---|
  | 360 px | 76 × 105 | 59 × 81 | 63 × 95 |
  | 375 px | 80 × 110 | 62 × 86 | 66 × 99 |
  | 430 px | 93 × 129 | 73 × 101 | 77 × 116 |

  About 16% bigger than before, and 90% of the 4-letter size; nothing scrolls sideways down to 320 px. Tablets use the desktop layout at about the desktop's size. With the flag off, the 4-letter phone game measures exactly as before.
- **To judge on a real phone:** picking out one of E's bars, dropping a stroke on the right spot, the longer path card, and whether a 5-step puzzle suits a phone session.

## The UI, enhanced: one toolbar, stats, more practice (2026-10-08, branch `ui-enhancements`)
- **One toolbar** for How to play (**?**), hardcore (the flame) and settings (the gear): a single raised pill in the header's top-right corner, its three buttons 36 px to look at with 44 px taps. On phones the header is a row instead: the slim wordmark and the dateline on the left, the toolbar on the right. This supersedes the **?** in the score card's corner and the flame in the word box's (so the score card and the definition no longer keep clear of them). The flame is still well away from Undo, Reset step and Hint, and still asks for a second tap before starting over. Between phone and desktop widths (600–820 px) the header graphic shrinks to leave the toolbar room on either side, so the two never overlap. A lit flame fills its button with the spicy colour; one waiting for its second tap gets a spicy ring; an open dialog's button is shaded. Other options considered: the bar under the header across the column's width, or as a row above the board.
- **The score card's stats:** once a word is made (or a hint taken), a row of chips under the score says how the game is going: words made, free returns (trips back to a word already visited), the biggest step so far (with ink, what it took), strokes paid in ink, and hints. Only the ones with something to say are shown, words made and biggest step from the first word. On phones they're a line of smaller chips under the details.
- **The end of a game's stats:** after a win, under "DUNE in 9 strokes · perfect ⭐", six tiles (number over name): the lowest possible (perfect) or how far over it, words made, the biggest step, the time from the first stroke, free returns and hints. A daily then shows the player's record, in a quieter dashed row under "Your dailies": dailies solved, how many perfect, the current streak (dailies solved in a row up to this one) and the best streak.
  - The record is worked out from the results this browser already keeps, one per daily solved (`dailyRecord` in `src/stats.ts`), so a replayed day is never counted twice, and the 4- and 5-letter games keep theirs apart. A pool puzzle (no date) shows the game's tiles only.
  - A daily's kept result now has its time too (`seconds`); results kept before have none.
- **More practice in How to play:** once the five moves are done, it asks "Want to practice other letters?", with a **Practice more letters** button. Practice then carries on from the letter just made to another a move or two away, letter after letter, with the whole tray, avoiding the last four letters made (and E, just made into F). The head says "Practice" and counts the letters made.
  - The ghost shows the first move of a shortest way to the letter, worked out with the editor's own rules (`planTo` in `src/tutorial.ts`: a stroke goes only where it grows towards a letter; from the tray, only the way it sits there, then it's turned in place). The line says what to do in general terms ("Make an R: drag the stroke shown in from the tray."), since player-facing text calls every stroke just a stroke. Straying more than a step's three strokes from the letter says "Not quite: make an R." with Start over.
  - X and Z have no letter a move or two away, so practice starts again from another letter after them.
- **The dateline** is just the number and the date ("No. 2 · Wednesday, October 7"): the 5-letter game no longer says "5 letters" there. The share card still does, since the phone's puzzle that day is a different one.
- **Tests:** the record (each day once, streaks broken by a missed day, nothing after the day played) and times; every practice letter offered from every letter is made by doing the moves shown, two at most; the practice's lines.

## 5 letters on phones for everyone (2026-10-08, branch `five-letters-on-phones`)
- **The `fiveLetters` flag is on by default:** every device gets the 5-letter game, with its dailies (`src/daily/days-5/`), definitions and results. `?flags=-fiveLetters` or `?letters=4` still plays the 4-letter game, whose days, scenes and results are kept.
- **Players who were on the 4-letter game** keep those results under their old keys; their 5-letter record starts fresh.
- **Next:** the daily runbook still checks in a 4-letter day and builds its celebration scene, which only `?letters=4` shows now.

## Room for ads, behind a flag (2026-10-08, branch `ads-slots`)
- **The owner's ask:** a Google AdSense banner at the top on phones, and vertical banners left and right of the game on desktop, with the flag off until AdSense is set up.
- **The flag** (`ads` in `src/flags.ts`, off by default): off, the page is exactly as before. There are no extra elements, the same classes and grid, and no script requests. `?flags=ads` turns it on for a visit, and Dev's **Ad slots** box toggles and remembers it.
- **Where the ads go** (`src/ads.ts`; `src/MazeApp.tsx` picks the slots from the window's width):
  - **Phones** (the compact layout, under 600 px): one banner over the header, in a reserved 320×100 box that also takes 320×50 ads. The game moves down 110 px (the box and the grid's gap). At 375×812 the whole step panel (Undo, Reset step, Hint and the step meter) still ends on screen, at 807 px. On a 320 px phone the box runs edge to edge into the page's 4 px padding, so nothing scrolls sideways. A 320×50-only unit would give the game back 50 px.
  - **Wide desktops:** a 160×600 rail either side of the game and its path card, or 300×600 rails where there's room. Each rail sits in its own grid column beside the game, level with the header, and scrolls with the page. Both fit, or neither shows: the main column (760 px) and the path card (260 px) keep their full widths (`railWidth`). The 5-letter game gets 160 px rails from **1,464 px** and 300 px rails from **1,744 px**. That's the game, the rails, their 24 px gaps, the page's 16 px padding and 20 px for a scrollbar (17 px on Windows). The 4-letter game (`?letters=4`) gets them from 1,344 and 1,624 px. Resizing across a threshold adds, drops or swaps the rails; a rail of a new width is a new box, since a filled ad can't be resized.
  - **Tablets and middle widths** (600 px up to the rails): no ad.
    - A 320 banner looks lost over the desktop layout, and a 728×90 leaderboard would be a new unit pushing the board below the fold on a laptop.
    - The 600–820 px header was also just tuned so the toolbar fits.
    - Phones on their side are 600 px or wider, so they get none too, which leaves the short screen to the game.
    - A leaderboard here is the obvious next slot if the owner wants one.
- **`AdSlot`** (`src/components/AdSlot.tsx`) holds an `<ins class="adsbygoogle">` of a fixed size, with the client and slot IDs from `src/ads.ts`. It uses fixed sizes rather than responsive units, so an ad never resizes its box after it fills. It asks AdSense to fill it once (StrictMode runs effects twice), and only with real IDs. In development an empty slot shows a dashed outline and its size ("Ad · 160×600").
- **Never over the game:** the slots are boxes in the page's own grid, so they can't overlap the game, the tray or the path card. Each is its own stacking layer that clips its contents, with no z-index, so How to play, settings, the share sheet, the held stroke, the celebration and the ink all draw over it. Checked with How to play open and with `?perfect` at 1,600 px: both cover the rails.
- **Keyboard and screen readers:** each slot is an `<aside>` labelled "Advertisement" ("Advertisement, left" and "right" for the rails). The slots come last in the page, so Tab and a screen reader reach the whole game first. The grid draws the banner at the top anyway.
- **Checked** (`?flags=ads`, the dev server):
  - **Flag off**, at 375×812 and 1,280 px: no ad elements, no requests to Google, and the same layout as before.
  - **375×812:** the banner is 320×100 at the top and the header starts at 120 px. Nothing scrolls sideways, at 320 px either.
  - **768 and 1,280 px:** no ads. At 1,280 the page measures the same as with the flag off (column at 118 px, path card at 902 px).
  - **1,500 and 1,600 px:** 160×600 rails, with the column and path card where they are without them.
  - **1,920 px:** 300×600 rails.
  - **Resizing** 1,920 → 1,500 → 1,280 swaps the rails, then drops them.
- **Left for when AdSense is set up:**
  - Fill in the publisher ID and the three unit IDs at the top of `src/ads.ts` (one display unit each: banner 320×100, left rail, right rail). That's all it takes for `loadAdSense()` to load the script, once, for visits with the flag on.
  - Turn the flag's default on.
  - **ads.txt:** AdSense reads it from the domain's root, `funklunsford.github.io/ads.txt`. A project site's `public/` serves `/strokes/ads.txt`, so it has to go in a `funklunsford.github.io` user-site repository, or the game needs a custom domain.
  - **Site review:** Google may ask for its snippet in `index.html`'s `<head>`, which loads the script for everyone.
  - **Consent:** visitors in the EEA, the UK and Switzerland need a Google-certified consent banner (AdSense's own Privacy & messaging can provide one), and the privacy policy needs updating.
  - **Auto ads:** keep them off, or at least their anchor and vignette formats. They place ads over the page, which these slots are built to avoid.

## Phones turn strokes with a double-tap only (2026-10-08, branch `phone-turns`)
- **No swipe under a finger:** on a touch screen a stroke is turned by a double-tap, in the tray (free) or where it sits. A mouse always swipes to turn, as before, and double-click still turns too. The "Swipe to turn" setting is gone everywhere (a saved choice is ignored). How to play's touch text and the "turned the other way" notice say so.
- **The small fix from the rotation plan** (`docs/rotation-on-phones-plan.md`, branch `rotation-plan`): under a finger, where nothing turns a stroke as it lands, a stroke carried out of one letter into an empty one lands the way the tray starts it (`restingTurn` in `src/turns.ts`). D's arc carried into an empty letter makes a C. Without it, 22 five-letter steps and 18 four-letter ones would cost a stroke more without a swipe, and 10 + 8 pool puzzles would have a higher lowest score; with it, none do, so every par stays true on phones.
- **Not built yet:** the plan's turning by where a finger holds the stroke (`placeTurn`), and How to play practice for it.
- **Tests:** vitest now leaves out `.claude/**`, so agents' worktrees inside the checkout don't add their copies of the tests to a local run.

## Phone fixes from the 5-letter playtest: margins, scrolling, a held stroke, Reset, icons (2026-10-08, branch `ui-fixes`)
- **An O's side margins** (`MAX_DRAWN_COMPACT_5` in `WordEditor.tsx`): five-letter phone cells stay 2.4 units wide, but no formed letter is drawn wider than 1.7 units there (was 2). Only the widest letters narrow (A, M, O, Q, V, Y by 15%; W more), so every letter keeps its height. Widening the cells for the same room would have shrunk all five letters. An O's ink now keeps as clear of the cell's sides as at four letters (6.4 px at 375 px, measured). The first stroke of an O or A shifts in a little as the letter forms, as W's always has.

  | Phone width | Cell (unchanged) | O's ink, before → now | Room each side, before → now |
  |---|---|---|---|
  | 360 px | 63 × 95 | 59 → 51 px | 2.0 → 6.0 px |
  | 375 px | 66 × 99 | 62 → 53.5 px | 2.1 → 6.4 px |
  | 430 px | 77 × 116 | 72 → 62 px | 2.5 → 7.4 px |
- **Scrolling from the play area:** the whole editor (word and tray) was `touch-action: none`, so a swipe there never scrolled. Now it's `manipulation`, and the editor claims a touch only when it lands on a stroke (placed, or a tray tile), with a non-passive `touchstart` listener that cancels it before the page can scroll (cancelling `pointerdown` doesn't stop a scroll). While a finger holds a stroke, a second finger anywhere on the page is claimed too, so it can't scroll or zoom mid-drag (a window listener for the drag's length); a drag itself never scrolls, since its own touch was claimed as it landed. Tray tiles stay `touch-action: none` too, except in a locked step or a won game, when nothing can be dragged and every swipe scrolls.
  - **Where a swipe scrolls:** the definition, the cells' labels and the room around a letter's strokes, the gaps between cells and tiles, the tray's sides, the letter guide and the board's padding, as well as everything outside the board.
  - **Where it doesn't:** a swipe that starts on a stroke drags it. A drag up from the tray looks just like a swipe to scroll down, so the two can't be told apart as the finger starts to move. Making tiles scroll would need press-and-hold to pick a stroke up (the owner's call).
- **Holding a stroke on a phone:** a finger pressing a placed stroke tints it the red a mouse hover gives it (`--remove`), as long as it presses, so the stroke a tap removes is plain before letting go. Not on the second tap of a double tap (which turns it), and not once it moves (it lifts). Letting go removes it, like a click; sliding off and letting go puts it back. Checked with synthetic touch presses: held 600 ms, the stroke is red; released, the tint goes; moved 30 px, it lifts untinted and goes back to its spot; a double tap turns a V untinted.
- **Score card centring:** the score panel is as wide as its widest line (was a fixed 200 px), so the goal and the stroke count sit centred as a pair: at 1280 px they were 8 px left of the card's centre, now 0. On phones the pair and the details below it are centred (were left-aligned), and HARDCORE goes under the count, so "24 strokes" and the tag still fit beside the goal at 320 px.
- **Reset step is now Reset.** Its button takes the word back to where the step began.
- **Icons on Undo, Reset and Hint** (`StepIcons.tsx`): a hooked arrow, a loop coming round to its start, and a bulb, drawn like the toolbar's icons as round-ended lines in the button's colour (ink, or muted when disabled), in both themes. The bulb's glass is lit in gold while there's a hint to take. The labels stay, and the icons are hidden from screen readers. On desktop the Hint button (and hardcore's No hints in its place) keeps one width of 146 px (was 124) to fit its icon and its longest label; on phones the three share one row down to 320 px, with every Hint label (Hint, Next word, Hint used) inside its button.
- **Tests:** no formed letter is drawn wider than its phone cap, and the five-letter O has at least the four-letter O's room as a share of the row.
- **Checked with main's ads and double-tap turning merged in:** with `?flags=ads` at 375×812 the step meter still ends at 807 px and the same areas scroll; a finger's double tap turns a tray chevron, a tap removes A's bar and a drag puts it back; a mouse hover still tints a stroke red; at 1,500 px both rails show and nothing scrolls sideways.

## Practice after the intro, swipe turns in the intro, three-step hints, hardcore in Settings (2026-10-09, branch `misc-additions`)
- **More practice comes after the intro:** "Want to practice other letters?" showed for a moment after every move from the second on, with its button live, so a click could skip the rest of the intro. The check was "the last step listed", and the practice lists steps only up to the one after the current. It's now "the fifth move is made" (`offersMore` in `src/tutorial.ts`, tested).
- **The intro teaches a mouse to swipe, not double-click** (the owner's call). With a mouse, the practice says "Swipe the V up to turn it over." and "Swipe the C to the right to turn it around.", and its cursor presses the stroke and swipes 0.8 units the way the turned stroke will point (`pointing`, now shared with the editor), so the stroke lifts, turns on its spot and settles. More practice says "swipe the stroke shown to turn it". How to play's mouse line ends "To turn one, swipe it as you place it." A swipe already completed the step; a double-click still turns a stroke too. Touch keeps the double-tap.
  - **A lone stroke stays put while it's swiped:** a stroke alone in its letter (V's chevron) was held over the empty cell's spot, half a unit left of where it's drawn (13 px in the practice), and slid back once dropped. It's now offered its cell's spots at its own x, as a double-tap already turned it, so it turns where it is, and put back unturned it hasn't moved (that used to cost a stroke mid-step).
- **The A drawn over itself** (the owner's report): the practice's ghost showed a turn with a faint copy of the stroke turning over on top of the stroke itself, which stayed as it was. Halfway through, and for the rest of the loop, the cell showed a V with an upside-down V (the A's shape) across it, like a star; the C step drew a reversed C over the C. With reduced motion the faint turned copy sat over the stroke for good. Now the stroke itself turns: while the ghost shows a turn, the editor hides that stroke's ink (`ghosted`; it can still be pressed) and the ghost draws it in its place at full strength, turns it, fades it and brings it back unturned to rest. With reduced motion a turn shows no copy, only the finger on the stroke, or the cursor at the end of its swipe with the swipe dotted in. Carries and removals keep their faint copy (it never lies on its own stroke turned).
- **Hints in three asks** (the owner's call, `src/hints.ts`). Each ask in the same word shows more of the next step on a lowest-stroke route (the same step throughout):
  1. **its word's meaning**, as a clue: "Hint: the next word means “have in common” (verb)." The word and its base form are blanked out wherever the definition uses them ("make ___ or still"), and the part of speech is left off when it's the word itself (NOUN);
  2. **the letters to change**, outlined in the word as before, with the meaning kept in the line: "Hint: change the 2nd letter, to a word meaning …";
  3. **the word**, and what it costs: "Hint: make SHARE next (2 strokes)."

  A word with no definition (or definitions that didn't load) starts at the letters. The button says Hint at every ask (the owner's call), and is greyed once the word itself is shown. **Each ask counts as a hint**, as both levels did before, so a step costs one to three (two without a definition), and the win line, the end-of-game stats, the share card and a kept result all show that one count. Hardcore still has no hints. Two quick asks show two levels, as they're counted. The fifth letter of a 5-letter word was "the undefined letter"; it's "the 5th letter" now, and three read "the 1st, 3rd and 5th letters". How to play: "Stuck? Tap Hint for the next word's meaning, then the letters to change, then the word." Tests: the levels, the lines, and that no maze word is named in its own clue, in either game.
- **The letter guide ships off** (the owner's call): the A to Z under the word is off by default (`DEFAULT_PREFS` in `src/prefs.ts`), and Settings → Playing turns it on. **Existing players:** saving any setting stored every one, so anyone who changed a setting before (theme aside, which is kept on its own) has the guide saved on and keeps it, whether or not they chose it; everyone else gets it off. Tests: the defaults, a saved choice either way, and blocked storage.
- **No words made or hints on the score card during play** (the owner's call). Its chips now start with the first word and show only the biggest step so far, and free returns and ink paid when there are any. (Since 2026-10-09 the biggest step waits for the end too, the owner's call: the chips are only free returns and ink paid, and none show until there's one of them.) The words made and the hints taken are told at the end, in the end-of-game stats, which are unchanged. Checked after SNARE → SHARE: one chip, "biggest step +2", centred under the goal and the count (0 px off) at 1,280 and 375 px; a hint before any word adds no chip.
- **Hardcore is a setting** (decided with the owner), like Wordle's Hard Mode. The flame is gone from the toolbar, which is now **?** and the gear (86 px wide, so the header graphic between phone and desktop widths keeps 14 px clear of it, reserving 200 px instead of 280). Settings → Playing starts with a **Hardcore** switch: "Only words on a lowest-stroke route count, and there are no hints. Turning it on starts the puzzle over."
  - **Turning it on starts a puzzle in progress over** (the owner's call; `hasStarted` in `src/hardcore.ts`): a stroke on the board, a word made or a hint taken all count as started, a hint too since hardcore has none, so no hardcore result carries anything from before. There's no confirm step (the flame's second tap is gone): the switch's own line says it starts over. Turning it off lets the puzzle go on. Switching it says so in the step line ("Hardcore on, so the puzzle starts over: …"). The stored choice (`strokes:hardcore`), the score card's HARDCORE tag, "No hints" in place of the Hint button, the result's and share card's hardcore badges are unchanged.
  - How to play: "Want a challenge? Turn on Hardcore in Settings (it starts the puzzle over): only words on a lowest-stroke route count, and no hints." With the new hint line it adds one line in all: How to play still fits a 375×812 phone without scrolling until the five moves are done, when the "Practice more letters" offer makes it scroll by about 55 px (33 px before).
  - Tests: when turning it on starts over, and the stored choice.
- **Slower turns** (the owner's call): a held stroke turning round, whether by a swipe or to fit the spot it's over, now swings over 0.7 s (`TURN` in `WordEditor.tsx`; it shared the 0.35 s `SETTLE`). How to play's mouse demo swipes over about a second (the loop is 3.6 s, was 2.6 s), so the turn can be followed. The double-tap demo is unchanged.
- **"Practice", not "Practise"** (the owner's call, US spelling as elsewhere): "Want to practice other letters?" and "Practice more letters".

## Difficulty at 5 letters, against working back from the goal (2026-10-09, branch `difficulty-5`)
- **Why:** in playtests the owner made par by working about 3 steps back from the goal, then about 3 from the start, while every difficulty measure looked only forward. The study is in `docs/difficulty-5-letters.md`, with methods, tables and sources.
- **Findings:**
  - Going forward, the pool is as hard as designed: the simulated forward walker makes par 4% of the time.
  - Working back gets round it. For half the 5-letter pool (220 of 420) the strategy is a rule of thumb, and half the pool isn't tricky played goal → start.
  - Simulated planners make par 51% of the time working back first, against 15% heading forward, when both look at 10 words (91% against 66% at 20).
  - It works because judging by eye is nearly exact 1–2 doors out and poor 4–6 out, and routes are only 4–6 doors long.
  - Pockets make no measurable difference to any simulated player.
- **New measures** (`src/difficulty.ts`, with tests):
  - `goalSide`: the goal's side, mapped a number of doors back.
  - `meetDepth`: planning depth after mapping the goal's side; 1 means the strategy is a rule of thumb.
  - `walkChance`: parChance's walker, heading for the goal or the goal's side, counting near misses; `parChance` now uses it, unchanged on every pool puzzle.
  - `planChance`: players who plan before moving, forward, back or from both ends.
  - `searchEffort`: the words a search from both ends must look at (MM's).
  - `reversed` and `isTrickyBothWays`.
- **Tools:**
  - `scripts/mazes.ts --out FILE --rule meet --best 13-16` rebuilds a pool for comparison. With none of these options it rebuilds the shipped pools byte for byte.
  - `scripts/difficulty-study.ts` prints the doc's tables.
- **Recommendations** (the first two applied the same day at 15–18 strokes, the owner's call: see the next section):
  - Pick puzzles by `--rule meet` at lowest strokes 13–16. The meet planner at 10 looks goes from 51% to 27% and the forward planner at 20 looks from 66% to 53%, at 5.45 doors a puzzle against 4.9.
  - Rank the daily thirds by par chance and search effort together, which makes the hard third harder for every simulated player.
  - Find out whether players miss doors that change two letters at once.

## Longer, harder 5-letter puzzles (2026-10-09, branch `harder-five`)
- **The owner's call**, after the difficulty study: puzzles a few strokes longer are fine ("maybe even by 3"). Trial pools at +2 and +3 strokes, with and without the study's rule, scored by its simulated players (share of games at par):

  | | 12–15, pocket rule (before) | 14–17, pocket | 15–18, pocket | 14–17, meet | **15–18, meet (now)** |
  |---|---|---|---|---|---|
  | lowest strokes / steps, average | 13.5 / 4.9 | 15.5 / 5.7 | 16.5 / 6.1 | 15.5 / 5.7 | **16.5 / 6.1** |
  | working 3 back from the goal, then forward (the owner's strategy) | 46% | 21% | 17% | 9% | **7%** |
  | working 4 back | 93% | 59% | 42% | 53% | **35%** |
  | planner from both ends, 20 looks | 91% | 70% | 58% | 66% | **55%** |
  | forward planner, 20 looks | 66% | 38% | 26% | 40% | **32%** |
  | forward walker within 2 strokes | 12% | 7% | 6% | 6% | **5%** |
  | different start and goal words | 408 | 407 | 432 | 471 | **466** |

- **The pool** (`public/mazes-5.json`): lowest strokes 15–18 (`PUZZLE_SHAPES[5]`), over 5–8 steps (6.1 on average), and the meet rule is the 5-letter default in `scripts/mazes.ts`: tricky, and working back from the goal 3 doors and then taking the door that looks best doesn't solve it (`meetDepth` of 2 or more). No pocket is needed any more; 40 puzzles still have a trap into one. 420 puzzles from 1,232 candidates. The 4-letter pool keeps the pocket rule.
- **The daily thirds** (`scripts/daily.ts`): ranked by each puzzle's place by par chance plus its place by search effort (`searchEffort`, the words a search from both ends must look at), then the deeper plan and more traps as before. Each candidate's line says its search effort, and the runbook prefers more of it between equally good pictures, in place of a trap into a pocket.
- **The first 5-letter daily** (2026-10-07, SNARE → SHOUT, 14 strokes) keeps its puzzle; its test allows the old 12–15 range for it alone.
- **Tests:** the 5-letter pool is checked for its meet depth instead of a pocket, at its new length.

## /daily is 5 letters only (2026-10-09, branch `daily-five-only`)
- **The owner's call:** only 5-letter words matter now, so `/daily` adds just the 5-letter puzzle. It follows a new, shorter runbook, `docs/daily-prompt.md`: get ready, choose, check, hand in. Its date is the day after the latest file in `src/daily/days-5/`. There's no concept, scene or log entry, since 5-letter days have no celebration of their own.
- **`npm run daily` defaults to 5 letters;** `--letters 4` reaches the old game. Checking a day in prints its number.
- **`docs/daily-celebration-prompt.md`** is kept, marked as no longer followed. It's the contract for the 4-letter celebration scenes that `src/celebration/scenes.test.ts` checks.


## Light-theme colours that stand out like the dark ones (2026-10-09, branch `light-colors`)
- **The owner's ask:** the light theme's colours should stand out as much as the dark theme's. Measured as contrast against what they're drawn on, the dark theme's strokes average 6.5:1 against a cell, but the light ones only 5.2:1. The light ochre V was 3.1:1 and the sage diagonal 3.8:1. The gold goal ring was 2.1:1 (10.6:1 in dark), and the grey text 3.2:1 (5.4:1).
- **Strokes** (`--t-*` in `src/styles.css`): same hues, deeper and a little richer. Each is at least as far from a cell's white as its dark-mode colour is from the dark cell, and never less than before:

  | Stroke | Before | After | Dark |
  |---|---|---|---|
  | long bar | #3f5a74 7.2 | #395a7b 7.2 | 6.4 |
  | short bar | #b0583a 4.9 | #a84409 6.0 | 6.0 |
  | long diagonal / | #6f8c58 3.8 | #3e580c 8.1 | 8.1 |
  | long diagonal \ | #4e6b3f 6.0 | #4b6c2f 6.0 | 5.3 |
  | short diagonal | #3f7f73 4.7 | #0a6b5d 6.4 | 6.5 |
  | big chevron V | #b98a2f 3.1 | #7f5608 6.5 | 8.0 |
  | small chevron | #8a4f70 6.1 | #934974 6.1 | 5.7 |
  | arc | #6b5b8f 6.0 | #6f5899 5.9 | 6.0 |
  | bowl | #a8545d 5.1 | #a53c42 6.3 | 6.3 |

  The ochre V is a deep amber at 6.5:1 rather than 8:1, since no yellow that dark is still golden. The closest two strokes (short bar and bowl) are further apart than the closest two in dark (OKLab 0.059 against 0.048), so none is harder to tell from another.
- **Accents** (light only): gold #d9a520 → #ad8211 (3.5:1, the goal ring and label), grey text #8b8794 → #6d6976 (5.3:1, as in dark), success green #5e8c4f → #497c38, warning orange #e4572e → #d4410d, and the remove red #e5484d → #df2c3b (about 4.6–5:1).
- **The share card and link preview** are always drawn on paper, so they take the same colours (`PAPER` in `src/share.ts`). `public/og.png` was redrawn with `drawPreviewCard`.

## A door shorter: 12–15 strokes again, with the meet rule (2026-10-09, branch `fewer-doors`)
- **The owner's call:** the game felt a bit difficult, so lower the average doors (steps) a puzzle takes by one. A step changes at most 3 strokes, so fewer doors means fewer strokes too. Trial pools, all with the meet rule (scored by `scripts/difficulty-study.ts`, share of games at par):

  | | 15–18 (before) | **12–15 (now)** | 13–15 | 12–16 | 12–15, at most 5 doors |
  |---|---|---|---|---|---|
  | lowest strokes / doors, average | 16.5 / 6.08 | **13.5 / 5.17** | 14.0 / 5.23 | 14.0 / 5.37 | 13.5 / 5.00 |
  | working 3 back from the goal (the owner's strategy) | 7% | **13%** | 13% | 12% | 14% |
  | working 4 back | 35% | **89%** | 85% | 74% | 100% |
  | planner from both ends, 20 looks | 55% | **87%** | 84% | 79% | 91% |
  | forward planner, 20 looks | 32% | **66%** | 60% | 55% | 67% |
  | forward walker within 2 strokes | 5% | **10%** | 8% | 8% | 10% |

- **The pool** (`PUZZLE_SHAPES[5]`): lowest strokes 12–15 over 4–8 doors (5.17 on average: 348 puzzles of 5 doors, 71 of 6, 1 of 7), still picked by the meet rule, so working back 3 doors from the goal never solves one by rule of thumb. 420 puzzles from 9,791 candidates; 461 different start and goal words. Capping the doors at 5 would hit the target exactly, but every puzzle would be the same length and easier still.
- **Days already published** (MINER → CHEER, POUCH → BATCH) keep their 15–18 puzzles; their test allows that range for them.
- **`scripts/mazes.ts --steps 4-5`** builds a pool with another range of doors, for comparisons like the one above.

## Renamed Diplet (2026-10-10, branch `rename-diplet`)
- **The owner's call:** the game is now **Diplet**, from a doublet (Lewis Carroll's name for turning one word into another, step by step) and dipping a pen in ink, since every letter here is drawn stroke by stroke.
- **What changed:**
  - the header's wordmark (`WORDMARK` in `src/components/maze/Masthead.tsx`), still built from the parts row as the page loads. DIPLET is 8.5 units wide where STROKES was 12.7, but the parts row (18 units) still sets the header's size, so its letters are as big as before;
  - the page title and link-preview tags (`index.html`), and the link preview itself (`public/og.png`, redrawn with `drawPreviewCard`). Its tag asks for `og.png?v=diplet`, so apps that cached the old picture by its address fetch the new one;
  - the share card's wordmark, the share title ("Diplet No. 4 · 5 letters"), its alt text and the saved file's name (`diplet-4.png`);
  - the browser-tab icon: the wordmark's D, in the same ink and board colours as the S was (`scripts/favicon.ts` → `public/favicon.svg`);
  - the README, the daily runbook and `/daily`, and the README and commit message `scripts/deploy.sh` writes to the site's repo.
- **What didn't:**
  - the address, https://funklunsford.github.io/strokes/ (the `funklunsford/strokes` repo), so links already shared keep working. GitHub doesn't redirect a Pages site when its repo is renamed, so moving it would break them;
  - the saved-data keys (`strokes:prefs`, `strokes:theme`, `strokes:hardcore`, `strokes:seen-help`, `strokes:flags`, `strokes:result…`), so no one loses their settings or results;
  - names in the code (`src/strokes.ts`, `STROKES_REPO`, the `STROKES_DEPLOY_KEY` secret) and the older notes, including the 4-letter celebration runbook.

## A bold wordmark, with ink dripping from the D (2026-10-10, branch `rename-diplet`)
- **The owner's ask:** the name at the top in bold, and the D dripping a little ink.
- **Bold:** the header's wordmark is drawn with a pen a fifth broader than the game's (`BOLD` in `src/components/maze/Masthead.tsx`, through a new `weight` for `inkOutline`), so the nib's thick and thin parts stay. Half as broad again was tried first; it stood apart from the letters in the tray, so it came down to 1.2. The parts row above it, and every stroke in the game, keep the usual pen.
- **The drip** hangs from the D's bowl, 0.36 units right of its stem, in the bowl's colour. It's a thin neck that flares where it leaves the ink (tilted to the bowl's edge, so no corner of it shows) and runs into a teardrop whose centre is 0.42 below the ink.
- **Its motion:** once the D has landed (1.05 s), a bead swells under the bowl, then creeps down and stops (1.8 s in all). With less motion it's drawn whole, fading in with the bowl.
- **The share card, link preview and tab icon** keep the regular wordmark.

## A pen nib before the name (2026-10-10, branch `rename-diplet`)
- **The problem:** DIPLET is built from only 4 of the 9 strokes (six long bars, five bars, one arc, one bowl), so the header barely shows the strokes the game is played with. Each letter has exactly one build in the game, so the name's own strokes can't change without showing letters players can't make.
- **First try, dropped:** a nib built from strokes the name doesn't use (the two slashes for its point, the small chevron for its shoulders, a long bar for its slit), which brought the header to 7 of the 9 strokes. In place it was a crude diamond with a stick: the game's strokes are thick, coloured by kind and fixed in shape, so they can't make a nib's fine slit, its breather hole or the curve of its taper.
- **Now:** a drawn gold nib (`NIB_PATH` in `src/components/maze/Masthead.tsx`, `--gold`), a cap height tall with its tip on the baseline, 0.8 before the D. It has an arched top, rounded shoulders, sides sweeping in to a fine point, and a breather hole and slit cut through it. Its tip is dipped in the same purple ink as the drip from the D, up to a wavy line. It isn't built from game strokes, so the parts row above the name stays the place that shows all nine.
- **On load** the nib drops in first, then ink climbs its tip as if it had just been dipped; the letters follow and the D drips once it lands. With less motion it all fades in in place.
- **Also tried:** an ink drop and a tilted nib made of strokes (clumsy), all nine strokes in a 3 × 3 grid (busy), each stroke set a little apart from its stem (shows how letters are built, but adds no new strokes), and a steel nib (dull grey at header size).
- **In the header and on the link preview** (the owner's call); the result card and tab icon show the name alone.

## Renamed Diplets, with green ink on the nib (2026-10-10, branch `rename-diplet`)
- **The owner's call:** rename the game Diplets, to give the word more to show. The S is two bowls, so the name now has curves at both ends (the D's arc, the S's two bowls) instead of ending on straight bars. It's still built from the same 4 kinds of stroke (six long bars, five bars, one arc, three bowls): the S adds two bowls, not new kinds.
- **The nib's ink is green** (the rising slash's green, `--t-LD`), on its dipped tip and in a bead that swells at its point once the ink has climbed it. That brings a colour the name doesn't use; a purple dip with a green bead was tried and read as two inks.
- **Changed with the name:** the wordmark, the page title and link-preview tags, the link preview itself (`public/og.png`, redrawn; its tag now asks for `og.png?v=diplets`), the share card, its title, alt text and saved file (`diplets-4.png`), the README, the daily runbook and `/daily`, and what `scripts/deploy.sh` writes to the site's repo.
- **Unchanged:** the address (/strokes/), the `strokes:` saved-data keys, names in the code, and the tab icon (still the D).

## Even spacing in the name (2026-10-10, branch `rename-diplet`)
- **The owner's note:** the spacing in the title looked off. A fixed gap (0.7) between letters' boxes left straight stems cramped (I beside P) and open letters loose (above L's foot, under E's bars, either side of T's stem).
- **Now the letters are spaced optically** (`src/spacing.ts`), the way type designers space letters:
  - each pair is set so the white between them, averaged down the cap height, is 0.6;
  - a hollow deeper than 0.6 into a letter counts only that deep, since the eye doesn't take it for space between letters;
  - no two letters' ink comes closer than 0.34, a row above or below included.
- **DIPLETS, origin to origin:** DI 1.70 → 1.71, IP 0.70 → 0.90, PL 1.70 → 1.64, LE 1.70 → 1.48, ET 1.70 → 1.34, TS 1.70 → 1.26. The name is 9.6 units wide instead of 10.45. The nib is spaced from the D the same way, from its outline.
- **Used for the header and for the name on the share card and link preview** (`drawWord` in `src/share.ts`); the link preview was redrawn. `src/spacing.test.ts` checks that straight stems get more room than rounds and open sides, and that bars never run into the next letter.

## The nib leans in, and its ink runs through the strokes' colours (2026-10-10, branch `rename-diplet`)
- **The owner's calls:**
  - first: angle the nib slightly to face the D, make its ink the D's purple instead of green, and have the ink run through the colours before landing on purple;
  - then: a little more angle and more room from the D, a slower colour cycle, and a small shake, which was tried and taken out again.
- **The lean:** the nib turns 20° about its middle (`NIB.tilt` in `src/components/maze/Masthead.tsx`), its point towards the D. The name is spaced from the leaning outline and then set 0.3 further off (`NIB.room`), so the nib stands a little apart from the word.
- **The ink** (`.nib-ink` in `src/styles.css`) starts as the ink climbs the tip, 0.6 s in. Over 3 s it runs through the strokes' colours in tray order (long bar, bar, both slashes, tail, big chevron, small chevron, bowl) and settles on the arc's purple, the D's colour. It's a CSS animation, so it follows the light or dark palette; with less motion it's purple from the start.
- **No bead at the nib's point:** the drop that swelled there was taken out (the owner's call); the D's drip stays.

## Dailies merge themselves, every midnight (2026-10-10, branch `daily-auto-merge`)
- **The owner's call:** run the daily every day at midnight Eastern, and merge each new daily in without waiting for a review.
- **The runbook** (`docs/daily-prompt.md`, and `/daily`) now merges the pull request once every check in step 2 has passed. If a check fails, the pull request stays open with a note saying what failed.
- **The schedule** is a task in the Claude app, `daily-puzzle`, at `0 0 * * *` in the Mac's local time (America/New_York, so midnight EDT or EST). It runs while the app is open; a run missed while the app was closed happens when it next opens.
- **Each run:**
  - stops if a daily pull request is still open;
  - adds every missing day up to today as one batch;
  - works in its own worktree (`.claude/worktrees/daily`) with its own dev server, so the owner's checkout is never touched.

## The site moves to /diplets/ (2026-10-10, branch `pages-diplets`)
- **The owner's call:** serve the game at https://funklunsford.github.io/diplets/ instead of /strokes/.
- **On GitHub:** the site's repo was renamed from `funklunsford/strokes` to `funklunsford/diplets`, with the description "Diplets: a word maze where every letter is built from pen strokes". GitHub Pages serves a project site at the repo's name.
- **In the source:** `scripts/deploy.sh` (and `scripts/setup-deploy-key.sh`) now default to `funklunsford/diplets`. The deploy key and the `STROKES_DEPLOY_KEY` secret carry over, since a deploy key belongs to the repo whatever it's called. The link-preview tags (`og:url`, `og:image`), the share link and the card's footer (`SITE` in `src/share.ts`), the README and comments all use the new address.
- **Players keep their settings and results:** saved data lives per origin (funklunsford.github.io), not per path, so the `strokes:` keys carry over.
- **Old links:** GitHub doesn't redirect a Pages site when its repo is renamed, so links to /strokes/ now get a 404.

## The nib on the link preview (2026-10-10, branch `preview-nib`)
- **The owner's call:** the general link preview (`public/og.png`, the card shown when the site's link is shared) gets the nib before the name, as in the header. The result card and tab icon stay without it.
- **One nib for both:** its shape, lean and spacing moved from the header into `src/nib.ts`, with `afterNib` placing the letters after it.
- **On the card:** `drawWord` in `src/share.ts` draws it before the name in the paper palette's gold, its tip dipped in the D's purple. The card is a still picture, so there's no colour cycle.
- `public/og.png` was redrawn, and its tag now asks for `og.png?v=nib` so apps fetch the new one.

## The daily moves to the cloud (2026-10-11, branch `daily-cloud`)
- **The owner's call:** run the daily in the cloud, so it doesn't depend on the owner's Mac. The local scheduled task stopped on its first night, waiting for a permission prompt nobody was awake to answer.
- **Now:** a Claude Code routine on the owner's account, "Diplets daily puzzle", runs in Anthropic's cloud with no permission prompts, and pushes each new day straight to `main` once tsc, vitest and the build pass. The owner OK'd deploying to `main` unattended: it's a word puzzle, not a critical service.
- **Schedule:** 04:07 and 05:07 UTC. Routine schedules are in UTC, so the run an hour apart keeps one just after midnight Eastern in both daylight and standard time; the other finds the day already in and stops.
- **No browser look** in the cloud: the daily tests check each puzzle against the word list and the pool's rules, and the build must pass. A failed check goes to a `daily/{date}` branch for the owner instead of `main`.
- **The local task** (`daily-puzzle` in the Claude app) was removed, so only the cloud routine runs.

## Back to Strokes, at /strokes/ (2026-10-13, branch `strokes-golf`)
- **The owner's call:** the game is Strokes again, everywhere it said Diplets, and the site goes back to https://funklunsford.github.io/strokes/.
- **What changed:**
  - the wordmark (STROKES), page title, link-preview tags, share card, its title and saved file (`strokes-8.png`);
  - the README (its opening is back to before the Diplet rename), the daily runbook, `/daily`, and what `scripts/deploy.sh` writes;
  - the tab icon, the wordmark's S again (`scripts/favicon.ts`);
  - the deploy target (`scripts/deploy.sh`, `scripts/setup-deploy-key.sh`) and every link, which point at `funklunsford/strokes` and /strokes/. The site's repo is renamed back with the merge. Links shared to /diplets/ in the last few days get a 404; the older /strokes/ links work again.
- **The drip moves to the O.** The D it hung from is gone. Under the S it read as a cedilla (ŞTROKES), so it hangs from the O's right-hand arc instead: the same arc as the D's bowl, at the same spot. The nib's ink stays the purple of the letter that drips (`.nib-ink`, `drawNib`).

## Golf scoring (2026-10-13, branch `strokes-golf`)
- **The owner's call:** a solve is named like a golf score, by the strokes over the lowest possible: Ace (0 over), Albatross (+1), Eagle (+2), Birdie (+3), Par (+4), Bogey (+5 or 6), then "+7 over" and so on (`scoreName` in `src/golf.ts`).
- **Where it shows:**
  - the finish line ("TOWER in 17 strokes · Birdie", with ⭐ for an Ace);
  - the celebration, which plays for an Ace as it did for a Perfect and now says "Ace!";
  - the share card's badge (a gold "★ ACE", otherwise the name in grey);
  - "aces" in place of "perfect" in the record of dailies;
  - a line in How to play.
- **Not renamed:** the daily runbook and the difficulty scripts still say a simulated player "makes par" when it reaches the lowest possible strokes. That's the analysis's own term, not the player's score.

## The nib becomes a golf club (2026-10-13, branch `strokes-golf`)
- **The owner's call:** with golf scoring, the mark before the name should be both a nib and a golf club. Of the sketches (a club with a nib for its head, the same with a ball, the upright nib with a ball, and a nib crossed with a club), the owner chose the club with a nib head and a ball.
- **The mark** (`CLUB` in `src/nib.ts`):
  - the gold nib, lying on its side as the club's head, its purple-inked point (the toe) towards the name;
  - a steel shaft from its heel up to a grip;
  - a golf ball by the toe.
- **Weight:** the shaft (0.16) and grip (0.24) were thickened at the owner's ask, from 0.07 and 0.14, so the club flows with the letters, whose strokes are about 0.3 across.
- **On load** the club drops in, ink climbs the head (running through the colours to purple, as before) and the ball rolls into place by the toe. With less motion it's all there at once.
- **The name is spaced from the whole club,** ball included (`MARK_PROFILE`, `afterMark`).
- **The link preview** (`drawClub` in `src/share.ts`) draws the same club. `public/og.png` was redrawn, and its tag asks for `og.png?v=golf`.

## No mark before the name (2026-10-13, branch `strokes-golf`)
- **The owner's call:** remove the graphic before the S (no nib, club or tee; a tee made from the nib was sketched and set aside). The header and the link preview show the name alone; the O keeps its drip.
- **Gone with it:** `src/nib.ts`, the club's styles and the ink's colour cycle (`.nib-ink`), and the lead shape `spaced` took for it. `public/og.png` was redrawn without it.

## No drip on the O (2026-10-13, branch `no-drip`)
- **The owner's call:** take the drip off the O too. The header's name is now just the strokes that build it, like the words in play.
- **Gone with it:** the drip's shape and motion in `src/components/maze/Masthead.tsx` (`DRIP`, the neck and teardrop outlines, `Drip`).
- **Unchanged:** the header's height (the room under the name predates the drip), and the link preview and share card, which never drew it.

## Telling the Puzzle Playlist (2026-10-13, branch `playlist-done`)
- **What:** the Puzzle Playlist (`~/Code/playlist`, to be at https://funklunsford.github.io/playlist/) opens each day's puzzles in turn and ticks each one when you come back. It can't see into other sites, but Strokes shares its origin, so Strokes says when it's done.
- **How:** solving today's daily writes `puzzle-done:strokes:<local date>` = `{ at }` to localStorage, next to the result. An earlier day's (`?day=`) doesn't.
- **Why a key of its own:** the playlist reads one key per game, so it doesn't depend on how Strokes keeps its results.

## Only the confetti for an Ace (2026-10-13, branch `confetti-only`)
- **The owner's call:** remove the full-page display after an Ace (the goal word drawn over the whole page, with "Ace!" and the solve under it, until a tap) and keep the confetti.
- **Now:** on an Ace the confetti pops out of the word on the board and falls away over the page as before, then it's gone (3.2 s).
  - The page shows through and stays in play throughout. The confetti's canvas takes no clicks or taps and is hidden from screen readers, and it no longer takes Enter or Space (`Celebration` in `src/celebration/Celebration.tsx`).
  - Watch again replays it, from the start if it's still falling.
- **With less motion** nothing plays, and Watch again is hidden. Before, it held the confetti still under the "Ace!" card.
- **Gone:**
  - the goal word's stage (`src/celebration/plain.ts`), the text card and its styles, and the confetti's hand-off to them;
  - in development, `?celebrate` and Preview celebration. Preview Perfect is now Preview confetti, and `?perfect` still plays it.
- **Kept, but no longer played:** the 4-letter game's one day scene (`src/daily/days/2026-10-06.ts`), with its contract (`src/celebration/scene.ts`), tests and runbook (`docs/daily-celebration-prompt.md`). Nothing loads it now that `celebrationFor` is gone.

## Difficulty at random, not by the day of the week (2026-10-13, branch `random-difficulty`)
- **The owner's call:** keep drawing from the easiest, middle and hardest thirds of the pool, but pick each day's third at random instead of by a weekly rhythm.
  - The rhythm was: Monday and Tuesday the easiest third; Wednesday, Thursday and Sunday the middle; Friday and Saturday the hardest.
  - Drawing every day from the hardest third was considered first and set aside: it would use up that third in about four months.
- **How:** `scripts/daily.ts` picks the third with the date's seeded random, the same generator that then shuffles the candidates. So the same date and history still list the same candidates.
  - Over 50 years of dates the picks are fair: a third each, the same as the day before a third of the time, and no pattern by weekday.
  - Streaks still happen, as with any fair draw. The fortnight from October 14 has three easy days, then four hard ones, and only one middle day.
- **Supply:** the thirds now run down together. The 396 unused puzzles (134 easiest, 134 middle, 128 hardest) last about 13 months at one a day. Under the rhythm the middle third, drawn three days a week, would have run out first, in about ten months.
- **The pool, not the word list, is the limit:**
  - It holds 420 puzzles (`POOL` in `scripts/mazes.ts`), chosen from 9,791 candidates over the same words.
  - When the day's third runs low, the script says to regenerate the pool with a new seed (`scripts/mazes.ts --letters 5`).
  - The nightly routine only adds day files, so regenerating is for the owner, or a session asked to.

## The pool in a file of its own, and nearly three times bigger (2026-10-13, branch `pool-file`)
- **The owner's call:** grow the pool so the dailies don't run out, and stop every visit from downloading it.
- **A file of its own:**
  - `scripts/mazes.ts` writes the pool to `public/pool-5.json` (`pool.json` at 4 letters), beside the maze.
  - The game loads the maze on every visit, and the pool only for the freshPuzzle flag or dev's New start & goal (`loadPool` in `src/MazeApp.tsx`).
  - A visit's 5-letter maze download drops from 79 KB to 43 KB gzipped (374 KB to 136 KB raw).
  - The maze files are otherwise unchanged. The 4-letter pool was moved as it was, not rebuilt.
- **1,200 puzzles, up from 420,** with the same rules and seed (7):
  - 300 at each of 12–15 strokes (13.5 on average), all tricky and holding out against working back from the goal;
  - from 65,957 candidates in 7 minutes;
  - par chance median 2% (0–25%); every puzzle has a trap, 111 into a pocket;
  - 666 different start and goal words.
- **Supply:** 1,196 are unused (four of the seven days so far are in it, and are skipped as used). At one a day that's about three and a quarter years, into early 2030.
- **Why not bigger:** 12-stroke puzzles set the limit: few keep the rules, and they dry up fast.
  - A pool of 2,000 (500 at each stroke count) gave up after 200,000 candidates with 361 at 12 strokes. The first 105 had come within about 10,000.
  - So a new `--seed` will bring fresh 13- to 15-stroke puzzles, but mostly the same 12-stroke ones. Once those are used up, the even split by strokes may have to give.
- **Options:** `--size` (1,200 at 5 letters, 420 at 4) and `--seed` (7). The daily script's low-pool warning names the next seed.
- **Tests:**
  - They read the pools as text (`?raw`), so type-checking stays fast however big a pool gets.
  - The checks over every puzzle take up to 4.4 s each, and each has a minute's limit.
  - Rebuilding at 420 from seed 7 gives the old 420-puzzle pool exactly, so the generator's changes don't change what it builds.

## The tab icon: four stroke tiles (2026-10-14, branch `tile-icon`)
- **The owner's call:** an icon more like the game, made from its own strokes. Of the sketches (an R built from three strokes, four stroke tiles, and all nine strokes in a 3×3), the owner chose the four tiles.
- **The icon** (`scripts/favicon.ts` → `public/favicon.svg`):
  - four tray tiles in a 2×2: the long bar, the rising slash, the big arc and the big chevron;
  - each stroke drawn by the game's ink renderer in its dark-theme colour, read from `src/styles.css` so the icon follows the palette;
  - on the dark board colour, with a ledge like the cells'.
- **For 16 px:** the tiles are tinted a little more than the header's parts (16% of their colour, not 12%), and the strokes are drawn with a broader pen.
- **Size:** 15 KB (4 KB compressed), with the outlines rounded to two decimals.
- **The link** asks for `favicon.svg?v=tiles`, so browsers that kept the old S fetch the new one.

## The letter line fits its cell, and a rounder O on phones (2026-10-14, branch `cell-fixes`)
- **The owner's report:** on desktop, holding the long bar over an empty cell, its line of possible letters ran out of the tile; on phones, a formed O looked a little thin.
- **The line under a cell** (`.cell-letter`):
  - A long bar in an empty cell can become 15 letters ("→ B D E F H I J K L M N P R T U"). In a 140 px desktop cell the line wrapped onto a second line that hung below the tile. Every other stroke offers four letters at most.
  - It's one line now on every screen, as wide as the cell and cut short with an ellipsis when it's longer ("→ B D E F H I J K L M N…"), as phones already did.
  - Its width comes from the cell, never its text (`contain: inline-size`, stretched to the cell). On one line, the long list would otherwise have widened the held cell to 159 px and shifted the row mid-drag.
- **The O on phones:** five letters share a phone's row, so the widest letters are capped. The cap goes from 1.7 units to 1.85 (`MAX_DRAWN_COMPACT_5`).
  - At 1.7 (85% of its width) the O's ink was 0.87 as wide as tall, a tall oval. At 1.85 it's 0.94: nearly round.
  - Its ink stays clear of the cell's sides: about 5–6 px on a 375 px phone (8 before), and 5 px on a 320 px one.
  - A, M, Q, V, Y and W, capped the same way, come out a little wider too.
  - The test that held the O as clear of the sides as in four-letter cells now checks that it's drawn at least 90% of its width, with its ink (from the ink renderer) at least a tenth of a unit from each side.

## Hardening the nightly run and the deploy (2026-10-14, branch `security-hardening`)
- **The owner's call:** before a public launch, close the ways something other than the owner could change the live site. The plan, and what's left, is in `docs/launch-plan.md` (Security).
- **Done:**
  - a ruleset protecting `main`: no force-pushes, no deleting it;
  - the nightly run's web tools removed (WebFetch, WebSearch);
  - `scripts/check-nightly.sh` in the deploy workflow: Claude's own pushes to `main` may only add day files. If one does more, nothing publishes until the owner publishes by hand;
  - vitest 4.1.11 (fixing two critical advisories and a moderate one), with vite-node 6 as its own dev dependency for the scripts;
  - Dependabot alerts, and weekly grouped update pull requests;
  - Actions pinned to commits.
- **Installed with npm 11:** npm 10.9.2 crashed resolving vitest 4 (an internal error in its installer), so the lockfile was written with npm 11, the version CI's Node 24 uses.

## Publishing to Cloudflare Pages, for strokes.fun (2026-10-14, branch `cloudflare-pages`)
- **The owner's call:** the game moves to its own domain, strokes.fun, served by Cloudflare Pages. The steps are in `docs/launch-plan.md` ("Domain and hosting").
- **Publishing:**
  - The deploy workflow publishes to Cloudflare after GitHub Pages, both on during the switch (`scripts/deploy-cloudflare.sh`, Wrangler 4.151.0, fetched only there).
  - It makes the Pages project "strokes" on its first run, and waits, with a warning, until the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets exist.
  - It deploys `dist/` as built, after the nightly check like every publish. Cloudflare's own builds from git would publish every push and skip that check.
- **One address setting:** `VITE_SITE_URL` in `.env`. Vite fills it into the link-preview tags (`%VITE_SITE_URL%` in `index.html`), and `SITE` in `src/share.ts` reads it for the share text and card. It stays the github.io address until strokes.fun is live.
- **What's in every build:**
  - the licence notices (`public/licenses/`, which `scripts/deploy.sh` used to add only for GitHub Pages);
  - `public/boot.js`, the theme and motion set-up that was inline in `index.html`. As its own file, the content security policy can allow only the site's own scripts, with no hashes to keep in step. Vite warns that it isn't bundled; it isn't meant to be, since it must run before the page draws.
- **Headers** (`public/_headers`, which only Cloudflare reads):
  - code files cached for a year;
  - nosniff, a referrer policy, and no camera, microphone, location, payment or USB access;
  - no framing (`X-Frame-Options: DENY`);
  - the content security policy, report-only until it's been checked on the live site.

## strokes.fun is the game's only home (2026-10-14, branch `strokes-fun`)
- **The owner's calls:**
  - The game lives at https://strokes.fun from now on.
  - The old address, funklunsford.github.io/strokes/, isn't redirected, because no one uses it, and saves aren't carried over.
  - The Puzzle Playlist moves to strokes.fun too.
- **The address:** `VITE_SITE_URL` in `.env` is https://strokes.fun/. That covers:
  - the link-preview tags and a new canonical link (`index.html`);
  - the share text and the share card (`src/share.ts`);
  - a `robots.txt`, which lets everything be indexed.
- **One publish:**
  - Cloudflare Pages only (`scripts/deploy-cloudflare.sh`). GitHub Pages' `scripts/deploy.sh`, `scripts/setup-deploy-key.sh` and `npm run deploy` are gone.
  - The workflow builds on every run, and publishes from main to strokes.fun.
  - A pull request from this repo is published as a preview at `<branch>.strokes-f1a.pages.dev`. Dependabot's get no secrets, so they're tested and built only.
  - The deploy message is plain ASCII and at most 100 characters ("→" becomes "->"). Some Cloudflare API failures (code 8000000) have been reported for long messages with characters like it.
- **The content security policy is enforced:**
  - It first ran report-only on the live site, and nothing was reported.
  - No built script, three.js included, builds code from strings (`eval`, `new Function`).
  - It's checked on a pull request's preview before it reaches strokes.fun.
- **The Playlist (next):** strokes.fun/playlist/ will forward to its GitHub Pages site through a Pages Function, so it shares Strokes' origin and both repos keep publishing as they do. Strokes' comment on the "done" mark now names strokes.fun/playlist/.

## Analytics, and the Puzzle Playlist at strokes.fun/playlist/ (2026-10-15, branch `playlist-on-strokes-fun`)
- **The owner's calls:**
  - Allow Cloudflare Web Analytics.
  - Move the Puzzle Playlist to strokes.fun.
  - Leave Mountweazel on github.io.
- **Analytics:**
  - Cloudflare adds its Web Analytics script to strokes.fun's pages. The enforced security policy blocked it on the first live load (a console error; the game was unaffected).
  - The policy now allows the script (`static.cloudflareinsights.com`) and its reports. Those go to strokes.fun/cdn-cgi/rum (`'self'`), or to `cloudflareinsights.com`, the other address Cloudflare documents.
  - It sets no cookies.
- **The Playlist on Strokes' origin:**
  - `functions/playlist/[[path]].js`, a Pages Function, forwards strokes.fun/playlist/… to the Playlist's GitHub Pages site. It handles GET and HEAD only.
  - It rewrites GitHub's redirect from `/playlist` to `/playlist/` so players stay on strokes.fun, and adds nosniff and a referrer policy.
  - In the browser it's strokes.fun, so it shares Strokes' localStorage and sees the "done" mark Strokes writes (`puzzle-done:strokes:{date}`).
  - Both repos keep publishing as before. The Playlist's repo still publishes to GitHub Pages, and its changes show on strokes.fun at once.
- **Only `/playlist` runs the function** (`public/_routes.json`). Everything else is Strokes' static files, with its `_headers`. Those don't apply to the function's responses, so the Playlist keeps GitHub's headers: no Strokes security policy, which suits a page that opens other sites.
- **Mountweazel** stays at funklunsford.github.io/mountweazel/. On another origin it can't share its "done" mark, so the Playlist (in its own repo) ticks it like any other game.

## Puzzles two days ahead (2026-10-15, branch `days-ahead`)
- **Why:** each player gets the puzzle for their own date at their own midnight, but the nightly run added today's puzzle just after midnight Eastern.
  - Players ahead of New York got yesterday's puzzle again until then: about 5 hours in London, 13 in Tokyo, and up to 18 at UTC+14.
  - It was seen on the 15th: the game played No. 9 on a browser already past midnight.
- **Now:** the nightly run adds every missing day through two days after today (Eastern).
  - UTC+14 starts each date ten hours before UTC, so the next day must already be published at Eastern midnight. The second day is spare, so one failed night does no harm.
  - The routine's prompt says so (step 2, `date -d '+2 days'`), as does `docs/daily-prompt.md` ("On a schedule").
  - The first run after the change adds three days at once (16 to 18 October).
- **The game needed nothing:**
  - `dayFor` plays the latest puzzle up to the player's date, so the ones ahead wait unseen. A new test pins that down.
  - The record of dailies stops at the day being played.
  - `?day=` refuses future dates on the live site.
  - Future puzzles are in the published code, as they always were for the day's own puzzle. Without leaderboards or prizes, that's acceptable.

## No Puzzle Playlist at strokes.fun (2026-10-15, branch `no-playlist-route`)
- **The owner's call:** strokes.fun/playlist shouldn't exist. The Puzzle Playlist's home is its own GitHub Pages site, https://funklunsford.github.io/playlist/. The owner's new domain, funklunsford.com, forwards /puzzleplaylist there and /strokes here.
- **Removed:** the forwarding Pages Function (`functions/playlist/`), `public/_routes.json`, and the `_headers` note about them. strokes.fun is Strokes' static files only.
- **Strokes' "done" mark** (`puzzle-done:strokes:{date}`) is still written, but the playlist is on another origin and can't read it, so it ticks Strokes when you come back.
- **Don't put the forward back:** this replaces "Analytics, and the Puzzle Playlist at strokes.fun/playlist/" above, for the playlist. The analytics part stands.

## Stroke colours (2026-10-16, branch `stroke-palette`)
- **A setting:** Settings > Stroke colours: Earth (the game's own, and the default), Bright, Ocean or Clear. Under the choice, the tray's nine strokes show the palette as it's picked.
  - It's saved with the other settings (`strokes:prefs`).
  - `public/boot.js` puts it on the page (`<html data-palette>`) before the first paint, so there's no flash of Earth. The game sets it again as it starts, in case a browser kept an older `boot.js`.
- **Where the colours live:**
  - `src/styles.css` has Earth in the themes' own rules, and the others by `data-palette`.
  - `src/palettes.ts` has them all again, for the result card, which is drawn without the page's CSS.
  - `src/palettes.test.ts` checks the two agree, and that every colour is at least 4.5:1 against a letter's cell in its theme.
- **The result card is in the player's palette,** in its light colours since the card is on paper. The link preview (`og.png`) and the tab icon stay Earth: they're the site's.
- **The palettes:**
  - Bright: Earth's hues, as vivid as they go.
  - Ocean: blues, teals, greens and violets.
  - Clear: for colour blindness. Red-green colour blindness (about 1 man in 12) loses red against green but keeps lightness, and blue against yellow. So Clear is blues, near-neutrals and yellows, each at three lightnesses.
  - Clear and Ocean were each given to the strokes by trying every assignment and keeping the one that sets alike shapes farthest apart. Clear keeps Earth's roles where it could: the long bar blue, the bar orange, the small chevron wine.
  - There's no one-colour palette: a stroke's colour is how a letter shows which strokes built it.
- **Measured.**
  - Method:
    - Differences are CIEDE2000; about 2 is just noticeable side by side.
    - Colour blindness is simulated as protanopia, deuteranopia and tritanopia (Machado, Oliveira and Fernandes, 2009), in light and dark.
    - "Alike shapes" are the pairs most easily mistaken: the long bar and the bar, the three slashes, the two chevrons, the arc and the bowl, the long bar and each long slash, and the bar and the tail.
  - Results:

| | Contrast with the cell (light; dark) | Closest two strokes, most eyes (light; dark) | Closest alike shapes, colour-blind | Closest any two, colour-blind |
|---|---|---|---|---|
| Earth | 5.9–8.1; 5.3–8.1 | 7.6; 10.9 | 7.1 | 0.5 |
| Bright | 4.7–7.7; 5.6–11.0 | 14.7; 16.3 | 7.1 | 0.3 |
| Ocean | 4.6–10.3; 5.1–12.5 | 11.7; 12.1 | 9.4 | 1.7 |
| Clear | 4.5–11.3; 5.5–12.8 | 11.2; 14.4 | 15.6 | 5.7 |

  - Only Clear keeps every pair apart with colour blindness. In each of the others, some strokes of different shapes take the same colour.

## The lowest-stroke route after the win (2026-10-22, branch `route-after-win`)
- **The owner's call:** the lowest-stroke route stays hidden until the puzzle's solved.
  - The side card's "Show lowest-stroke route" (see "Modifiers and feature flags") is gone. It showed a route at any time, and every word within reach of the current one with its cost, which gave the game away too.
  - Before a win, the side card has only Restart (and Dev, in development).
- **After the win:** a quiet pill beside Share and Watch again, "See the lowest-stroke route", opens it under the buttons.
  - "Lowest-stroke route · 13 strokes", over the words drawn as the path card's chips, each with its step's strokes: CRUMB, +2 GRUMP, +3 CLUMP, +3 CLUNK, +2 CLINK, +3 SLINK.
  - The chips wrap: one row on a desktop, two rows of three on a 390 px phone.
  - The pill then says "Hide the lowest-stroke route". It's a button with `aria-expanded`; the route is a list named by its total, and each word is read by name.
- **Solved today already:** the note offers it too, as a link: "Solved today in 13 · perfect ⭐. Play it again any time, share it, or see the lowest-stroke route." It opens under the note.
- **It closes again** on Restart, with a new puzzle, and at the first stroke of playing again, so a later win offers it afresh.
- **With ink pots on,** it's the pots' best walk, charged as the game charges it: banked ink pays first (a drop on the chip, as in the path) and going back is free, so the steps add up to the best with pots.
  - `walkSteps` (`src/inkpots.ts`) lists a walk's steps by `scoreWalk`'s rules. Tests check the two agree, and that every 5-letter daily's route adds up to its best, with pots and without.

## The tray's C, centred on phones (2026-10-22, branch `tray-c-centre`)
- **The owner's report:** on a phone, the C (the big arc) sat a bit too low in its tray tile.
- **Why:** the nib. It draws the C's lower curve broad and its top thin, so the C's ink sits low: its balance point is 0.19 units below its outline's middle. Centring by eye (`opticalOffset`, see "Sharing, settings, and centring by eye") weighed only the centre line, which is level, so it never lifted the C.
  - It shows most on phones. There the C's tile is the tray's biggest (72 px, 25 px a unit against 17 on desktop), so its ink sat 3.3 px below the tile's centre (1.7 px on desktop).
  - It isn't the 40 px the tray assumes for a tile (`TRAY_PX_PER_UNIT`). That only sets the pen's least width, and the offsets come out the same for 40 to 60 px.
- **The fix** (`opticalOffset` in `src/ink.ts`): up and down, a stroke is now centred halfway between its outline's middle and its ink's balance point (the centroid of its outline's area). Across, it's still halfway to its centre line's balance point: the ink's would move the small chevron 3.3 px towards its thin arm, though its point already keeps it looking centred.
  - The C goes up 2.4 px on phones and 1.6 px on desktop.
  - Turned round in the tray (D's arc), the C looked high, its broad curve being on top. It comes down 2.6 px (1.7 on desktop).
  - The bowl comes down 0.9 px (0.6 on desktop), and goes up as much turned as in S's top.
  - No other stroke moves more than 0.3 px, and nothing moves across.
  - How to play's practice tray and the Settings swatches use the same centring: their C goes up 1.5 px and 0.8 px.
  - A test (`src/ink.test.ts`) holds the C lifted and a reversed C lowered, and the straight strokes and chevrons shifted less than 0.03 units.
- **Measured** in Chrome, in px from the tile's centre (+ is down), before → after. "By eye" is halfway between the outline's middle and the ink's balance point, which the centring now evens out. On 375 and 430 px phones the C, its tile also 72 px, measures as at 390.

| Up and down | Phone (390 × 844): outline | Ink | By eye | Desktop (1280 × 800): outline | Ink | By eye |
|---|---|---|---|---|---|---|
| C | −1.4 → −3.9 | +3.3 → +0.9 | +0.9 → −1.5 | −1.5 → −3.1 | +1.7 → +0.1 | +0.1 → −1.5 |
| C turned (D's arc) | −1.5 → +1.1 | −6.7 → −4.1 | −4.1 → −1.5 | −1.5 → +0.2 | −5.0 → −3.2 | −3.2 → −1.5 |
| Bowl | −1.5 → −0.6 | −3.3 → −2.4 | −2.4 → −1.5 | −1.5 → −0.9 | −2.7 → −2.1 | −2.1 → −1.5 |
| Bowl turned (S's top) | −1.4 → −2.3 | +0.2 → −0.7 | −0.6 → −1.5 | −1.5 → −2.0 | −0.4 → −1.0 | −0.9 → −1.5 |
| Every other stroke and way round | −1.1 to −2.0 → −1.3 to −1.7 | −1.4 to −1.9 → −1.3 to −1.7 | −1.3 to −1.8 → −1.5 | −1.1 to −1.8 → −1.3 to −1.7 | −1.4 to −1.9 → −1.3 to −1.7 | −1.3 to −1.7 → −1.5 |

  - Across, nothing changed: the C's outline is still 0.7 px right of the centre on phones (0.5 on desktop) and its ink 2.0 px left (1.4).
  - Every stroke sits 1.5 px above its tile's centre, on every screen. The tray's svg is inline, so the line it sits on adds a descender's gap under it, and each tile comes out 3 px taller than wide (72 × 75 on a phone). That's left as it is: it isn't the C's fault, and it lifts every stroke alike. It depends on the button's font, though, so it may differ outside Chrome.
- **The link preview** (`og.png`) has the same fault: its C's ink is 5.5 px below its tile's centre (the card has no lift). `trayTile` in `src/share.ts` uses `opticalOffset`, so the card's C will sit 2.8 px higher when `og.png` is next drawn. It hasn't been redrawn here.

## Easycore (2026-10-22, branch `easycore`)
- **The owner's call:** a Difficulty choice in Settings, **Easycore · Classic · Hardcore**, with Classic the default. Easycore is for middle and early high school players: a daily of its own, shorter (lowest 5–8 strokes over 2–3 steps, against Classic's 12–15 over 4–8) and built from simpler words. Rules, hints and golf scoring are Classic's; Hardcore is unchanged.
- **Behind a flag:** `easycore` in `src/flags.ts`, on for everyone since 2026-10-22, after the owner tried it live with `?flags=easycore` (`?flags=-easycore`, or Dev, turns it off). Off, the game and Settings are as before, with the Hardcore switch. Easycore is 5 letters only; at 4 letters a stored Easycore plays Classic.
- **Simpler words** (`data/simple-5.txt`, 1,299 words; `scripts/familiar.ts --letters 5 … scowl-20.txt`):
  - The everyday words also in SCOWL size 20, its "most common words". The list creator the other sizes come from now starts at 35: asked for size 20 it returns its notice and no words. So size 20 comes from SCOWL 2020.12.07, the last release with sizes under 35 (its `english-words.10` and `.20` and `american-words.10` and `.20`; the README says how). Its notice heads the list and is in `public/licenses/SCOWL-v1.txt`.
  - Size 20 has 1,365 lowercase 5-letter words; 1,354 of them are everyday words.
  - A hand review left out 55 (`data/not-simple-5.txt`). 17 aren't right for 11- to 15-year-olds: ABUSE, BEERS, BIGOT, BOMBS, DRUGS, DRUNK, IDIOT, KILLS, LAGER, LOVER, MORON, NAKED, SEXES, SHOOT, SLAVE, SOBER, WINES (the owner had the violent ones, BOMBS, KILLS and SHOOT, dropped). 38 they wouldn't know or use: rare or formal (AXIOM, BANAL, BORNE, CIRCA, CRASS, CREED, CYNIC, DATUM, DEEMS, DEITY, DETER, DOGMA, ETHIC, FARCE, GLEAN, INANE, INCUR, INTER, IRATE, LEACH, LIBEL, NODES, PARSE, SECTS, TERSE), odd forms (CASED, CHARS, DOOMS, KEYED, MUCKS, RENDS, ROUTS) and British (CHAPS, FIVER, LORRY, MAINS, PENCE, VICAR).
  - Kept, by the owner's call: everyday words for death and danger (DEATH, DYING, FATAL, BLOOD, SKULL, CRIME, THEFT), DEVIL, CURSE, BIBLE, and words whose first sense is innocent (BALLS, SCREW, CRACK, JOINT).
  - Every familiar word still counts in play. Only the puzzles are built from simple words.
- **The pool** (`scripts/mazes.ts --letters 5 --easy` → `public/pool-5-easy.json`, in the dailies' pool's format, 390 KB or 48 KB compressed, loaded only for Easycore). There are few enough pairs of simple words to try every one (the dailies' pool draws at random, which here would mostly draw the same ones again). Pairs passing each test in turn, by lowest strokes:

  | | all | 5 | 6 | 7 | 8 |
  |---|---|---|---|---|---|
  | lowest strokes 5–8 over the whole maze (of 843,051 pairs) | 6,212 | 1,004 | 1,601 | 1,163 | 2,444 |
  | …equalled by a route through simple words alone | 2,118 | 488 | 724 | 259 | 647 |
  | …of 2 or 3 steps | 2,107 | 488 | 724 | 259 | 636 |
  | …with 2 doors or more at each end | 2,039 | 470 | 697 | 249 | 623 |
  | …made at par 20% of the time or more, one way round | **1,791** | 461 | 661 | 187 | 482 |
  | the pool | **1,100** | 304 | 304 | 187 | 305 |

  - A puzzle's lowest strokes are over the whole maze, so the score is honest; its stored route is the simple one with fewest steps.
  - Par chance is `parChance`'s simulated player. The threshold of 0.2 drops 248 pairs; a puzzle goes the way round that clears it (either, at random, if both do). Higher thresholds thin the longer puzzles fast (measured before BOMBS, KILLS and SHOOT went, which moves these by about 1%): at 0.3, 1,508 pairs are left (128 at 7 strokes, 344 at 8); at 0.4, 1,183 (89 and 232); at 0.5, 855, too few for the pool.
  - **Base words first.** Taking the pairs in a plain random order, 695 of 1,100 puzzles had no base word at either end, mostly plurals and verb forms (TALKS 24 times, FILES 22). Classic's rule (base words at both ends) can't be a requirement: before the par test it leaves 569 pairs at 5–8 strokes, and 730 at 5–9. So pairs with base words at both ends come first (all 552), then at one end (all 122), then the rest (426 of 1,117), each in a seeded random order.
  - Spread evenly by lowest strokes as far as each has enough: 7 has only 187, so 5 and 6 take 304 each and 8 takes 305. 5–8 strokes is enough; no need to widen to 9.
- **The pool as built:** lowest strokes 6.45 on average; 594 routes of 2 steps and 506 of 3; par chance 0.20 to 0.99 (quartiles 0.32, 0.45, 0.63; mean 0.49, against 0.03 in Classic's pool); 5 tricky by Classic's measure; 374 need no C, I or V, 584 one at the start or goal, 142 a stepping stone; 486 different start and goal words, STALL most (21). The classic pool still rebuilds byte for byte.
- **Definitions:** 693 words appear in Easycore's puzzles (start, goal and every word on a lowest-stroke route, which is where hints come from), 173 of them not simple. Seven first senses weren't right for children and are rewritten in `data/definitions-extra.tsv`: MALES (spermatozoa), TEATS (a mammary gland), PANTS (women's underpants), DIVES (a disreputable nightclub), RAVED and RAVES (all-night techno parties), STOPS (a gambling card game). Classic's hints get the same. Many more first senses are odd for a child (KITES as forged cheques, SHELL as ammunition, SHOES as "a particular situation"), but not unsuitable: they're for the definitions review still to do.
- **The daily** (`src/easycore.ts`): the pool in a seeded random order (`seededRandom`, a fixed seed), indexed by the daily's number, with a new order each time round, so nothing repeats in three years. Numbered and dated like Classic (No. 17 today), from the player's local date; every date from the first has a puzzle, and `?day=` replays any up to today. Today's is MIXED → MINED → LINED (6).
  - **The pool is frozen once shipped:** the order depends on its length and order, so rebuilding it changes every date's puzzle, past ones too, and orphans kept results. A test pins two dates' puzzles.
  - A plain shuffle can bring a word back soon: in the first round, 11 days of 1,100 share a start or goal word with the day before, and 82 with the week before. Classic rests words for 30 days; this doesn't.
- **Results and record:** kept as `strokes:result5e:{date}`, and the record (solved, aces, streak, best streak) is over Easycore's results only, as "Your Easycore dailies". An Easycore win today writes the Playlist's done mark too.
- **Settings** (`Settings.tsx`): with the flag, the Hardcore switch gives way to **Difficulty**, before Playing, its note saying what the choice is:
  - Easycore: "Shorter puzzles with everyday words: its own daily."
  - Classic: "The daily puzzle, with hints if you need them."
  - Hardcore: Hardcore's own note, as before ("…Turning it on starts the puzzle over.").
- **Storage:** `strokes:difficulty`, Classic by default. A player with `strokes:hardcore` on starts on Hardcore, and the old key is still written alongside, so the two agree (and a rollback keeps Hardcore). `src/hardcore.ts` keeps Hardcore's rules.
- **Switching:** Classic ↔ Hardcore as before. To or from Easycore plays that difficulty's daily, from its start, or with "Solved today in 6 · perfect ⭐" if it's done, as on a return visit. Easycore → Hardcore plays the classic daily from its start, in hardcore.
- **Around the game:** "· easycore" on the result line; the dateline says "No. 17 · Easycore · Thursday, October 22" (on phones it wraps to two lines more often than Classic's: today's from 360 px down, the longest, "No. 359 · Easycore · Wednesday, September 29", at 390 px, where Classic's longest wraps only at 320 px; the header makes room); the share card says EASYCORE in its date line and on a badge in the page's calm green (`--ok`, #497c38, as a ski run's easiest slopes are green), and the share is titled "Strokes No. 17 · Easycore" (`strokes-easycore-17.png`). How to play adds "Want it easier? Choose Easycore in Settings: shorter puzzles with everyday words, and a daily of their own." With the flag, its Hardcore line says Choose for Turn on.
- **Tests:** the pool (its shape, simple words, a simple route at the whole maze's lowest strokes, no pair twice, two doors at each end, par chance as stored); the simple words; the date pick (the same each time, each puzzle once a round, two dates pinned); the setting and its Hardcore migration; Easycore's results and record kept apart; the share's label and title.
- **Checked in headless Chrome** at 1280×800 and 390×844: Settings with the flag off is as before; with it on, Easycore swaps in its daily; a win keeps `strokes:result5e:2026-10-22` and the done mark and no classic result; Classic brings back the classic daily; Easycore again says "Solved today"; Easycore → Hardcore and Hardcore → Classic; an old Hardcore switch shows as Hardcore; the flag turned on and off in Dev swaps the daily; `?day=2026-10-15` plays Easycore No. 10; `?letters=4` with Easycore stored plays the 4-letter Classic daily with the Hardcore switch. The dateline doesn't scroll sideways at 320 px.

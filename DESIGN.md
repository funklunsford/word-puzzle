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
- **More practice in How to play:** once the five moves are done, it asks "Want to practise other letters?", with a **Practise more letters** button. Practice then carries on from the letter just made to another a move or two away, letter after letter, with the whole tray, avoiding the last four letters made (and E, just made into F). The head says "Practice" and counts the letters made.
  - The ghost shows the first move of a shortest way to the letter, worked out with the editor's own rules (`planTo` in `src/tutorial.ts`: a stroke goes only where it grows towards a letter; from the tray, only the way it sits there, then it's turned in place). The line says what to do in general terms ("Make an R: drag the stroke shown in from the tray."), since player-facing text calls every stroke just a stroke. Straying more than a step's three strokes from the letter says "Not quite: make an R." with Start over.
  - X and Z have no letter a move or two away, so practice starts again from another letter after them.
- **The dateline** is just the number and the date ("No. 2 · Wednesday, October 7"): the 5-letter game no longer says "5 letters" there. The share card still does, since the phone's puzzle that day is a different one.
- **Tests:** the record (each day once, streaks broken by a missed day, nothing after the day played) and times; every practice letter offered from every letter is made by doing the moves shown, two at most; the practice's lines.

## 5 letters on phones for everyone (2026-10-08, branch `five-letters-on-phones`)
- **The `fiveLetters` flag is on by default:** every device gets the 5-letter game, with its dailies (`src/daily/days-5/`), definitions and results. `?flags=-fiveLetters` or `?letters=4` still plays the 4-letter game, whose days, scenes and results are kept.
- **Players who were on the 4-letter game** keep those results under their old keys; their 5-letter record starts fresh.
- **Next:** the daily runbook still checks in a 4-letter day and builds its celebration scene, which only `?letters=4` shows now.

## Phone fixes from the 5-letter playtest: margins, scrolling, a held stroke, Reset, icons (2026-10-08, branch `ui-fixes`)
- **An O's side margins** (`MAX_DRAWN_COMPACT_5` in `WordEditor.tsx`): five-letter phone cells stay 2.4 units wide, but no formed letter is drawn wider than 1.7 units there (was 2). Only the widest letters narrow (A, M, O, Q, V, Y by 15%; W more), so every letter keeps its height. Widening the cells for the same room would have shrunk all five letters. An O's ink now keeps as clear of the cell's sides as at four letters (6.4 px at 375 px, measured). The first stroke of an O or A shifts in a little as the letter forms, as W's always has.

  | Phone width | Cell (unchanged) | O's ink, before → now | Room each side, before → now |
  |---|---|---|---|
  | 360 px | 63 × 95 | 59 → 51 px | 2.0 → 6.0 px |
  | 375 px | 66 × 99 | 62 → 53.5 px | 2.1 → 6.4 px |
  | 430 px | 77 × 116 | 72 → 62 px | 2.5 → 7.4 px |
- **Scrolling from the play area:** the whole editor (word and tray) was `touch-action: none`, so a swipe there never scrolled. Now it's `manipulation`, and the editor claims a touch only when it lands on a stroke (placed, or a tray tile), with a non-passive `touchstart` listener that cancels it before the page can scroll (cancelling `pointerdown` doesn't stop a scroll). While a stroke is held, every touch is claimed, so a drag never scrolls the page and a second finger can't scroll or zoom. Tray tiles stay `touch-action: none` too, except in a locked step or a won game, when nothing can be dragged and every swipe scrolls.
  - **Where a swipe scrolls:** the definition, the cells' labels and the room around a letter's strokes, the gaps between cells and tiles, the tray's sides, the letter guide and the board's padding, as well as everything outside the board.
  - **Where it doesn't:** a swipe that starts on a stroke drags it. A drag up from the tray looks just like a swipe to scroll down, so the two can't be told apart as the finger starts to move. Making tiles scroll would need press-and-hold to pick a stroke up (the owner's call).
- **Holding a stroke on a phone:** a finger pressing a placed stroke tints it the red a mouse hover gives it (`--remove`), as long as it presses, so the stroke a tap removes is plain before letting go. Not on the second tap of a double tap (which turns it), and not once it moves (it lifts). Letting go removes it, like a click; sliding off and letting go puts it back. Checked with synthetic touch presses: held 600 ms, the stroke is red; released, the tint goes; moved 30 px, it lifts untinted and goes back to its spot; a double tap turns a V untinted.
- **Score card centring:** the score panel is as wide as its widest line (was a fixed 200 px), so the goal and the stroke count sit centred as a pair: at 1280 px they were 8 px left of the card's centre, now 0. On phones the pair and the details below it are centred (were left-aligned), and HARDCORE goes under the count, so "24 strokes" and the tag still fit beside the goal at 320 px.
- **Reset step is now Reset.** Its button takes the word back to where the step began.
- **Icons on Undo, Reset and Hint** (`StepIcons.tsx`): a hooked arrow, a loop coming round to its start, and a bulb, drawn like the toolbar's icons as round-ended lines in the button's colour (ink, or muted when disabled), in both themes. The bulb's glass is lit in gold while there's a hint to take. The labels stay, and the icons are hidden from screen readers. Desktop pills are 146 px wide (were 124) to fit them; on phones the three share one row down to 320 px, with every Hint label (Hint, Next word, Hint used) inside its button.
- **Tests:** no formed letter is drawn wider than its phone cap, and the five-letter O has at least the four-letter O's room as a share of the row.

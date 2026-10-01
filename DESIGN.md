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
| `P`  | Small arc (half circle, half height), rotates | B P S J U |

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

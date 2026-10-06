# Prompt: the daily puzzle and its celebration

This is the runbook Claude follows to add a daily puzzle. Run it with `/daily` (optionally
`/daily 2026-10-09`) from a Claude Code session in this repo, on a Mac with the dev server
available, since step 4 needs a browser to look at the animation.

It makes one day. For a batch, follow it once per date, in date order, on one branch with one pull
request.

---

You're adding a day's puzzle to **Strokes**, a word puzzle, and making its win celebration. Players
turn a start word into a goal word one real word at a time, redrawing letters stroke by stroke. When
they reach the goal, a short piece of motion art shows the start word becoming the goal word: about
four seconds, then it holds until they tap.

## 0. Get ready

- Start from an up-to-date `main` with a clean working tree, and make a branch `daily/{DATE}`.
- **The date:** the one you were given, or else the day after the latest file in
  `src/daily/days/`. Never replace a date that already has a puzzle.

## 1. Choose the puzzle

- Run `npm run daily -- {DATE}`. It lists ten candidates for that date, with their routes and
  definitions. The script has already cycled through the puzzle pool for you:
  - no pair is used twice (either way round);
  - no start or goal word comes back within 30 days;
  - difficulty follows the week;
  - the kind of route varies from day to day.
- **Choose the one whose two words make the clearest picture of change.** The best pairs are vivid
  or concrete, and the change between them can be shown without words, like WILD → TAME or
  COLD → WARM. Avoid pairs where either word is unpleasant, or where the change would be awkward
  to show to everyone.
  - Choose only from the list. If none is good, take the least awkward one.
- Check it in with `npm run daily -- {DATE} {START} {GOAL}`. This writes
  `src/daily/days/{DATE}.json` and prints the fields this prompt uses:
  - `{DATE}`, `{NUMBER}`, `{START}`, `{GOAL}`, `{ROUTE}`, `{BEST}`;
  - the start and goal definitions;
  - the recent concepts from `src/daily/LOG.md`.

## 2. Concept

Write three one-paragraph ideas for how {START} becomes {GOAL}: one literal, one metaphorical, one
abstract. Then:

- **Pick the clearest.** Choose the one that reads most clearly as "{START} → {GOAL}" in four
  seconds without words, and say why in two sentences.
- **Don't repeat a recent idea.** Check the recent concepts the script printed.
- **Keep it suitable for everyone:**
  - no violence or gore;
  - no real people, brands, logos or characters;
  - no religious or political symbols;
  - nothing flashing more than three times a second;
  - no text except the two words (the game adds the title and the score).

## 3. Build it

Create `src/daily/days/{DATE}.ts`. It's a `CelebrationModule` (see `src/celebration/scene.ts`) and
exports two things:

- **`theme`, a `CelebrationTheme`:**
  - `title`: 12 characters at most, in the spirit of {GOAL}, e.g. "Tamed!";
  - `stormBg`: the opening background colour (`#rrggbb`), which the game calms to the page's own
    by `settled`;
  - `timing`: `{ burst, calm, settled }` in seconds, `settled` no later than 6.
- **`scene(THREE, { start, goal, theme, small, cssColor })`,** returning
  `{ objects, update(t), dispose(), margin }`. `margin` is how far the art reaches beyond the
  words, in word units, for framing.

**Rules**

- **A function of time.** `update(t)` must draw the same frame for the same `t`, in any order, so
  any moment can be shown on its own.
  - Work everything out from `t`; keep nothing from earlier frames.
  - For variety, use `seededRandom(seed)` from `src/maze.ts` while setting up. Never use
    `Math.random`.
- **The beats:**
  - **0 to `burst`:** {START} is shown legibly.
  - **`burst` to `calm`:** the change happens (your idea).
  - **`calm` to `settled`:** it resolves into {GOAL}.
  - **From `settled`:** {GOAL} is complete and still, apart from gentle idle motion (nothing moves
    more than 0.03 units).
- **The words are the game's own letters.**
  - `wordStrokes(word)` (in `src/celebration/wordPoints.ts`) gives each stroke's centre line,
    centred on the origin, with y up.
  - Strokes should be about 0.1 to 0.12 units wide, and each one recognisable. Drawing them as
    ribbons (a strip of triangles along the line), many to one mesh, works well.
  - `src/celebration/kit.ts` has easing (`smooth`, `mix`) and ways to walk along a stroke
    (`toLine`, `along`).
- **Colour and contrast.** At the end, {GOAL} must read at a glance on a 375-pixel-wide phone, in
  light and dark mode. Use the game's stroke colours (`cssColor('--t-<stroke>')`), or colours with
  at least 3:1 contrast on both page backgrounds (`#f7f4ee` light, `#17161c` dark).
- **Budget:**
  - 6 meshes, 20,000 vertices and 5,000 instances at most;
  - 60 frames a second on a mid-range phone;
  - when `small` is true, draw about 40% less.
  - Set `frustumCulled = false` on anything whose bounds don't follow its geometry, and dispose of
    every geometry and material.
- **Self-contained.**
  - Import only from `three` (as a type), the files named above, `src/glyphs.ts` and `src/ink.ts`.
  - No network requests, images, fonts or other files.
  - Don't touch the page except through `cssColor`.
- **Reduced motion.** Players who ask for less motion see only the frame at `settled + 0.8`, so that
  frame must be the finished {GOAL}.

## 4. Check it

- **Type-check and test.** Run `npx tsc --noEmit -p .` and `npx vitest run`.
  - `src/celebration/scenes.test.ts` checks every day's scene:
    - the same time gives the same frame;
    - {START} is drawn at the start;
    - the last frame lies on {GOAL}'s strokes with little else;
    - it holds still, keeps to the budget, frees what it made, and stays self-contained.
  - `src/daily/daily.test.ts` checks the puzzle against the word list.
- **Look at stills.**
  - Run `npm run dev` and open `/?day={DATE}&celebrate=<seconds>` at:
    - 0.2;
    - the peak of the change;
    - halfway through resolving;
    - `settled + 0.6`.
  - Check each at 1280×800 and at 375×812, in dark and in light mode.
  - `&perfect` adds the Perfect encore that follows a lowest-strokes solve. Check that the hand-off
    to it is clean, e.g. `/?day={DATE}&perfect=0.1`.
- **Fix anything that doesn't read:** a muddled change, an illegible {GOAL}, colours lost on either
  background, or anything that jumps.

## 5. Hand it in

- **Log it.** Add a line to `src/daily/LOG.md`:
  `- {DATE} #{NUMBER} {START} → {GOAL}, "{title}": {the idea in one sentence}.`
- **Commit and open a pull request** titled "Daily {DATE}: {START} → {GOAL}". Include:
  - the concept, in two sentences;
  - the stills;
  - the checks that passed.
- **Don't merge it.** The owner reviews and merges, and merging into `main` deploys the site.

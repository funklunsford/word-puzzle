# Prompt: the daily celebration (draft for discussion)

This is what Claude would be given each time a new daily puzzle is checked in. `{…}` fields are
filled in by the daily script.

**Not runnable yet.** The prompt relies on pieces that still need building:
- **A scene loader:** `Celebration.tsx` picks a scene by date from `src/celebration/days/{DATE}.ts`,
  loading each day's code only when it plays. Today it always plays the WILD → TAME flora scene.
- **A general `CelebrationTheme`:** today its colour palette is specific to the flora scene.
- **Daily puzzle files and a `?day=` preview parameter.**
- **Contract tests in `src/celebration`:** the same `t` gives the same frame, the final frame lies
  on the goal word's strokes, and the scene stays within the budgets.
- **`src/celebration/days/LOG.md`.**

---

You're making today's win celebration for **Strokes**, a word puzzle. Players turn **{START}** into
**{GOAL}** one real word at a time by redrawing letters stroke by stroke (today's best route:
{ROUTE}, {BEST} strokes). When they reach {GOAL}, a short piece of motion art plays: about four
seconds, then it holds until they tap. It should show {START} becoming {GOAL}.

- {START}: {START_DEFINITION}
- {GOAL}: {GOAL_DEFINITION}
- Date: {DATE}, puzzle #{NUMBER}
- Recent celebrations (don't repeat their idea): {LAST_14_CONCEPTS}

## 1. Concept

Write three one-paragraph ideas for how {START} becomes {GOAL}: one literal, one metaphorical,
one abstract. Pick the one that reads most clearly as "{START} → {GOAL}" in four seconds without
words, and say why in two sentences.

Keep it suitable for everyone:
- no violence or gore;
- no real people, brands, logos or characters, and no religious or political symbols;
- no flashing faster than three times a second;
- no text except the two words (the game adds the title and score).

## 2. Build it

Create `src/celebration/days/{DATE}.ts`. Model it on `src/celebration/flora.ts` (the WILD → TAME
pilot), but make your own idea. Export:

- `theme`: a `CelebrationTheme` with:
  - `title`: 12 characters at most, e.g. "Tamed!", in the spirit of {GOAL};
  - `stormBg`: the opening background;
  - `timing`: `{ burst, calm, settled }` in seconds.
- `scene(THREE, { start, goal, theme, small, cssColor })`, returning
  `{ objects, update(t), dispose(), margin }`.

Rules:

- **A function of time.** `update(t)` must draw the same frame for the same `t`, in any order, so
  any moment can be shown on its own.
  - Work everything out from `t`; keep nothing from earlier frames.
  - Use `seededRandom(seed)` from `src/maze.ts` while setting up, never `Math.random`.
- **Beats:**
  - **0 to `burst`:** {START} is shown legibly.
  - **`burst` to `calm`:** the change happens (your idea).
  - **`calm` to `settled`:** it resolves into {GOAL}.
  - **From `settled`:** {GOAL} is complete and still, apart from gentle idle motion (nothing moves
    more than 0.03 units).
  - The background ends on the page's own colour, `cssColor('--bg')`.
- **The words are the game's own letters.**
  - Draw {START} and {GOAL} along `wordStrokes(word)` from `src/celebration/wordPoints.ts`,
    centred.
  - Strokes about 0.1 units wide, each one recognisable.
  - At the end, {GOAL} must read at a glance on a 375-pixel-wide phone, in light mode and in dark
    mode. Use the game's stroke colours (`cssColor('--t-<stroke>')`) or colours with at least 3:1
    contrast on both page backgrounds.
- **Budget:**
  - 6 meshes, 20,000 vertices and 5,000 instances at most;
  - 60 frames a second on a mid-range phone;
  - when `small` is true, cut the counts by about 40%.
  - Set `frustumCulled = false` on anything whose bounds don't follow its geometry, and dispose of
    every geometry and material.
- **Self-contained.** No network requests, images, fonts or other files, and no touching the page
  except through `cssColor`.
- **Reduced motion.** Players who ask for less motion see only the frame at `settled + 0.8`, so that
  frame must be the finished {GOAL}.

## 3. Check it

- **Type-check and test:** run `npx tsc --noEmit -p .` and `npx vitest run src/celebration`. The
  tests check that frames repeat for the same time, that the final frame lies on {GOAL}'s strokes,
  and the budgets.
- **Look at stills.** Use `npm run dev`, then `/?day={DATE}&celebrate=<seconds>` at 0.2, at the
  peak of the change, halfway through resolving, and at `settled + 0.6`. Check each at 1280×800 and
  at 375×812, in dark and light mode.
- **Fix anything that doesn't read:** a muddled change, an illegible {GOAL}, colours lost on either
  background, or anything that jumps.

## 4. Hand it in

- Open a pull request titled "Daily {DATE}: {START} → {GOAL}". Include the concept (two
  sentences), the stills, and the checks that passed.
- Add a line to `src/celebration/days/LOG.md`: date, words, and the concept in one line. This is
  where later prompts' "recent celebrations" come from.

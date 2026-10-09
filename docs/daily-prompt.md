# Prompt: the daily puzzle

This is the runbook Claude follows to add a daily puzzle. Run it with `/daily` (optionally
`/daily 2026-10-10`) from a Claude Code session in this repo, on a Mac with the dev server
available, since step 2 looks at the puzzle in a browser.

It makes one day. For a batch, follow it once per date, in date order, on one branch with one pull
request.

---

You're adding a day's puzzle to **Strokes**, a word puzzle. Players turn a start word into a goal
word one real 5-letter word at a time, redrawing letters stroke by stroke, in as few strokes as they
can. Every device plays 5-letter words. (The 4-letter game is kept behind `?letters=4`, and gets no
new days.)

## 0. Get ready

- Start from an up-to-date `main` with no uncommitted changes to tracked files (leave untracked
  files alone), and make a branch `daily/{DATE}`.
- **The date:** the one you were given, or else the day after the latest file in
  `src/daily/days-5/`. Never replace a date that already has a puzzle.

## 1. Choose the puzzle

- Run `npm run daily -- {DATE}`. It lists ten candidates for that date, with their routes,
  definitions and what makes each tricky (how often a simulated player makes par, how far ahead
  you must plan, its traps, the pockets beside its route, and how many words a search from both
  ends looks at). The script has already cycled through the puzzle pool for you:
  - no pair is used twice (either way round);
  - no start or goal word comes back within 30 days;
  - difficulty follows the week: the easiest third of the pool early in the week, the hardest by
    the weekend;
  - the kind of route varies from day to day.
- **Choose the one whose two words make the clearest picture of change.** The best pairs are vivid
  or concrete, like MINER → CHEER or POUCH → BATCH.
  - Avoid pairs where either word is unpleasant (SLAIN), religious or political (SAINT), or awkward
    to show to everyone.
  - Avoid pairs whose start or goal reads as an inflection (TUBED, BORED, BAKED).
  - Choose only from the list. If none is good, take the least awkward one.
  - Between pairs that are equally good pictures, prefer the one whose search from both ends looks
    at more words.
- Check it in with `npm run daily -- {DATE} {START} {GOAL}`. This writes
  `src/daily/days-5/{DATE}.json` and prints the day's number.
- There's no celebration to build: a Perfect gets the confetti, then the goal word.

## 2. Check it

- **Type-check and test.** Run `npx tsc --noEmit -p .` and `npx vitest run`.
  `src/daily/daily.test.ts` checks the puzzle against the word list and the pool's rules.
- **Look at it.** Run `npm run dev` and open `/?day={DATE}`, at 1280×800 and at 375×812. Check:
  - the dateline reads "No. {NUMBER} · {weekday}, {month} {day}";
  - the board starts on {START} with {GOAL} as the goal;
  - the lowest strokes match;
  - there are no errors in the console.

## 3. Hand it in

- **Commit and open a pull request** titled "Daily {DATE}: {START} → {GOAL}". Include:
  - why you chose it, in a sentence or two, and what you passed over;
  - its route and lowest strokes;
  - the checks that passed.
- **Don't merge it.** The owner reviews and merges, and merging into `main` deploys the site.

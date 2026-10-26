# Prompt: the daily puzzle

This is the runbook Claude follows to add a daily puzzle. Run it with `/daily` (optionally
`/daily 2026-10-10`) from a Claude Code session in this repo, on a Mac with the dev server
available, since step 2 looks at the puzzle in a browser. It also runs by itself every night at
midnight Eastern (see "On a schedule" below).

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
  - each day's difficulty is picked at random: the easiest, middle or hardest third of the pool;
  - the kind of route varies from day to day;
  - no puzzle has a word a player must find to make Par (from 2026-10-28): for every word on its
    lowest-stroke route, there's a way round that word within 4 strokes of the lowest (see `mustFind`
    in `src/difficulty.ts`);
  - every puzzle has at least two easy first steps (from 2026-10-29): words a player can reach from
    the start for 1–2 strokes (see `firstSteps` in `src/difficulty.ts`).
- **Choose the one whose two words make the clearest picture of change.** The best pairs are vivid
  or concrete, like MINER → CHEER or POUCH → BATCH.
  - Avoid pairs where either word is unpleasant (SLAIN), religious or political (SAINT), or awkward
    to show to everyone.
  - Avoid pairs whose start or goal reads as an inflection (TUBED, BORED, BAKED).
  - Choose only from the list. If none is good, take the least awkward one.
  - **Never check in a puzzle with a word a player must find to make Par, or with fewer than two
    easy first steps.** The list leaves them out, `npm run daily -- {DATE} {START} {GOAL}` refuses
    one (even with `--any`), and `src/daily/daily.test.ts` fails on one. If the check-in refuses
    your pair, choose another from the list; don't work round it. If the list is empty, stop: don't
    add the day, and say so.
  - Between pairs that are equally good pictures, prefer the one whose search from both ends looks
    at more words.
- Check it in with `npm run daily -- {DATE} {START} {GOAL}`. This writes
  `src/daily/days-5/{DATE}.json` and prints the day's number.
- There's no celebration to build: an Ace gets the confetti.

## 2. Check it

- **Type-check and test.** Run `npx tsc --noEmit -p .` and `npx vitest run`.
  `src/daily/daily.test.ts` checks the puzzle against the word list and the pool's rules, and that
  it has no word a player must find to make Par.
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
- **Merge it** once every check in step 2 has passed:
  `gh pr merge {PR} --repo funklunsford/word-puzzle --merge --subject "Merge daily {DATE}: {START} → {GOAL}"`.
  Merging into `main` deploys the site, so the day's puzzle goes live without waiting for a review.
- **If a check failed, don't merge.** Leave the pull request open and say in it what failed, for
  the owner to look at.

## On a schedule

A Claude Code routine in Anthropic's cloud, "Strokes daily puzzle" (at claude.ai/code/routines), runs
this runbook every night, so no one's machine has to be on. It's scheduled at 04:07 and 05:07 UTC,
so one run lands just after midnight Eastern whether or not daylight saving is on; the other finds
the day already in and stops. Each run:

- clones this repository and adds every missing day, from the day after the latest file in
  `src/daily/days-5/` up to and including **two days after today** in Eastern time. Puzzles go in two
  days ahead because each player gets theirs at their own midnight, and the furthest-ahead time
  zone (UTC+14) starts each date ten hours before UTC does. The game only plays a puzzle on its own
  date, so the ones ahead wait unseen, and a failed night does no harm;
- runs `npx tsc --noEmit -p .`, `npx vitest run` and `npm run build` (there's no browser in the cloud,
  so the look in step 2 is skipped);
- if they all pass, commits the new days and pushes straight to `main`, which deploys the site.
  There's no pull request; the commit message says why each pair was chosen;
- if a check fails, pushes to a `daily/{date}` branch instead and leaves it for the owner.

What keeps it to adding days:

- **Only day files go live.** Before anything is published, `scripts/check-nightly.sh` (in the
  deploy workflow) checks every commit Claude pushed straight to `main` since the last publish. Each
  may only add `src/daily/days-5/{DATE}.json`. If one did more, nothing is published, then or on
  later pushes, until the owner has looked: revert it or keep it, then publish by hand (GitHub >
  Actions > Test and deploy > Run workflow), which skips the check.
- **No web tools.** The routine can't fetch or search the web (WebFetch and WebSearch are
  disallowed), so it never reads web pages, where injected instructions usually come from.
- **`main` can't be rewritten.** A ruleset blocks force-pushes and deleting the branch.

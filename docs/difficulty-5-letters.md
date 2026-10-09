# Puzzle difficulty at 5 letters: working back from the goal

*2026-10-09, branch `difficulty-5`. What was asked, how it was measured, what it found, and what to
change. Every table comes from `scripts/difficulty-study.ts` (see [Reproducing](#reproducing)); the
maze's own counts are the ones `scripts/mazes.ts` prints.*

## What was asked

> Review core loop again for 5 letters. Does the core loop revision work we did previously still
> hold? I noticed in playtesting that my strategy is to first work ~3 steps back from the goal, then
> work ~3 steps from the start and it's been successful. Explore the 5-letter space to understand if
> current strategy needs to be optimized. Pull in graph data structure research to understand if
> there are ways to improve the loop.

The core loop revision is how the pool defines hard (DESIGN.md: "Tricky puzzles, fewer hub letters",
"Tricky by measure, pockets, and linking words", carried to 5 letters in "The 5-letter game on
desktop"). Every pool puzzle is *tricky*: no rule of thumb makes par walking from the start. Every one
also has a pocket beside its route. The daily rhythm puts the pool in thirds by *par chance*, how often
a simulated player heading for the goal makes par.

## In short

- **Going forward it still holds. From both ends it doesn't.** Every measure behind "tricky" looks
  forward from the start, and going forward the pool is as hard as designed: the simulated player
  heading for the goal makes par in 4% of games. Working back from the goal gets round those measures.
  - For half the pool (220 of 420 puzzles) the strategy is a rule of thumb: map the words up to 3
    doors back from the goal, then take whichever door looks best.
  - Half the pool (210) isn't tricky at all when played from the goal to the start.
  - Pockets make no measurable difference to any simulated player, forward or not.
- **The strategy, measured against the forward player:**
  - Simulated players who plan in their head before moving, looking at the same number of words:
    51% at par working back first, against 15% heading forward, at 10 looks; 91% against 66% at 20.
  - Players who walk without planning: 46% at par once they know the goal's side 3 doors back,
    against 4% heading for the goal (15% if they never take a door they know makes par).
- **Why it works:** judging distance by eye (the strokes difference) is nearly exact one or two doors
  from a word, but misses a third of the strokes 4 to 6 doors out. Splitting a 5-door route into
  3 + 2 keeps every judgement near its target. That is the textbook case for searching from both ends.
- **The hypothesis, half right:** the goal's side is small (42 words within 3 doors, against 129 at 4
  letters), but no smaller than the start's (41), and only a third of its doors lead the right way.
  Backward search is cheap because the route is short, not because the goal's side is forced.
- **What to change** (section 7):
  1. Pick puzzles the strategy doesn't solve as a rule of thumb, a stroke longer: today's meet planner
     at 10 looks drops from 51% to 27%, at 20 looks from 91% to 77%, and the forward planner from 66%
     to 53%. The pool fills from fewer candidates, with more variety.
  2. Rank the daily thirds by par chance and search effort together: the hardest third gets harder
     for every simulated player (the forward planner 44% → 34%, the meet planner at 10 looks 35% → 28%).
  3. Ask players whether they miss doors that change two letters at once. If they do, those doors are
     the strongest difficulty dial measured, and the next thing to rank by.

## Terms

- **Door**: a step between two words. **Doors on the route**: the fewest doors on a lowest-stroke route.
- **Par**: the lowest strokes possible, as the game shows it.
- **By eye**: a word's strokes difference to another (`strokeDiff`), which is how far it looks.
- **The goal's side, N doors back**: every word at most N doors from the goal, each with the fewest
  strokes from it to the goal in N doors (`goalSide`).
- **Meet depth**: planning depth for a player who has mapped the goal's side 3 doors back
  (`meetDepth`). It is how many doors ahead they must look, judging the rest by eye, to make par.
  Meet depth 1 means "map 3 back, then take the door that looks best" makes par: the strategy is a
  rule of thumb for that puzzle.
- **Search effort**: how many words a search from both ends that meets in the middle (MM, Holte et al.
  2016) must look at before it can be sure of par, judging by eye (`searchEffort`).

## Method

**Players.** All of them are simulated in `src/difficulty.ts`, seeded per puzzle so a puzzle always
scores the same. Each plays 400 games (200 in the candidate streams).

| Player | What they do | Code |
|---|---|---|
| Forward walker | Today's par chance. At each word they pick an unused door at random, leaning towards those that look closer to the goal (each stroke worse is e times less likely), and go back free from dead ends. They never plan. | `parChance`, which is now `walkChance` |
| Meet walker | Maps the goal's side 3 doors back first, then walks the same way, leaning towards the cheapest-looking way through the mapped side. Takes a door onto it that is sure to make par when there is one. This is an upper bound on the strategy: it knows every word 3 back. The planners show what a player with limited attention does. | `walkChance({ target: 'meet', sure: true })` |
| Forward, backward and meet planners | Think before moving. They look at a number of words (list their doors), picking the next at random and leaning towards those that look closer, and stop at a par plan. The meet planner spends half its looks back from the goal (at most 3 doors), then heads from the start towards the words it found there. | `planChance` |
| ... seeing half the 2–3 letter doors | A planner that sees every door changing one letter, but each door changing two or three letters (a stroke moved between letters) only half the time. | `planChance({ hidden: 0.5 })` |

**Data.**
- The shipped 5-letter pool (`public/mazes-5.json`, 420 puzzles).
- Its one daily, SNARE → SHOUT (2026-10-07), which the pool no longer holds.
- The 4-letter pool, for contrast.
- Candidates drawn the way `scripts/mazes.ts` draws them and scored whether kept or not: 3,000 at
  lowest strokes 12–15 and 1,500 at 14–17.
- Two pools rebuilt with the proposed rule, into a scratch folder. `public/` is untouched: with no new
  options, the script rebuilds the shipped pools, 4 and 5 letters, byte for byte.

**Statistics.** Rank correlation (Spearman) over 420 puzzles; below about 0.1 it is noise. "Given par
chance" holds today's par chance fixed (a partial correlation), so it shows what a measure adds to
today's ranking.

## 1. The maze from both ends

The 5-letter maze has 4,041 words and 6,978 doors. A word has 2 doors at the median, 20% have none,
61% of words are in the main maze, and 246 pockets hang off it. By comparison, Knuth's classic
five-letter word-ladder graph, which links any two words one letter apart, has 5,757 words and 14,135
links.

**Frontiers from each end** (pool puzzles, medians):

| | 4 letters: start | 4 letters: goal | 5 letters: start | 5 letters: goal |
|---|---|---|---|---|
| words within 1 door | 7 | 8 | 5 | 4 |
| within 2 doors | 34 | 40 | 16 | 15 |
| within 3 doors | 106 | 129 | 41 | 42 |
| share of its doors on a lowest route (mean) | 20% | 21% | 27% | 32% |

- **Small: yes**, against 4 letters (a third the size). **Smaller than the start's: no.**
- **Forced: partly.** A third of the goal's doors lead onto a lowest route, against a quarter of the
  start's. At least half do for 108 goals (32 starts), and all do for 9. Part of that comes from the
  rules: a goal needs only 2 doors, a start 3 (`randomPuzzle`).
- **Routes are nearly unique.** 212 puzzles have exactly one lowest route. At the median, 3 of the 4
  words between start and goal are on every lowest route (gates, the route's dominators).
- **Short routes are what make the strategy work.** Lowest routes run 4 doors (78 puzzles), 5 (292)
  or 6 (50), so 3 back from the goal leaves 1 to 3 to find from the start.

**Judging by eye, by doors still to go** (along each pool route, both ways round):

| Doors to go | Route words | Strokes the eye misses (mean) | The eye's estimate, as a share of the truth |
|---|---|---|---|
| 1 | 840 | 0.0 | 100% |
| 2 | 840 | 0.5 | 91% |
| 3 | 840 | 1.6 | 81% |
| 4 | 840 | 3.3 | 71% |
| 5 | 684 | 4.9 | 64% |
| 6 | 104 | 5.6 | 62% |

A forward player judging the goal from the start is 5 doors out, where the eye misses a third of the
strokes. That is where the traps live. A player working from both ends is never judging more than 2 or
3 doors out. Barker and Korf (2015) found the same for search algorithms: searching from both ends pays
when the estimate guiding the search is weak, and a one-way search wins when it is strong.

**Doors that change two or three letters** (a stroke moved between letters, say): 332 of 420 puzzles
need one on every lowest route. The fewest such doors on a lowest route is 0 for 88 puzzles, 1 for
153, 2 for 127 and 3 or more for 52.

## 2. The strategy against the forward player

**Share of games at par**, mean over the 420 pool puzzles:

| Player | Par | ≤ 1 over | ≤ 2 over | Median puzzle | Puzzles at par in half the games or more |
|---|---|---|---|---|---|
| Forward walker (today's par chance) | 4% | 8% | 12% | 3% | 0 |
| Forward walker, goal → start | 11% | – | – | 5% | 11 |
| Meet walker, goal's side mapped 2 doors back | 15% | – | – | 8% | 24 |
| Meet walker, 3 back, not taking doors sure to make par | 15% | – | – | 9% | 24 |
| **Meet walker, 3 back** | **46%** | 50% | 54% | 34% | 172 |
| Meet walker, 4 back | 93% | – | – | 100% | 388 |
| Forward planner, 10 looks | 15% | 16% | 16% | 3% | 49 |
| **Meet planner, 10 looks** | **51%** | 57% | 58% | 47% | 200 |
| Forward planner, 20 looks | 66% | 67% | 68% | 82% | 283 |
| Backward planner, 20 looks | 67% | – | – | 86% | 282 |
| **Meet planner, 20 looks** | **91%** | 94% | 95% | 100% | 396 |
| Forward planner, 40 looks | 95% | 96% | 96% | 100% | 407 |
| Meet planner, 40 looks | 99% | 100% | 100% | 100% | 418 |
| Forward planner, 20 looks, sees half the 2–3 letter doors | 36% | – | – | 27% | 109 |
| Meet planner, 20 looks, sees half the 2–3 letter doors | 48% | – | – | 46% | 163 |

- **At equal effort, working back first wins.** It more than triples the planner's par rate at 10
  looks and takes it from two-thirds to nine-tenths at 20. At 40 looks both nearly always make par.
- **Near par adds little.** A planner either finds a par plan within its looks or usually finds no
  plan at all, so allowing 2 strokes over par adds 1–7 points. Walkers gain 8: within 2 strokes of par,
  12% heading forward (4% at par) and 54% working back (46%).
- **One end alone is no better.** A planner who only searches back from the goal does as well as one
  who only searches forward (67% against 66%). The gain comes from using both ends.
- **Knowing the goal's side is the walker's lever.** 3 doors back gives 46%. 2 back gives 15%. 4 back
  solves nearly everything (93%), because routes are at most 6 doors.
- **Doors changing 2–3 letters resist it best.** For a planner who misses half of them, the strategy's
  edge at 20 looks shrinks from 25 points to 12 (48% against 36%).

**By kind of puzzle** (share of games at par):

| Puzzles | n | Forward walker | Forward planner 20 | Meet walker | Meet planner 10 | Meet planner 20 | Meet planner 20, half the 2–3 letter doors |
|---|---|---|---|---|---|---|---|
| all | 420 | 4% | 66% | 46% | 51% | 91% | 48% |
| 4 doors | 78 | 6% | 89% | 100% | 83% | 98% | 52% |
| 5 doors | 292 | 4% | 63% | 37% | 48% | 93% | 49% |
| 6 doors | 50 | 4% | 45% | 17% | 19% | 71% | 36% |
| goal with 2 doors | 80 | 5% | 67% | 44% | 65% | 96% | 50% |
| goal in a pocket | 40 | 5% | 69% | 45% | 69% | 98% | 50% |
| tricky goal → start too | 210 | 4% | 61% | 41% | 37% | 87% | 45% |
| not tricky goal → start | 210 | 5% | 71% | 51% | 65% | 95% | 50% |
| meet depth 1 | 220 | 5% | 69% | 76% | 64% | 95% | 50% |
| meet depth 2+ | 200 | 4% | 62% | 14% | 37% | 87% | 45% |
| daily third: easy | 140 | 9% | 85% | 61% | 66% | 97% | 50% |
| daily third: middle | 140 | 3% | 68% | 45% | 52% | 94% | 51% |
| daily third: hard | 140 | 1% | 44% | 33% | 35% | 82% | 42% |
| daily 2026-10-07: SNARE → SHOUT (lowest 14, 5 doors) | 1 | 6% | 57% | 21% | 58% | 98% | 98% |

- **Route length decides it.** Every 4-door puzzle falls to the meet walker (3 back, then 1 door
  forward). At 6 doors the meet planner at 10 looks makes par 19% of the time.
- **A narrow goal helps the strategy.** With a 2-door goal or a goal in a pocket, the meet planner at
  10 looks makes par 65–69% of the time, against 51% across the pool.
- **The one daily, SNARE → SHOUT**, needs no 2–3 letter door, so a planner who misses those still makes
  par. Working back finds it easily: 98% at 20 looks.
- **At 4 letters the strategy would have done even better.** Routes there are 3 to 5 doors, so the
  meet walker makes par 99% of the time. Meet depth is 1 for 418 of 420 puzzles, and the meet planner
  makes par 77% at 10 looks (forward 37%) and 98% at 20 (forward 79%).

## 3. Do today's measures still mean hard?

**Played from the goal to the start**, the same pool is much easier:

| | From the start | From the goal |
|---|---|---|
| fewest wrong letters makes par | 0 | 158 |
| fewest strokes left makes par (planning depth 1) | 0 | 185 |
| planning depth 1 / 2 / 3 / 4+ | 0 / 238 / 117 / 65 | 185 / 124 / 69 / 42 |
| tricky | 420 | 210 |

Meet depth (the goal's side mapped 3 back) is 1 / 2 / 3 / 4+ for 220 / 80 / 72 / 48 puzzles. Mapped
4 back, it is 399 / 10 / 4 / 7.

**Today's measures against each player** (rank correlation with the share of games at par; −1 means
the bigger the measure, the harder):

| Measure | Median | Forward walker | Forward planner 20 | Meet walker | Meet planner 10 | Meet planner 20 | Meet planner 10, given par chance |
|---|---|---|---|---|---|---|---|
| par chance | 0.03 | 1.00 | 0.47 | 0.38 | 0.42 | 0.41 | – |
| planning depth | 2 | −0.38 | −0.32 | −0.24 | −0.35 | −0.32 | −0.23 |
| traps | 3 | −0.66 | −0.59 | −0.25 | −0.37 | −0.40 | −0.13 |
| pockets beside the route | 1 | 0.02 | 0.11 | −0.05 | 0.01 | 0.10 | 0.00 |
| a trap into a pocket | 0 | 0.02 | 0.13 | −0.05 | −0.08 | 0.00 | −0.10 |

- **Traps and planning depth still mean hard going forward**, and somewhat for the strategy. Once par
  chance is held fixed, though, traps add almost nothing for it (−0.13).
- **Pockets mean nothing measurable for any player.** That holds for near misses too: pockets against
  the share of games within 2 strokes of par is −0.04 for the forward walker and −0.09 for the meet
  walker. Among 1,362 tricky candidates, those
  with no pocket beside the route play the same as those with one (section 5).
- **Par chance still orders the daily thirds the right way for the strategy, but weakly.** The hard
  third is made at par by the meet planner at 20 looks 82% of the time, against 97% for the easy
  third. Par chance correlates 0.38–0.42 with the meet players.

So the core loop's measures still mean "hard" for a player heading forward. None of them guards
against working back from the goal, and pockets don't mean hard for anyone.

## 4. Graph research: measures that resist meeting in the middle

Each candidate is measured on the pool against every player. The last column shows what it adds to
today's par chance for the meet planner at 10 looks.

| Measure | From | Median | Forward walker | Forward planner 20 | Meet walker | Meet planner 10 | Meet planner 20 | Meet planner 20, half the 2–3 letter doors | Meet planner 10, given par chance |
|---|---|---|---|---|---|---|---|---|---|
| doors on the route | route length | 5 | −0.18 | −0.36 | −0.67 | −0.54 | −0.35 | −0.14 | −0.53 |
| meet depth | the strategy as a rule of thumb (new) | 1 | −0.24 | −0.17 | −0.85 | −0.46 | −0.35 | −0.07 | −0.40 |
| tricky goal → start | rules of thumb from the goal | – | −0.19 | −0.14 | −0.14 | −0.42 | −0.26 | −0.09 | −0.39 |
| words MM must expand (search effort) | bidirectional search effort (Holte et al. 2016; Eckerle et al. 2017) | 17 | −0.39 | −0.64 | −0.37 | −0.70 | −0.55 | −0.12 | −0.64 |
| words A* must expand | one-way search effort | 9 | −0.39 | −0.73 | −0.25 | −0.53 | −0.44 | −0.10 | −0.44 |
| words within 2 doors of the goal | frontier from the goal | 15 | −0.09 | −0.11 | 0.00 | −0.36 | −0.39 | −0.08 | −0.35 |
| share of the goal's doors on a lowest route | goal-side ambiguity | 0.25 | 0.12 | 0.06 | 0.03 | 0.31 | 0.30 | 0.18 | 0.29 |
| near misses within 3 doors of the goal | decoys near the goal | 3 | −0.22 | −0.35 | −0.03 | −0.27 | −0.34 | −0.04 | −0.20 |
| one-letter look-alikes of the goal that aren't doors | decoy endpoints | 1 | −0.02 | −0.20 | 0.06 | −0.04 | −0.04 | 0.13 | −0.03 |
| words on every lowest route (gates) | dominators (Lengauer and Tarjan 1979) | 3 | −0.26 | −0.02 | −0.43 | −0.31 | −0.21 | −0.32 | −0.22 |
| words to remove to cut the start from the goal | min vertex cut (Menger 1927) | 3 | −0.13 | −0.34 | 0.04 | −0.27 | −0.33 | 0.03 | −0.24 |
| highest betweenness on the route | betweenness (Brandes 2001) | – | −0.09 | −0.18 | −0.13 | −0.16 | −0.16 | −0.21 | −0.13 |
| lowest routes | number of best paths | 1 | 0.23 | −0.11 | 0.10 | 0.03 | 0.05 | 0.32 | −0.08 |
| words on any lowest route, per word on one | diversity of the best paths | 1.00 | 0.23 | −0.12 | 0.16 | 0.06 | 0.06 | 0.33 | −0.04 |
| routes within 2 strokes of par | near-best paths (k shortest paths: Yen 1971) | 7 | −0.18 | −0.43 | −0.07 | −0.29 | −0.31 | 0.08 | −0.24 |
| fewest 2–3 letter doors on a lowest route | doors that are easy to miss | 1 | −0.04 | 0.04 | −0.01 | 0.03 | 0.01 | −0.87 | 0.04 |

What each would add:

- **Search effort (MM's must-expand words) is the best single measure.** It predicts the meet planner
  better than anything else (−0.70 at 10 looks) and the forward planner too (−0.64). Most of it is new
  to today's ranking: −0.64 once par chance is held fixed. It is structural and cheap, two shortest-path
  searches per puzzle, and isn't built from any simulated player. It is now `searchEffort`.
- **Route length and meet depth are the strategy's own measures.** Meet depth is the strategy turned
  into a rule of thumb, so its −0.85 with the meet walker is partly by construction. Against the
  planners, which it wasn't built from, it still adds −0.40 for the meet planner at 10 looks once par
  chance is held fixed.
- **Tricky goal → start** adds as much as meet depth for the planners (−0.39), but as a filter it
  costs too many candidates (section 5).
- **A large goal's side** costs the meet planner its looks (−0.36 to −0.39), and a goal whose doors
  mostly lead the right way helps it (0.30). As filters, both act on the goal's degree, which
  `randomPuzzle` already sets (2 doors at least).
- **Gates, cuts, betweenness and near-best paths** carry some signal, but less than search effort,
  which they mostly overlap with (a narrow, single-route maze is both). How many lowest routes there
  are, and how different they are, carries next to none (−0.08 and −0.04 given par chance): most
  puzzles have one or two, sharing most of their words.
- **Decoy endpoints carry no signal** for the simulated players, who never try a word that isn't a
  door. For a person they cost time, not strokes: a one-letter change that takes more than 3 strokes is
  refused within the step, and undoing it is free.
- **Doors changing 2–3 letters** decide everything if players miss them (−0.87), and nothing if they
  don't. The simulator builds that in, so it is a question for playtesting, not a finding.

## 5. Selection rules, on the candidate stream

These candidates are drawn the way `scripts/mazes.ts` draws them (everyday start and goal words, lowest
strokes picked evenly) and scored whether kept or not. "Meet depth 2+" is the proposed rule: working
back 3 doors and then taking the best-looking door doesn't make par.

**3,000 candidates at lowest strokes 12–15.** The share of candidates kept, overall and by lowest
strokes, then the share of games at par among those kept:

| Rule | Kept | At 12 | At 13 | At 14 | At 15 | Forward walker | Forward planner 20 | Meet walker | Meet planner 10 | Meet planner 20 | Meet planner 20, half the 2–3 letter doors |
|---|---|---|---|---|---|---|---|---|---|---|---|
| every candidate | 100% | 100% | 100% | 100% | 100% | 12% | 74% | 53% | 59% | 93% | 47% |
| **today: tricky, a pocket beside the route** | 17% | 11% | 18% | 20% | 20% | 4% | 64% | 37% | 47% | 89% | 46% |
| tricky, no pocket needed | 45% | 30% | 46% | 51% | 54% | 4% | 63% | 37% | 43% | 88% | 44% |
| today, and tricky goal → start | 8% | 5% | 9% | 9% | 10% | 3% | 58% | 35% | 32% | 84% | 46% |
| today, and 5+ doors | 16% | 4% | 18% | 20% | 20% | 4% | 61% | 30% | 43% | 88% | 46% |
| today, and meet depth 2+ | 10% | 3% | 12% | 13% | 13% | 3% | 63% | 14% | 38% | 86% | 43% |
| **tricky, meet depth 2+ (no pocket needed)** | 26% | 6% | 27% | 32% | 37% | 3% | 61% | 13% | 33% | 83% | 42% |
| tricky both ways, meet depth 2+ (no pocket needed) | 14% | 1% | 13% | 18% | 24% | 2% | 54% | 11% | 22% | 77% | 41% |

| Rule | Meet walker, steadier / looser | Meet planner 20, steadier / looser | Different start and goal words in the first 140 kept |
|---|---|---|---|
| every candidate | 58% / 46% | 95% / 87% | 231 |
| today: tricky, a pocket beside the route | 37% / 35% | 92% / 82% | 197 |
| tricky, no pocket needed | 38% / 35% | 91% / 80% | 227 |
| today, and tricky goal → start | 36% / 33% | 87% / 75% | 197 |
| today, and 5+ doors | 29% / 28% | 91% / 81% | 198 |
| today, and meet depth 2+ | 6% / 18% | 89% / 78% | 196 |
| tricky, meet depth 2+ (no pocket needed) | 6% / 17% | 87% / 74% | 221 |
| tricky both ways, meet depth 2+ (no pocket needed) | 5% / 15% | 82% / 68% | 213 |

- **Pockets cost candidates and buy nothing measurable.** Without them, 45% of candidates are kept
  instead of 17%, and they play the same: tricky candidates with no pocket beside the route (839)
  against those with one (523) give 3% / 4% for the forward walker, 63% / 64% for the forward planner
  and 87% / 89% for the meet planner at 20 looks. They also give more variety (227 different words in
  the first 140 kept, against 197).
- **Meet depth 2+ keeps more candidates than today's rule, except at 12 strokes** (26% overall, but 6%
  at 12, against 11%). Against the players it isn't built from, the meet planner falls from 47% to 33%
  at 10 looks and from 89% to 83% at 20, and the forward planner from 64% to 61%. The meet walker's fall
  (37% → 13%) is by construction.
- **Tricky goal → start on top** helps the meet planner a little more (22% at 10 looks), but halves the
  candidates kept and starves 12-stroke puzzles (1%).
- **5+ doors alone does little** (meet planner at 10 looks 47% → 43%). Meet depth 2+ already rules out
  every 4-door puzzle.

**By lowest strokes**, today's rule / the meet rule (12–15 from the 3,000 candidates, 16–17 from 1,500
more at 14–17, which agree at 14 and 15 to within a few points):

| Lowest strokes | Kept | Doors on the route (mean) | Forward walker | Forward planner 20 | Meet walker | Meet planner 10 | Meet planner 20 |
|---|---|---|---|---|---|---|---|
| 12 | 11% / 6% | 4.4 / 5.0 | 6% / 5% | 87% / 82% | 74% / 18% | 71% / 50% | 98% / 94% |
| 13 | 18% / 27% | 5.0 / 5.0 | 4% / 4% | 69% / 67% | 31% / 14% | 51% / 41% | 93% / 87% |
| 14 | 20% / 32% | 5.1 / 5.2 | 3% / 3% | 59% / 63% | 29% / 13% | 47% / 35% | 89% / 84% |
| 15 | 20% / 37% | 5.4 / 5.5 | 4% / 2% | 51% / 52% | 29% / 11% | 33% / 24% | 83% / 77% |
| 16 | 26% / 54% | 6.1 / 6.1 | 2% / 2% | 27% / 29% | 13% / 7% | 10% / 7% | 63% / 55% |
| 17 | 29% / 54% | 6.2 / 6.2 | 2% / 2% | 25% / 24% | 13% / 6% | 8% / 5% | 57% / 52% |

- **12-stroke puzzles belong to the strategy.** They average 4.4 doors, and under today's rule the
  meet planner at 10 looks makes par on them 71% of the time. The meet rule keeps few of them (6%).
- **Each stroke from 13 to 15 costs the strategy several points**, and 16 strokes (6 doors: 3 back,
  then 3 to find) is a step down for every planner. All 1,500 candidates at 14–17 under the meet rule
  give 16% for the meet planner at 10 looks, 65% at 20, and 38% for the forward planner. Under today's
  rule they give 20%, 70% and 37%.
- **The forward walker barely notices any of it** (2–6%). Today's par chance is already at its floor,
  which is why it can't tell these puzzles apart for a player who works back.

## 6. Rebuilt pools

Rebuilt into a scratch folder with `scripts/mazes.ts --letters 5 --rule meet [--best 13-16] --out FILE`
and scored like the shipped one. The meet walker is left out: the rule is built from it, so its drop is
by construction.

| | Shipped (tricky, a pocket beside; 12–15) | Meet rule, 12–15 | Meet rule, 13–16 |
|---|---|---|---|
| candidates looked at | 3,468 | 9,791 | 1,530 |
| different start and goal words | 408 | 461 | 463 |
| lowest strokes (mean) / doors on the route (mean) | 13.5 / 4.9 | 13.5 / 5.2 | 14.5 / 5.45 |
| doors 4 / 5 / 6 / 7 | 78 / 292 / 50 / 0 | 0 / 348 / 71 / 1 | 0 / 242 / 166 / 12 |
| a trap into a pocket | 98 | 42 | 44 |
| forward walker (today's par chance) | 4% | 3% | 3% |
| forward planner, 10 / 20 looks | 15% / 66% | 16% / 66% | 9% / 53% |
| **meet planner, 10 / 20 / 40 looks** | **51% / 91% / 99%** | **39% / 87% / 99%** | **27% / 77% / 98%** |
| meet planner, 20 looks, steadier / looser (temperature 0.5 / 2) | 94% / 84% | 91% / 78% | 81% / 67% |
| meet planner, 20 looks, half the 2–3 letter doors | 48% | 45% | 38% |
| a walker mapping 4 doors back | 93% | 89% | 71% |
| tricky goal → start | 210 | 203 | 250 |
| daily hard third: meet planner 10 / 20 looks | 35% / 82% | 21% / 73% | 12% / 59% |

- **The rule alone moves the threshold by a door.** A player who maps 3 back can no longer win by rule
  of thumb (by construction), but one who maps 4 back still solves 89%. Against the planners it was
  not built from, it costs the meet planner 12 points at 10 looks and 4 at 20, and the forward planner
  nothing. At 12–15 it is also slow to fill: 12-stroke puzzles are mostly 4 doors, and only 6% of them
  pass.
- **A stroke longer makes it hold.** At 13–16 the meet planner drops 24 points at 10 looks and 14 at
  20, the forward planner 13 at 20, and the 4-back walker 22. It holds when the players are steadier
  or looser. The pool fills from half as many candidates as today's and has more variety. The cost is
  a stroke and about half a door more per puzzle (5.45 doors, against 4.9).
- **Pocket traps fall** from 98 to 42–44 puzzles once pockets aren't required. On the evidence above
  that loses nothing measurable, but it reverses an earlier choice, so it is a question below.

## 7. Recommendations

1. **First: pick puzzles the strategy doesn't solve as a rule of thumb, a stroke longer.** In
   `scripts/mazes.ts` (5 letters), keep `isTricky` and replace "a pocket beside the route" with
   `meetDepth(words, adj, p) >= 2`: this is `--rule meet`, ready to make the default. In `src/maze.ts`,
   set `PUZZLE_SHAPES[5].best` to `[13, 16]`, then rebuild `public/mazes-5.json`.
   - Expected, from the rebuilt pool: the meet planner at 10 looks 51% → 27% and at 20 looks
     91% → 77%; the forward planner at 20 looks 66% → 53%; a 4-back mapper 93% → 71%; the forward walker
     unchanged (4% → 3%). 463 different start and goal words (408 now), from 1,530 candidates (3,468
     now).
   - The cost is 14.5 strokes and 5.45 doors per puzzle on average (13.5 and 4.9 now), which matters
     most on phones.
   - Without the length change, the rule alone gives 51% → 39% and 91% → 87%.
   - Then add `searchEffort` and meet depth to `KeptDifficulty` (`keep`) so the pool and the day files
     carry them. That changes the pool file, so it belongs with the rebuild, and the pool test will
     check the new fields.
   - Change what assumes a pocket beside every route. The 5-letter pool test ("is all tricky, and
     every puzzle passes a pocket", `src/difficulty.test.ts`) should check `meetDepth(...) >= 2`
     instead. `scripts/daily.ts` says "passes a pocket" in its header and describes each candidate's
     pockets. The daily runbook (`docs/daily-celebration-prompt.md`) prefers a pair with a trap into a
     pocket, and only about a tenth of the rebuilt pool has one.
2. **Rank the daily thirds by par chance and search effort together.** In `scripts/daily.ts`, sort the
   pool by the sum of each puzzle's place by par chance and its place by `searchEffort` (most first),
   instead of par chance alone. Ties are broken as now.
   - On today's pool, the hard third against today's hard third: the forward planner at 20 looks
     44% → 34%, the meet planner at 10 looks 35% → 28% and at 20 looks 82% → 79%, the meet walker
     33% → 31%, and the forward walker unchanged at 1% (par chance is half the ranking). It is harder
     for every player, and the measure it adds is built from none of them.
   - On the 13–16 pool: the forward planner 30% → 20%, the meet planner 12% → 8% at 10 looks and
     59% → 54% at 20.
   - It needs no rebuild (search effort takes a moment per puzzle at daily time), so it can come first
     if the rebuild waits.
   - Ranking by a meet player instead looks better for that player, but it's circular, and it makes
     the hard third easier going forward (the forward planner 44% → 56% when ranked by the meet walker).
3. **Find out whether players miss doors that change two letters at once, then use them.** If a
   playtest says yes (players think in letter swaps and miss a stroke moved between letters), then:
   - 332 of 420 puzzles need such a door on every lowest route;
   - a meet planner who sees half of them makes par 90% / 52% / 28% / 13% of the time with 0 / 1 / 2 /
     3+ such doors needed;
   - so the fewest such doors on a lowest route becomes the strongest dial for the rhythm and for
     "tricky". It is a few lines over the lowest-route DAG (`hidden` in `scripts/difficulty-study.ts`).
   - If players don't miss them, it means nothing: its correlation with every player who sees all
     doors is between −0.04 and 0.04.

**Not recommended:**
- **Tricky both ways as a filter.** It halves the candidates today's rule keeps (8% against 17%; 5%
  against 11% at 12 strokes), for less effect than meet depth and a stroke more.
- **Betweenness, vertex cuts and decoy endpoints as filters.** They carry little signal beyond search
  effort, or none.

## Caveats

- **These are simulated players, not people.** They rank puzzles; they don't predict real results.
  Every simulated player here sees every door of each word they look at, except where stated, and the
  meet walker has a full map of the goal's side. The owner's playtest is the only human
  evidence, and it agrees with the direction (the strategy works). Jarušek and Pelánek (2010) rated
  Sokoban levels the same way, with a model of how people move through a puzzle, checked against about
  2,000 solved problems. That is the check this still needs: a few dozen timed plays of puzzles from
  each third.
- **"Looks" are an abstraction.** A look is listing every door of one word, which takes a person a
  while at 5 letters. At 40 looks everyone nearly always makes par, so the comparison is at 10 and 20.
- **One daily is too few to generalise from.** SNARE → SHOUT is reported as it is; the thirds are the
  better guide to what dailies will be like.

## Reproducing

```sh
npx vite-node scripts/difficulty-study.ts pool                      # the shipped 5-letter pool and its daily (about 4 min)
npx vite-node scripts/difficulty-study.ts pool --letters 4          # the 4-letter pool, for contrast
npx vite-node scripts/difficulty-study.ts stream                    # 3,000 candidates, lowest strokes 12–15 (about 5 min)
npx vite-node scripts/difficulty-study.ts stream --best 14-17 --candidates 1500
npx vite-node scripts/mazes.ts --letters 5 --rule meet --best 13-16 --out /tmp/mazes-5-meet.json
npx vite-node scripts/difficulty-study.ts pool --pool /tmp/mazes-5-meet.json
```

Everything is seeded, so the same files give the same numbers. The new measures have tests in
`src/difficulty.test.ts`. `walkChance` gives today's `parChance` exactly, puzzle by puzzle, and
`scripts/mazes.ts` with no new options rebuilds the shipped pools (4 and 5 letters) byte for byte.

## Questions for the owner

1. **Longer puzzles:** is 13–16 strokes (5.45 doors on average, against 4.9) fine for a phone session?
   The data says it is the lever that holds against the strategy. 14–17 would go further (section 5).
2. **Pockets:** may the pool stop requiring a pocket beside the route? Requiring one makes no
   measurable difference to any simulated player, turns away 62% of tricky candidates, and lowers
   variety (197 different words in the first 140 kept, against 227 without). A person who explores by
   walking may still lose more strokes in a pocket: did pockets ever cost you strokes in play?
3. **Doors that change two letters at once:** do you, or other playtesters, miss them? If so, they are
   the next difficulty dial (recommendation 3).
4. **How long do you think before your first move?** It decides whether "10 looks" or "20 looks" is the
   better model, and so how hard the rebuilt pool really is.

## References

- Barker, J. K. and Korf, R. E. (2015). Limitations of front-to-end bidirectional heuristic search.
  AAAI. <https://ojs.aaai.org/index.php/AAAI/article/view/9374>
- Brandes, U. (2001). A faster algorithm for betweenness centrality. *Journal of Mathematical
  Sociology* 25(2).
- de Champeaux, D. and Sint, L. (1977). An improved bidirectional heuristic search algorithm. *JACM*
  24(2): heading for the other side's frontier rather than its root, which is how the meet players
  judge doors.
- Eckerle, J., Chen, J., Sturtevant, N., Zilles, S. and Holte, R. (2017). Sufficient conditions for
  node expansion in bidirectional heuristic search. ICAPS.
- Holte, R. C., Felner, A., Sharon, G. and Sturtevant, N. R. (2016). Bidirectional search that is
  guaranteed to meet in the middle. AAAI: MM, whose must-expand words are `searchEffort`.
- Jarušek, P. and Pelánek, R. (2010). Difficulty rating of Sokoban puzzle. STAIRS.
  <https://www.fi.muni.cz/adaptivelearning/documents/sokoban.pdf>
- Knuth, D. E. (1993). *The Stanford GraphBase*: the five-letter word-ladder graph.
  <https://cs.stanford.edu/~knuth/sgb.html>; the counts are from NetworkX's
  [word-ladder example](https://networkx.org/documentation/latest/auto_examples/graph/plot_words.html).
- Lengauer, T. and Tarjan, R. E. (1979). A fast algorithm for finding dominators in a flowgraph.
  *TOPLAS* 1(1).
- Menger, K. (1927). Zur allgemeinen Kurventheorie. *Fundamenta Mathematicae* 10. The cut is computed
  as a maximum flow (Ford and Fulkerson, 1956).
- Pohl, I. (1971). Bi-directional search. *Machine Intelligence* 6.
- Yen, J. Y. (1971). Finding the k shortest loopless paths in a network. *Management Science* 17(11).

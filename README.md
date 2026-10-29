# Strokes

Play it at **https://strokes.fun**. The Puzzle Playlist (its own repo, funklunsford/playlist) is at https://funklunsford.github.io/playlist/, also reached from https://funklunsford.com/puzzleplaylist.

A word maze where every letter is built from pen strokes. Each word is a room: drag strokes in from the tray, tap a stroke to remove it, drag it somewhere else, or, where a chevron, arc or bowl could start a letter either way round, twist it by circling the cursor around its spot (up to 3 strokes per step) to turn the current word into another everyday word, and find the cheapest route from the day's start word to its goal. See [DESIGN.md](DESIGN.md) for the rules and design notes.

```bash
npm install
npm run dev          # the game at http://localhost:5173, and the glyph gallery at /#gallery (dev server only)
npm test             # game-logic and celebration tests
npm run daily        # candidates for the next daily puzzle (see below)
```

There's a new 5-letter puzzle every day (`src/daily/days-5/`). To add the next one, run `/daily` in Claude Code, which follows [docs/daily-prompt.md](docs/daily-prompt.md): choose the puzzle, check it, and open a pull request. (The 4-letter game's days are in `src/daily/days/`; it gets no new ones, and its one day scene no longer plays.)

Going public on its own domain, with the security checklist: [docs/launch-plan.md](docs/launch-plan.md).

Every merge to `main` publishes the site to https://strokes.fun through GitHub Actions (`.github/workflows/deploy.yml`), as the Cloudflare Pages project "strokes" (`scripts/deploy-cloudflare.sh`). A pull request gets a preview copy at `<branch>.strokes-f1a.pages.dev`. To publish by hand: Actions > Test and deploy > Run workflow. The site's address is one setting, `VITE_SITE_URL` in `.env`.

One-time setup: a Cloudflare API token with Account > Cloudflare Pages > Edit, and the account's ID, as repository secrets (each command asks for the value):

```bash
gh secret set CLOUDFLARE_API_TOKEN --repo funklunsford/word-puzzle
```

```bash
gh secret set CLOUDFLARE_ACCOUNT_ID --repo funklunsford/word-puzzle
```

Regenerating the words and the maze:

```bash
curl -o scowl-40.txt "http://app.aspell.net/create?max_size=40&spelling=US&max_variant=0&diacritic=strip&download=wordlist&encoding=utf-8&format=inline"
curl -o scowl-50.txt "http://app.aspell.net/create?max_size=50&spelling=US&max_variant=0&diacritic=strip&download=wordlist&encoding=utf-8&format=inline"
curl -o scowl-35.txt "http://app.aspell.net/create?max_size=35&spelling=US&max_variant=0&diacritic=strip&download=wordlist&encoding=utf-8&format=inline"
# Size 20 (the most common words, for Easycore): the list creator now starts at 35, so it's from SCOWL 2020.12.07.
curl -LO http://downloads.sourceforge.net/wordlist/scowl-2020.12.07.tar.gz && tar xzf scowl-2020.12.07.tar.gz
(cat scowl-2020.12.07/Copyright; echo ---; cat scowl-2020.12.07/final/{english,american}-words.{10,20} | iconv -f ISO-8859-1 -t UTF-8) > scowl-20.txt
npx vite-node scripts/familiar.ts scowl-40.txt scowl-50.txt scowl-35.txt   # → data/familiar-4.txt, data/everyday-4.txt
npx vite-node scripts/familiar.ts scowl-40.txt scowl-50.txt scowl-35.txt --letters 5 scowl-20.txt   # → data/familiar-5.txt, data/everyday-5.txt, data/simple-5.txt
npx vite-node scripts/mazes.ts                   # → public/mazes.json, and its pool in public/pool.json
npx vite-node scripts/mazes.ts --letters 5       # → public/mazes-5.json, and the dailies' pool in public/pool-5.json
npx vite-node scripts/mazes.ts --letters 5 --easy   # → Easycore's pool, public/pool-5-easy.json (once shipped, keep it: see DESIGN.md)
```

Definitions (`public/definitions.json`) are built from WordNet 3.0 plus hand-written ones in `data/definitions-extra.tsv`:

```bash
curl -LO https://raw.githubusercontent.com/nltk/nltk_data/gh-pages/packages/corpora/wordnet.zip && unzip wordnet.zip
npx vite-node scripts/definitions.ts wordnet   # → public/definitions.json
npx vite-node scripts/definitions.ts wordnet --letters 5   # → public/definitions-5.json
```

Word list derived from [SCOWL](https://wordlist.aspell.net) by Kevin Atkinson (notice in DESIGN.md and in `data/familiar-4.txt`; Easycore's simplest words from SCOWL 2020.12.07, notice in `data/simple-5.txt`) and ENABLE. Definitions from [WordNet](https://wordnet.princeton.edu) 3.0, Copyright 2006 by Princeton University (licence in `data/WORDNET-LICENSE.txt`). Type: [Fredoka](https://github.com/hafontia/Fredoka-One) and [Amatic SC](https://github.com/googlefonts/AmaticSC), both under the SIL Open Font License 1.1 (notices in `public/licenses/`), from @fontsource.

# Strokes

A word maze where every letter is built from pen strokes. Each word is a room: drag strokes in from the tray, tap a stroke to remove it, drag it somewhere else, or, where a chevron, arc or bowl could start a letter either way round, twist it by circling the cursor around its spot (up to 3 strokes per step) to turn the current word into another everyday word, and find the cheapest route from the day's start word to its goal. See [DESIGN.md](DESIGN.md) for the rules and design notes.

```bash
npm install
npm run dev          # maze at http://localhost:5173, glyph gallery at /#gallery, old Smush prototype at /#smush
npm test             # game-logic and celebration tests
npm run daily        # candidates for the next daily puzzle (see below)
npm run deploy       # publish the built site (only) to https://funklunsford.github.io/strokes/
```

There's a new 5-letter puzzle every day (`src/daily/days-5/`). To add the next one, run `/daily` in Claude Code, which follows [docs/daily-prompt.md](docs/daily-prompt.md): choose the puzzle, check it, and open a pull request. (The 4-letter game's days and their win celebrations are in `src/daily/days/`; it gets no new ones.)

Every merge to `main` deploys the site through GitHub Actions (`.github/workflows/deploy.yml`). One-time setup, to let it publish:

```bash
bash scripts/setup-deploy-key.sh
```

Regenerating the words and the maze:

```bash
curl -o scowl-40.txt "http://app.aspell.net/create?max_size=40&spelling=US&max_variant=0&diacritic=strip&download=wordlist&encoding=utf-8&format=inline"
curl -o scowl-50.txt "http://app.aspell.net/create?max_size=50&spelling=US&max_variant=0&diacritic=strip&download=wordlist&encoding=utf-8&format=inline"
curl -o scowl-35.txt "http://app.aspell.net/create?max_size=35&spelling=US&max_variant=0&diacritic=strip&download=wordlist&encoding=utf-8&format=inline"
npx vite-node scripts/familiar.ts scowl-40.txt scowl-50.txt scowl-35.txt   # → data/familiar-4.txt, data/everyday-4.txt
npx vite-node scripts/familiar.ts scowl-40.txt scowl-50.txt scowl-35.txt --letters 5   # → data/familiar-5.txt, data/everyday-5.txt
npx vite-node scripts/mazes.ts                   # → public/mazes.json
npx vite-node scripts/mazes.ts --letters 5       # → public/mazes-5.json (the desktop game)
```

Definitions (`public/definitions.json`) are built from WordNet 3.0 plus hand-written ones in `data/definitions-extra.tsv`:

```bash
curl -LO https://raw.githubusercontent.com/nltk/nltk_data/gh-pages/packages/corpora/wordnet.zip && unzip wordnet.zip
npx vite-node scripts/definitions.ts wordnet   # → public/definitions.json
npx vite-node scripts/definitions.ts wordnet --letters 5   # → public/definitions-5.json
```

Word list derived from [SCOWL](https://wordlist.aspell.net) by Kevin Atkinson (notice in DESIGN.md and in `data/familiar-4.txt`) and ENABLE. Definitions from [WordNet](https://wordnet.princeton.edu) 3.0, Copyright 2006 by Princeton University (licence in `data/WORDNET-LICENSE.txt`).

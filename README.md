# Strokes

A word maze where every letter is built from pen strokes. Each word is a room: drag strokes in from the tray, tap a stroke to remove it, drag it somewhere else, or, where a chevron, arc or bowl could start a letter either way round, twist it by circling the cursor around its spot (up to 3 strokes per step) to turn the current word into another everyday word, and find the cheapest route from WILD to TAME. See [DESIGN.md](DESIGN.md) for the rules and design notes.

```bash
npm install
npm run dev          # maze at http://localhost:5173, glyph gallery at /#gallery, old Smush prototype at /#smush
npm test             # game-logic tests
npm run deploy       # publish the built site (only) to https://funklunsford.github.io/strokes/
```

Regenerating the words and the maze:

```bash
curl -o scowl-40.txt "http://app.aspell.net/create?max_size=40&spelling=US&max_variant=0&diacritic=strip&download=wordlist&encoding=utf-8&format=inline"
curl -o scowl-50.txt "http://app.aspell.net/create?max_size=50&spelling=US&max_variant=0&diacritic=strip&download=wordlist&encoding=utf-8&format=inline"
curl -o scowl-35.txt "http://app.aspell.net/create?max_size=35&spelling=US&max_variant=0&diacritic=strip&download=wordlist&encoding=utf-8&format=inline"
npx vite-node scripts/familiar.ts scowl-40.txt scowl-50.txt scowl-35.txt   # → data/familiar-4.txt, data/everyday-4.txt
npx vite-node scripts/mazes.ts                   # → public/mazes.json
```

Definitions (`public/definitions.json`) are built from WordNet 3.0 plus hand-written ones in `data/definitions-extra.tsv`:

```bash
curl -LO https://raw.githubusercontent.com/nltk/nltk_data/gh-pages/packages/corpora/wordnet.zip && unzip wordnet.zip
npx vite-node scripts/definitions.ts wordnet   # → public/definitions.json
```

Word list derived from [SCOWL](https://wordlist.aspell.net) by Kevin Atkinson (notice in DESIGN.md and in `data/familiar-4.txt`) and ENABLE. Definitions from [WordNet](https://wordnet.princeton.edu) 3.0, Copyright 2006 by Princeton University (licence in `data/WORDNET-LICENSE.txt`).

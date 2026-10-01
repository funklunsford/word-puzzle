# Stroke Smush

A word puzzle in the spirit of Hank Green's *Smush*, where the tiles are pen strokes instead of letters. Every letter you type is built from strokes on the board. Each stroke tile has limited charges, and the gold tile must be used in every word. See [DESIGN.md](DESIGN.md) for the rules and design notes.

```bash
npm install
npm run dev          # play at http://localhost:5173, glyph gallery at /#gallery
npm test             # game-logic tests
npx vite-node scripts/boards.ts   # regenerate public/boards.json from data/enable1.txt
```

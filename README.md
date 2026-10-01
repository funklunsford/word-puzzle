# Stroke Maze

A word maze where every letter is built from pen strokes. Each word is a room. Drag strokes on, off or around (up to 3 per step) to turn the current word into another real word, and find the cheapest route to the goal. See [DESIGN.md](DESIGN.md) for the rules and design notes.

```bash
npm install
npm run dev          # maze at http://localhost:5173, glyph gallery at /#gallery, old Smush prototype at /#smush
npm test             # game-logic tests
npx vite-node scripts/mazes.ts    # regenerate public/mazes.json from data/enable1.txt
```

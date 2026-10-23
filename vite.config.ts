import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';

// The data files keep their names across builds and GitHub Pages lets browsers cache them for 10
// minutes, so the game asks for them with this build's version (a hash of their contents) and new
// code never meets old cached data.
const dataVersion = createHash('sha256');
for (const file of ['mazes.json', 'pool.json', 'definitions.json', 'mazes-5.json', 'pool-5.json', 'pool-5-easy.json', 'definitions-5.json'])
  dataVersion.update(readFileSync(new URL(`./public/${file}`, import.meta.url)));

export default defineConfig({
  plugins: [react()],
  // Relative asset and data paths, so the built site works from any folder (e.g. GitHub Pages' /strokes/).
  base: './',
  define: { __DATA_VERSION__: JSON.stringify(dataVersion.digest('hex').slice(0, 10)) },
  test: {
    // Agents' worktrees live under .claude/worktrees: their copies of the tests aren't this checkout's.
    exclude: [...configDefaults.exclude, '.claude/**'],
    // Tests get empty style sheets unless they're named here: palettes.test.ts reads the stroke colours from this one.
    css: { include: [/src\/styles\.css/] },
  },
});

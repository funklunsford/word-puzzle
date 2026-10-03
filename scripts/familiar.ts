// Build the maze's word list: familiar 4-letter words.
//
//   npx vite-node scripts/familiar.ts <path-to-scowl-35.txt>
//
// Source: SCOWL / English Speller Database by Kevin Atkinson, size 35 ("small": everyday words),
// US spelling, generated at
//   http://app.aspell.net/create?max_size=35&spelling=US&max_variant=0&diacritic=strip&download=wordlist&encoding=utf-8&format=inline
// Keeps lowercase 4-letter words (capitalised entries are names and abbreviations) that are also
// valid in ENABLE, minus a blocklist, and writes data/familiar-4.txt with SCOWL's notice on top.

import { readFileSync, writeFileSync } from 'node:fs';
import { BLOCKLIST } from '../src/wordlist';

const source = process.argv[2];
if (!source) throw new Error('usage: vite-node scripts/familiar.ts <path-to-scowl-35.txt>');

const lines = readFileSync(source, 'utf8').split('\n');
const split = lines.indexOf('---');
if (split < 0) throw new Error('expected a SCOWL "inline" word list (notice, then ---, then words)');
const notice = lines.slice(0, split);

const enable = new Set(
  readFileSync(new URL('../data/enable1.txt', import.meta.url), 'utf8')
    .split('\n')
    .map((w) => w.trim().toUpperCase()),
);
const blocked = new Set(BLOCKLIST);
const words = [
  ...new Set(
    lines
      .slice(split + 1)
      .filter((w) => /^[a-z]{4}$/.test(w))
      .map((w) => w.toUpperCase()),
  ),
]
  .filter((w) => enable.has(w) && !blocked.has(w))
  .sort();

const header = [
  'Familiar 4-letter words for the stroke maze, filtered from the word list below by',
  'scripts/familiar.ts (lowercase 4-letter words also in ENABLE, minus a small blocklist).',
  '',
  ...notice,
].map((l) => `# ${l}`.trimEnd());

writeFileSync(new URL('../data/familiar-4.txt', import.meta.url), [...header, ...words, ''].join('\n'));
console.log(`wrote ${words.length} words`);

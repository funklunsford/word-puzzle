// Build the maze's word list: familiar 4-letter words.
//
//   npx vite-node scripts/familiar.ts <path-to-scowl-40.txt> <path-to-scowl-50.txt> <path-to-scowl-35.txt>
//
// Source: SCOWL / English Speller Database by Kevin Atkinson, US spelling, generated at
//   http://app.aspell.net/create?max_size=40&spelling=US&max_variant=0&diacritic=strip&download=wordlist&encoding=utf-8&format=inline
// (and the same with max_size=50). Every 4-letter word up to size 40 ("medium": everyday words)
// is kept; from size 50 only the hand-reviewed familiar words in data/familiar-extra.txt are added
// (size 50 also brings in rare ones like KITH and TYRO). Lowercase entries only (capitalised ones
// are names and abbreviations), also valid in ENABLE, minus a blocklist. Writes
// data/familiar-4.txt with SCOWL's notice on top, and data/everyday-4.txt: the ones also in size
// 35 ("small": the most everyday words), which puzzles start and end on.

import { readFileSync, writeFileSync } from 'node:fs';
import { BLOCKLIST, parseWordList } from '../src/wordlist';

const [base, wider, core] = process.argv.slice(2);
if (!base || !wider || !core) throw new Error('usage: vite-node scripts/familiar.ts <path-to-scowl-40.txt> <path-to-scowl-50.txt> <path-to-scowl-35.txt>');

/** A SCOWL "inline" word list: its notice, then ---, then the words. */
function scowl(path: string) {
  const lines = readFileSync(path, 'utf8').split('\n');
  const split = lines.indexOf('---');
  if (split < 0) throw new Error(`expected a SCOWL "inline" word list (notice, then ---, then words): ${path}`);
  const words = lines.slice(split + 1).filter((w) => /^[a-z]{4}$/.test(w)).map((w) => w.toUpperCase());
  return { notice: lines.slice(0, split), words: new Set(words) };
}
const size40 = scowl(base);
const size50 = scowl(wider);
const size35 = scowl(core);
const extra = parseWordList(readFileSync(new URL('../data/familiar-extra.txt', import.meta.url), 'utf8'));
const missing = extra.filter((w) => !size50.words.has(w));
if (missing.length) throw new Error(`not in the size-50 list: ${missing.join(' ')}`);
const notice = size40.notice;

const enable = new Set(
  readFileSync(new URL('../data/enable1.txt', import.meta.url), 'utf8')
    .split('\n')
    .map((w) => w.trim().toUpperCase()),
);
const blocked = new Set(BLOCKLIST);
const words = [...new Set([...size40.words, ...extra])].filter((w) => enable.has(w) && !blocked.has(w)).sort();

const header = [
  'Familiar 4-letter words for the stroke maze, built by scripts/familiar.ts: lowercase 4-letter',
  'words up to SCOWL size 40, plus the reviewed size-50 words in data/familiar-extra.txt, also in',
  'ENABLE, minus a small blocklist. The size-40 list notice follows (size 50 has the same terms).',
  '',
  ...notice,
].map((l) => `# ${l}`.trimEnd());

writeFileSync(new URL('../data/familiar-4.txt', import.meta.url), [...header, ...words, ''].join('\n'));
console.log(`wrote ${words.length} words`);

const everyday = words.filter((w) => size35.words.has(w));
writeFileSync(
  new URL('../data/everyday-4.txt', import.meta.url),
  [
    '# The most everyday maze words: those in data/familiar-4.txt that are also in SCOWL size 35',
    '# (same source and notice). Puzzles start and end on these; see scripts/mazes.ts.',
    ...everyday,
    '',
  ].join('\n'),
);
console.log(`wrote ${everyday.length} everyday words`);

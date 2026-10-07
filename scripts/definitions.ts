// Build a short definition for every word in the maze, from WordNet.
//
//   npx vite-node scripts/definitions.ts <path-to-wordnet-dict-dir> [--letters 5]
//
// WordNet 3.0 (Princeton University) is free to use and redistribute with its notice, which is kept
// in data/WORDNET-LICENSE.txt and in the output's "_license". The dict dir is the folder holding
// index.noun, data.noun, noun.exc and so on (e.g. nltk_data's corpora/wordnet.zip, unzipped).
//
// Each word gets WordNet's most common sense: the part of speech with the most tagged uses (nouns
// first on a tie) and that part's first synset, glossed without its examples (first clause only).
// Senses that are offensive or obscene, and proper names (HALE as Nathan Hale), are skipped: this
// is a family-friendly game, and a slur shouldn't appear even when it's WordNet's first sense.
// Inflected words are
// looked up by their base form (GODS → god, WENT → go). Words WordNet doesn't cover, mostly
// function words like THAT and YOUR, come from data/definitions-extra.tsv, which can also override
// a poor pick. Writes public/definitions.json: { WORD: [part of speech, definition, base form?] }
// (public/definitions-5.json for the 5-letter list, with --letters 5).

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseWordList } from '../src/wordlist';

const args = process.argv.slice(2);
const at = args.indexOf('--letters');
const LETTERS = at >= 0 ? Number(args.splice(at, 2)[1]) : 4;
const dir = args[0];
if (!dir || ![4, 5].includes(LETTERS)) throw new Error('usage: vite-node scripts/definitions.ts <path-to-wordnet-dict-dir> [--letters 5]');

const POS = [
  { file: 'noun', tag: 'n.', rules: [['s', ''], ['ses', 's'], ['xes', 'x'], ['zes', 'z'], ['ches', 'ch'], ['shes', 'sh'], ['men', 'man'], ['ies', 'y']] },
  { file: 'verb', tag: 'v.', rules: [['s', ''], ['ies', 'y'], ['es', 'e'], ['es', ''], ['ed', 'e'], ['ed', ''], ['ing', 'e'], ['ing', '']] },
  { file: 'adj', tag: 'adj.', rules: [['er', ''], ['est', ''], ['er', 'e'], ['est', 'e']] },
  { file: 'adv', tag: 'adv.', rules: [] },
] as const;

interface Entry {
  /** Uses tagged in WordNet's sense-tagged corpus: how common this part of speech is for the word. */
  tagged: number;
  /** Senses, most common first. */
  synsets: string[];
}

const read = (name: string) => readFileSync(join(dir, name), 'utf8');

const parts = POS.map((pos) => {
  const index = new Map<string, Entry>();
  for (const line of read(`index.${pos.file}`).split('\n')) {
    if (!line || line.startsWith(' ')) continue; // the licence header lines start with spaces
    const f = line.trim().split(/\s+/);
    const synsetCount = Number(f[2]);
    const pointerCount = Number(f[3]);
    index.set(f[0], { tagged: Number(f[5 + pointerCount]), synsets: f.slice(-synsetCount) });
  }
  const exceptions = new Map<string, string>();
  try {
    for (const line of read(`${pos.file}.exc`).split('\n')) {
      const [form, base] = line.split(' ');
      if (form && base) exceptions.set(form, base);
    }
  } catch {
    // adverbs have no exception list
  }
  const data = read(`data.${pos.file}`);
  return { ...pos, index, exceptions, data };
});

const UNSUITABLE = /offensive term|obscene|vulgar|slur|derogatory|disparaging/i;

/** A synset's words and its gloss (first clause, without quoted examples). */
function synset(data: string, offset: string) {
  const at = data.indexOf(`\n${offset} `);
  const line = data.slice(at + 1, data.indexOf('\n', at + 1));
  const f = line.split(' ');
  const count = parseInt(f[3], 16);
  // Adjectives may carry a position marker: ajar(p).
  const words = Array.from({ length: count }, (_, i) => f[4 + 2 * i].replace(/\(\w+\)$/, ""));
  const text = line.slice(line.indexOf(' | ') + 3);
  const gloss = text
    .split(/;\s*"|\s*"|;\s/)[0]
    .replace(/[;:,\s]+$/, '')
    .trim();
  return { words, gloss };
}

/** The first sense of `lemma` among `synsets` that's suitable: not offensive, and not a proper name. */
function firstSuitable(data: string, synsets: string[], lemma: string): string | null {
  for (const offset of synsets) {
    const { words, gloss } = synset(data, offset);
    if (UNSUITABLE.test(gloss)) continue;
    if (!words.includes(lemma)) continue; // only capitalised here (a name), e.g. Hale
    return gloss;
  }
  return null;
}

/** Base forms of `word` that WordNet lists under one part of speech (the word itself first). */
function bases(part: (typeof parts)[number], word: string): string[] {
  const out = [word];
  const exc = part.exceptions.get(word);
  if (exc) out.push(exc);
  for (const [suffix, ending] of part.rules) if (word.endsWith(suffix)) out.push(word.slice(0, -suffix.length) + ending);
  return out.filter((b) => part.index.has(b));
}

function define(word: string): [string, string, string?] | null {
  const lower = word.toLowerCase();
  let best: { tag: string; base: string; tagged: number; gloss: string; exact: boolean } | null = null;
  for (const part of parts) {
    for (const base of bases(part, lower)) {
      const entry = part.index.get(base)!;
      const gloss = firstSuitable(part.data, entry.synsets, base);
      if (!gloss) continue;
      const candidate = { tag: part.tag, base, tagged: entry.tagged, gloss, exact: base === lower };
      // The word as itself beats an inflection of something else; then the most-used sense wins.
      if (!best || (candidate.exact && !best.exact) || (candidate.exact === best.exact && candidate.tagged > best.tagged)) best = candidate;
      break;
    }
  }
  if (!best) return null;
  return best.base === lower ? [best.tag, best.gloss] : [best.tag, best.gloss, best.base];
}

const words = parseWordList(readFileSync(new URL(`../data/familiar-${LETTERS}.txt`, import.meta.url), 'utf8'));
const extra = new Map(
  parseWordList(readFileSync(new URL('../data/definitions-extra.tsv', import.meta.url), 'utf8')).map((line) => {
    const [word, tag, definition] = line.split('\t');
    return [word, [tag, definition] as [string, string]];
  }),
);

const out: Record<string, [string, string, string?] | string> = {
  _license: `Definitions from WordNet 3.0, Copyright 2006 by Princeton University. All rights reserved. See data/WORDNET-LICENSE.txt.`,
};
const missing: string[] = [];
for (const w of words) {
  const d = extra.get(w) ?? define(w);
  if (d) out[w] = d;
  else missing.push(w);
}
writeFileSync(new URL(LETTERS === 4 ? '../public/definitions.json' : `../public/definitions-${LETTERS}.json`, import.meta.url), JSON.stringify(out));
console.log(`defined ${words.length - missing.length} of ${words.length} words${missing.length ? `; missing: ${missing.join(' ')}` : ''}`);

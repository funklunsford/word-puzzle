// The maze's word list: familiar 4-letter words (data/familiar-4.txt, built by scripts/familiar.ts).

/** Sexual terms, slurs and swears kept out of the maze. Mild words (DUMB, POOP, PUKE, DOPE, BUTT, FART) are fine. */
export const BLOCKLIST = [
  ...['COCK', 'SLUT', 'TITS', 'RAPE', 'DYKE', 'ANAL', 'ANUS', 'HOES', 'SEXY', 'NUDE', 'HUMP', 'GAYS', 'CRAP', 'DAMN', 'HELL'],
  // From SCOWL size 40 and up.
  ...['FUCK', 'SHIT', 'PISS', 'DICK', 'TURD', 'PORN', 'BOOB', 'PIMP', 'FAGS', 'GYPS', 'COON', 'GOOK'],
];

/** Words from a word-list file: one per line, `#` lines are the attribution header. */
export function parseWordList(text: string): string[] {
  return text.split('\n').filter((w) => w && !w.startsWith('#'));
}

// The maze's word lists: familiar 4-letter words (data/familiar-4.txt), and 5-letter ones for the
// desktop game (data/familiar-5.txt), both built by scripts/familiar.ts.

/** Sexual terms, slurs and swears kept out of the maze. Mild words (DUMB, POOP, PUKE, DOPE, BUTT, FART) are fine. */
export const BLOCKLIST = [
  ...['COCK', 'SLUT', 'TITS', 'RAPE', 'DYKE', 'ANAL', 'ANUS', 'HOES', 'SEXY', 'NUDE', 'HUMP', 'GAYS', 'CRAP', 'DAMN', 'HELL'],
  // From SCOWL size 40 and up.
  ...['FUCK', 'SHIT', 'PISS', 'DICK', 'TURD', 'PORN', 'BOOB', 'PIMP', 'FAGS', 'GYPS', 'COON', 'GOOK'],
  // Found in a review of the whole list (2026-10-05): sexual, crude, or a slur in one sense.
  ...['ORGY', 'SMUT', 'LEWD', 'SLAG', 'DIKE', 'NIPS', 'MUFF'],
  // 5-letter words, from a review of SCOWL size 40 (2026-10-07), on the same terms as the 4-letter ones.
  ...['FUCKS', 'SHITS', 'DICKS', 'COCKS', 'TURDS', 'PRICK', 'BITCH', 'WHORE', 'SLUTS', 'PUSSY', 'BOOBS', 'BOOBY', 'DAMNS', 'CRAPS', 'ASSES'],
  ...['PENIS', 'SEMEN', 'SPERM', 'HORNY', 'KINKY', 'SEXED', 'NUDES', 'NUDER', 'HUMPS', 'SMUTS', 'RAPED', 'RAPES', 'PIMPS', 'BIMBO'],
  ...['CHINK', 'DYKES', 'FAGOT', 'QUEER', 'BAWDY', 'PINUP', 'DIKED'],
  // 5-letter words from a review of SCOWL size 50 and ENABLE (2026-10-07).
  ...['PUBIC'],
  ...['BONER', 'BUTCH', 'COONS', 'DARKY', 'DILDO', 'DONGS', 'GIMPS', 'GIMPY', 'GONAD', 'GOOKS', 'HOMOS', 'HONKY', 'HUSSY', 'HYMEN', 'KIKES'],
  ...['KRAUT', 'LABIA', 'NUDIE', 'POOFS', 'PORNO', 'PORNY', 'PUBES', 'PUBIS', 'RANDY', 'SEXTS', 'SHAGS', 'SLAGS', 'SPICS', 'SQUAW', 'TITTY'],
  ...['TWATS', 'VULVA', 'WILLY'],
];

/** Words from a word-list file: one per line, `#` lines are the attribution header. */
export function parseWordList(text: string): string[] {
  return text.split('\n').filter((w) => w && !w.startsWith('#'));
}

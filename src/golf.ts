// A solve's score named the way golf names one, by how many strokes over the lowest possible it
// took: Ace for the lowest possible, then Albatross, Eagle, Birdie, Par, Bogey, and past that just
// the strokes over.

const NAMES = ['Ace', 'Albatross', 'Eagle', 'Birdie', 'Par', 'Bogey', 'Bogey'];

/** The name for a solve of `strokes` whose lowest possible is `best`: up to Bogey (5 or 6 over), then "+7 over" and so on. */
export function scoreName(strokes: number, best: number): string {
  const over = Math.max(0, strokes - best);
  return over < NAMES.length ? NAMES[over] : `+${over} over`;
}

/** The names in order, with how far over the lowest possible each one is, for How to play. */
export const SCORE_KEY = 'Ace for the lowest possible strokes, then Albatross (+1), Eagle (+2), Birdie (+3), Par (+4) and Bogey (+5 or 6)';

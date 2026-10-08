// Which game a visit plays: 5-letter words on a desktop or laptop (a wide window with a mouse or
// trackpad), 4-letter words everywhere else (phones and tablets keep today's game). Decided once per
// load, so resizing a window never swaps games mid-play. The fiveLetters flag (src/flags.ts) gives
// phones and tablets the 5-letter game too, and `?letters=4` or `?letters=5` overrides both, for
// testing.

export type WordLength = 4 | 5;

/** The narrowest window that gets the 5-letter game (the board needs room for five letters). */
export const DESKTOP_MIN = 900;

export function chooseLetters({ fine, width, asked, everywhere = false }: { fine: boolean; width: number; asked: string | null; everywhere?: boolean }): WordLength {
  if (asked === '4' || asked === '5') return Number(asked) as WordLength;
  if (everywhere) return 5;
  return fine && width >= DESKTOP_MIN ? 5 : 4;
}

/** This visit's game, from the device and the address (`everywhere`: the fiveLetters flag). */
export const loadLetters = (everywhere = false): WordLength =>
  chooseLetters({
    fine: !!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches,
    width: window.innerWidth,
    asked: new URLSearchParams(location.search).get('letters'),
    everywhere,
  });

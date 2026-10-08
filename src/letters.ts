// Which game a visit plays: 5-letter words on a desktop or laptop (a wide window with a mouse or
// trackpad), 4-letter words everywhere else (phones and tablets keep today's game). Decided once per
// load, so resizing a window never swaps games mid-play. `?letters=4` or `?letters=5` overrides it,
// for testing.

export type WordLength = 4 | 5;

/** The narrowest window that gets the 5-letter game (the board needs room for five letters). */
export const DESKTOP_MIN = 900;

export function chooseLetters({ fine, width, asked }: { fine: boolean; width: number; asked: string | null }): WordLength {
  if (asked === '4' || asked === '5') return Number(asked) as WordLength;
  return fine && width >= DESKTOP_MIN ? 5 : 4;
}

/** This visit's game, from the device and the address. */
export const loadLetters = (): WordLength =>
  chooseLetters({
    fine: !!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches,
    width: window.innerWidth,
    asked: new URLSearchParams(location.search).get('letters'),
  });

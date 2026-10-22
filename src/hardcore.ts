// Hardcore (Settings: the Hardcore switch, or Difficulty → Hardcore with the easycore flag): only
// words on a lowest-stroke route open, each reached on par, and there are no hints. Turning it on
// starts a puzzle in progress over, so a hardcore result never carries strokes, words or hints from
// before; turning it off lets the puzzle go on. The choice is kept with the difficulty setting
// (src/easycore.ts), under its old key too.

/**
 * Whether the puzzle has started, so turning hardcore on starts it over: a word made, a stroke on
 * the board, or a hint taken (which hardcore wouldn't have given).
 */
export function hasStarted({ words, strokes, hints }: { words: number; strokes: number; hints: number }): boolean {
  return words > 0 || strokes > 0 || hints > 0;
}

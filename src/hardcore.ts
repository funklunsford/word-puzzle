// Hardcore (Settings → Playing): only words on a lowest-stroke route open, each reached on par,
// and there are no hints. Turning it on starts a puzzle in progress over, so a hardcore result never
// carries strokes, words or hints from before; turning it off lets the puzzle go on. Kept in this
// browser.

const KEY = 'strokes:hardcore';

/** Whether hardcore is on (storage can be missing or blocked: then it's off). */
export function loadHardcore(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function saveHardcore(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    // storage blocked: this visit only
  }
}

/**
 * Whether the puzzle has started, so turning hardcore on starts it over: a word made, a stroke on
 * the board, or a hint taken (which hardcore wouldn't have given).
 */
export function hasStarted({ words, strokes, hints }: { words: number; strokes: number; hints: number }): boolean {
  return words > 0 || strokes > 0 || hints > 0;
}

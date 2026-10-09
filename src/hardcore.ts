// Hardcore (Settings → Playing): only words on a lowest-stroke route open, each reached on par,
// and there are no hints. Like Wordle's hard mode it's chosen before a puzzle starts, so switching
// it never restarts one in progress. Kept in this browser.

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
 * Whether the switch is locked: once the puzzle has started (a word made, a stroke on the board,
 * or a hint taken, which hardcore wouldn't have given) it stays as it is until Restart. Undoing
 * every stroke of the first step unlocks it again.
 */
export function hardcoreLocked({ words, strokes, hints }: { words: number; strokes: number; hints: number }): boolean {
  return words > 0 || strokes > 0 || hints > 0;
}

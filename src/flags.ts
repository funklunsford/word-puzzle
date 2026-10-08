// Feature flags for modifiers being playtested. Each has a default here; the Dev section of the
// side card toggles them (remembered in this browser), and a link can set them with
// ?flags=inkPots (on) or ?flags=-inkPots (off).

export const FLAGS = {
  inkPots: { label: 'Ink pots', on: false },
  // Off: every load plays the day's puzzle (src/daily), with its celebration. On: a random puzzle
  // from the pool on each load.
  freshPuzzle: { label: 'New puzzle each load', on: false },
  // Off: only a desktop gets the 5-letter game (see src/letters.ts). On (for everyone since
  // 2026-10-08): phones and tablets do too, with the word given more of a phone's width. Takes
  // effect on the next load; ?flags=-fiveLetters or ?letters=4 plays the 4-letter game.
  fiveLetters: { label: '5 letters on phones and tablets', on: true },
} as const;

export type Flag = keyof typeof FLAGS;
export type Flags = Record<Flag, boolean>;

const KEY = 'strokes:flags';

export function loadFlags(): Flags {
  const flags = Object.fromEntries(Object.entries(FLAGS).map(([k, v]) => [k, v.on])) as Flags;
  try {
    Object.assign(flags, JSON.parse(localStorage.getItem(KEY) ?? '{}'));
  } catch {
    // storage blocked or unreadable: defaults
  }
  for (const item of new URLSearchParams(location.search).get('flags')?.split(',') ?? []) {
    const name = item.replace(/^-/, '');
    if (name in FLAGS) flags[name as Flag] = !item.startsWith('-');
  }
  return flags;
}

export function saveFlags(flags: Flags) {
  try {
    localStorage.setItem(KEY, JSON.stringify(flags));
  } catch {
    // ignore
  }
}

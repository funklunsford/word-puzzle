// The player's settings (the gear), beyond light or dark (see theme.ts): motion, swipe to turn, the
// letter guide, definitions, and colour-blind squares. Kept in this browser.

import { createContext, useContext } from 'react';
import { useMedia } from './useMedia';

/** Motion: the device's setting, or less (no springs, slides or celebration animation) or full whatever it says. */
export type MotionChoice = 'system' | 'less' | 'full';

export interface Prefs {
  motion: MotionChoice;
  /** A swipe turns a stroke as it's placed (off: only a double-tap or double-click turns one). */
  swipe: boolean;
  /** The A to Z under the word, lighting the letters a stroke is in. */
  letters: boolean;
  /** The current word's meaning under it. */
  definitions: boolean;
  /** The result card's squares in yellow, blue and red, so none has to be told from another by red and orange alone. */
  colorBlind: boolean;
}

export const DEFAULT_PREFS: Prefs = { motion: 'system', swipe: true, letters: true, definitions: true, colorBlind: false };

const KEY = 'strokes:prefs';
const REDUCE = '(prefers-reduced-motion: reduce)';

export function loadPrefs(): Prefs {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    const p = { ...DEFAULT_PREFS };
    if (['system', 'less', 'full'].includes(saved.motion)) p.motion = saved.motion;
    for (const k of ['swipe', 'letters', 'definitions', 'colorBlind'] as const) if (typeof saved[k] === 'boolean') p[k] = saved[k];
    return p;
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function savePrefs(p: Prefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // storage blocked: this visit only
  }
  applyMotion(p.motion);
}

/** Less motion, as the page's CSS sees it: <html data-motion="less"> (index.html sets it before the first paint). */
export function applyMotion(choice: MotionChoice) {
  const less = choice === 'less' || (choice === 'system' && !!window.matchMedia?.(REDUCE).matches);
  document.documentElement.dataset.motion = less ? 'less' : 'full';
}

/** Keep "system" in step with the device. Returns the unsubscribe. */
export function followSystemMotion(choice: () => MotionChoice) {
  const q = window.matchMedia?.(REDUCE);
  if (!q) return () => {};
  const on = () => choice() === 'system' && applyMotion('system');
  q.addEventListener('change', on);
  return () => q.removeEventListener('change', on);
}

export const PrefsContext = createContext<Prefs>(DEFAULT_PREFS);
export const usePrefs = () => useContext(PrefsContext);

/** Whether to keep motion down: the player's choice (from settings, or given), else the device's. */
export function useReduceMotion(choice?: MotionChoice): boolean {
  const fromSettings = usePrefs().motion;
  const motion = choice ?? fromSettings;
  const system = useMedia(REDUCE);
  return motion === 'system' ? system : motion === 'less';
}

/** Motion's own reduced-motion setting, for <MotionConfig>. */
export const motionConfig = (choice: MotionChoice) => (choice === 'system' ? 'user' : choice === 'less' ? 'always' : 'never');

// Light or dark: the player's choice (Settings), or the device's ("system"). The page's colours
// follow <html data-theme>, which index.html sets before anything is drawn, so there's no flash.

export type ThemeChoice = 'system' | 'light' | 'dark';

const KEY = 'strokes:theme';
const darkQuery = () => window.matchMedia?.('(prefers-color-scheme: dark)');

export function loadTheme(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

export function applyTheme(choice: ThemeChoice) {
  const dark = choice === 'dark' || (choice === 'system' && !!darkQuery()?.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

export function saveTheme(choice: ThemeChoice) {
  try {
    localStorage.setItem(KEY, choice);
  } catch {
    // storage blocked: this visit only
  }
  applyTheme(choice);
}

/** Keep "system" in step with the device (dark at sunset, say). Returns the unsubscribe. */
export function followSystemTheme(choice: () => ThemeChoice) {
  const q = darkQuery();
  if (!q) return () => {};
  const on = () => choice() === 'system' && applyTheme('system');
  q.addEventListener('change', on);
  return () => q.removeEventListener('change', on);
}

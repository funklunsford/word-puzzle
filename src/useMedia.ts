import { useEffect, useState } from 'react';

/** Whether a CSS media query matches, kept up to date (e.g. '(pointer: coarse)' for touch screens). */
export function useMedia(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setMatches(m.matches);
    on();
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, [query]);
  return matches;
}

/** Touch screens (a finger, not a mouse), where strokes are turned by tapping them in the tray. */
export const COARSE = '(pointer: coarse)';

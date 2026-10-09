import { useEffect, useRef } from 'react';
import { AD_CLIENT, adsReady } from '../ads';

declare global {
  interface Window {
    adsbygoogle?: object[];
  }
}

/**
 * One ad, in a box of a fixed size (its space is held whether or not an ad fills it). An aside
 * labelled as an advertisement, so screen readers can tell it from the game and skip it. In
 * development the box shows a dashed outline and its size, to judge the layout by.
 */
export function AdSlot({ slot, width, height, className, label = 'Advertisement' }: { slot: string; width: number; height: number; className: string; label?: string }) {
  const asked = useRef(false);
  useEffect(() => {
    // Ask AdSense to fill this box, once (StrictMode runs effects twice in development, and a
    // second request for the same box is an error). Nothing happens until real IDs are in src/ads.ts.
    if (!adsReady() || asked.current) return;
    asked.current = true;
    try {
      (window.adsbygoogle ??= []).push({});
    } catch {
      // an ad blocker, or the script failed: the box just stays empty
    }
  }, []);
  return (
    <aside className={`ad-slot ${className}${import.meta.env.DEV ? ' dev' : ''}`} aria-label={label} data-size={`${width}×${height}`}>
      <ins className="adsbygoogle" style={{ display: 'block', width, height }} data-ad-client={AD_CLIENT} data-ad-slot={slot} />
    </aside>
  );
}

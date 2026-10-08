// Ad slots, behind the `ads` flag (src/flags.ts, off by default). Phones get one banner at the top;
// a desktop wide enough gets a vertical rail either side of the game; everything in between gets
// none. Each slot is an AdSense-ready <ins class="adsbygoogle"> (src/components/AdSlot.tsx), with
// its space reserved, so nothing moves when an ad fills it.

/*
 * FILL IN HERE once AdSense is set up (AdSense > Ads > By ad unit: make a display unit for each).
 * The client is the publisher ID, "ca-pub-" and 16 digits; each slot is a unit's 10-digit ID.
 * While the client is the placeholder, no script loads and the slots stay empty.
 */
export const AD_CLIENT = 'ca-pub-0000000000000000';
export const AD_SLOTS = {
  /** Phones: the banner over the header (a fixed 320×100 unit, which also takes 320×50 ads). */
  banner: '0000000000',
  /** Desktop: the rails left and right of the game (fixed 160×600 or 300×600 units). */
  railLeft: '0000000000',
  railRight: '0000000000',
} as const;

/** Whether real IDs have been filled in above. */
export const adsReady = () => /^ca-pub-\d{16}$/.test(AD_CLIENT) && !/^ca-pub-0+$/.test(AD_CLIENT);

/** The phone banner's reserved box: wide enough for 320×50 and 320×100, tall enough for the taller. */
export const BANNER = { w: 320, h: 100 };
/** The rails' heights; their width is 160, or 300 where there's room (see railWidth). */
export const RAIL_H = 600;
export const RAIL_WIDTHS = [300, 160] as const;
export type RailWidth = (typeof RAIL_WIDTHS)[number] | 0;

/** The page's grid gap between columns and its side padding (.maze in styles.css). */
const GAP = 24;
const PAD = 16;
/** A window's width counts its scrollbar, which the page can't use (17 px on Windows; a little over, to be safe). */
const SCROLLBAR = 20;

/**
 * How wide each rail is in a window this wide (0: no rails), beside a game of these columns (the
 * main column and the path card, at their full widths). Both rails fit beside the game, each with
 * a gap, or neither shows: the game is never squeezed to make room.
 */
export function railWidth(windowW: number, column: number, side: number): RailWidth {
  return RAIL_WIDTHS.find((rail) => windowW >= railsMin(column, side, rail)) ?? 0;
}

/** The narrowest window with room for rails this wide either side of the game. */
export const railsMin = (column: number, side: number, rail: number) => column + GAP + side + 2 * (rail + GAP) + 2 * PAD + SCROLLBAR;

/*
 * The AdSense script, loaded once and only with the flag on and real IDs filled in above (so the
 * placeholder build makes no request to Google). It's added here rather than in index.html so
 * players without the flag never load it. (For AdSense's site review Google may ask for its
 * snippet in index.html's <head> instead: that loads it for everyone, flag or not.)
 */
let loading = false;
export function loadAdSense() {
  if (loading || !adsReady()) return;
  loading = true;
  const script = document.createElement('script');
  script.async = true;
  script.crossOrigin = 'anonymous';
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${AD_CLIENT}`;
  document.head.appendChild(script);
}

// The stroke colours a player can choose (Settings > Stroke colours). The page takes them from
// src/styles.css, by <html data-palette> (set before the first paint by public/boot.js). This table
// is the same colours for what's drawn without the page's CSS: the result card (share.ts).
// palettes.test.ts checks the two agree, and that every colour stands out from a letter's cell
// (at least 4.5:1, in its theme).
//
// Each palette is nine colours for light pages and nine for dark. How far apart they are, measured
// as CIEDE2000 with colour blindness simulated (Machado, Oliveira and Fernandes, 2009), is in
// DESIGN.md ("Stroke colours"). In short:
// - Earth, the game's own: muted earth pigments.
// - Bright: Earth's hues, as vivid as they go. The most distinct for most eyes.
// - Ocean: blues, teals, greens and violets, strokes of alike shapes kept apart in lightness.
// - Clear: for colour blindness. Blues, near-neutrals and yellows at three lightnesses (what
//   red-green colour blindness still sees), so no two strokes look alike with protanopia,
//   deuteranopia or tritanopia either. The other three each have pairs that do.

import type { TileId } from './glyphs';

export type PaletteChoice = 'earth' | 'bright' | 'ocean' | 'clear';

export interface Palette {
  choice: PaletteChoice;
  label: string;
  light: Record<TileId, string>;
  dark: Record<TileId, string>;
}

export const PALETTES: Palette[] = [
  {
    choice: 'earth',
    label: 'Earth',
    light: { LV: '#395a7b', H: '#a84409', LD: '#3e580c', LB: '#4b6c2f', SB: '#0a6b5d', BV: '#7f5608', SC: '#934974', C: '#6f5899', P: '#a53c42' },
    dark: { LV: '#8fa6bf', H: '#d98a68', LD: '#a9bf8e', LB: '#7f9c6a', SB: '#6fb0a3', BV: '#dcb064', SC: '#c18aa8', C: '#a596c4', P: '#d6908f' },
  },
  {
    choice: 'bright',
    label: 'Bright',
    light: { LV: '#025dc9', H: '#c14802', LD: '#547a02', LB: '#046d36', SB: '#017b80', BV: '#9c6900', SC: '#b80f79', C: '#6a29c5', P: '#c50220' },
    dark: { LV: '#67aaff', H: '#fe9052', LD: '#ade74e', LB: '#39d075', SB: '#36dede', BV: '#ffcd45', SC: '#fb75bb', C: '#ad8dfd', P: '#fa686a' },
  },
  {
    choice: 'ocean',
    label: 'Ocean',
    light: { LV: '#133c8b', H: '#0c796e', LD: '#006943', LB: '#077fa8', SB: '#563199', BV: '#98449e', SC: '#015353', C: '#0060a6', P: '#448335' },
    dark: { LV: '#678dee', H: '#6ce2d1', LD: '#61d19a', LB: '#9fe3fe', SB: '#a58bec', BV: '#e5aee8', SC: '#39abab', C: '#73b6fa', P: '#a7f695' },
  },
  {
    choice: 'clear',
    label: 'Clear',
    light: { LV: '#035eaa', H: '#923f00', LD: '#936e03', LB: '#623512', SB: '#00736a', BV: '#0680a6', SC: '#6e1250', C: '#1a358d', P: '#c23870' },
    dark: { LV: '#7bc6ff', H: '#f8ab4f', LD: '#fee657', LB: '#e87e42', SB: '#52d7c1', BV: '#abeeff', SC: '#e16fbf', C: '#7999f5', P: '#fec5da' },
  },
];

export const isPalette = (v: unknown): v is PaletteChoice => PALETTES.some((p) => p.choice === v);

/** A palette by its name (Earth for one it doesn't know). */
export const palette = (choice: PaletteChoice): Palette => PALETTES.find((p) => p.choice === choice) ?? PALETTES[0];

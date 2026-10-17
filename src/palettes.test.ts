import { describe, expect, it } from 'vitest';
import { PALETTES, isPalette, palette, type PaletteChoice } from './palettes';
import { TILE_IDS } from './glyphs';
import stylesText from './styles.css?raw';

// (A newline first, so the file's first rule starts a line like the rest.)
const css = `\n${stylesText}`;

/** The custom properties a rule in styles.css sets (its first rule with exactly this selector). */
function rule(selector: string): Record<string, string> {
  const at = css.indexOf(`\n${selector} {`);
  expect(at, `styles.css has no rule for ${selector}`).toBeGreaterThanOrEqual(0);
  const body = css.slice(css.indexOf('{', at) + 1, css.indexOf('}', at));
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

/** A palette's stroke colours as the page has them: Earth's are the themes' own, the others are by data-palette. */
function pageColours(choice: PaletteChoice, dark: boolean) {
  const selector =
    choice === 'earth' ? (dark ? ":root[data-theme='dark']" : ':root') : dark ? `:root[data-theme='dark'][data-palette='${choice}']` : `:root[data-palette='${choice}']`;
  const props = rule(selector);
  return Object.fromEntries(Object.entries(props).filter(([k]) => k.startsWith('t-')).map(([k, v]) => [k.slice(2), v]));
}

/** WCAG's contrast ratio between two #rrggbb colours. */
function contrast(a: string, b: string) {
  const lum = (h: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('stroke colours', () => {
  it('has every stroke in every palette, light and dark', () => {
    for (const p of PALETTES) for (const set of [p.light, p.dark]) expect(Object.keys(set).sort()).toEqual([...TILE_IDS].sort());
  });

  it('matches the page (styles.css), so the result card shows what the player sees', () => {
    for (const p of PALETTES) {
      expect(pageColours(p.choice, false), `${p.label}, light`).toEqual(p.light);
      expect(pageColours(p.choice, true), `${p.label}, dark`).toEqual(p.dark);
    }
  });

  it('stands out from a letter\'s cell: at least 4.5:1 in its theme', () => {
    const cell = { light: rule(':root').surface, dark: rule(":root[data-theme='dark']").surface };
    for (const p of PALETTES)
      for (const t of TILE_IDS) {
        expect(contrast(p.light[t], cell.light), `${p.label} ${t}, light`).toBeGreaterThanOrEqual(4.5);
        expect(contrast(p.dark[t], cell.dark), `${p.label} ${t}, dark`).toBeGreaterThanOrEqual(4.5);
      }
  });

  it('gives each palette its own colours', () => {
    const seen = new Set(PALETTES.map((p) => JSON.stringify(p.light)));
    expect(seen.size).toBe(PALETTES.length);
  });

  it("knows its palettes' names, and falls back to Earth", () => {
    expect(PALETTES.map((p) => p.choice)).toEqual(['earth', 'bright', 'ocean', 'clear']);
    expect(isPalette('ocean')).toBe(true);
    expect(isPalette('neon')).toBe(false);
    expect(isPalette(undefined)).toBe(false);
    expect(palette('neon' as PaletteChoice).choice).toBe('earth');
  });
});

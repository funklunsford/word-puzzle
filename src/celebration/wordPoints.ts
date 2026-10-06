import { LETTERS, drawnScale, drawnWidth, type TileId } from '../glyphs';
import { lookCenterline, strokeCenterline, type Pt } from '../ink';

const GAP = 0.7;

/** A word's strokes as centrelines in word units (letters on one baseline, centred on the origin, y up). */
export function wordStrokes(word: string): { tile: TileId; pts: Pt[] }[] {
  let x = 0;
  const out: { tile: TileId; pts: Pt[] }[] = [];
  for (const ch of word) {
    const g = LETTERS[ch];
    const { shape: squeeze, place } = drawnScale(ch);
    for (const p of g.parts) {
      const line = p.look ? lookCenterline(p, p.look, squeeze) : strokeCenterline(p.tile, p.rot ?? 0, squeeze);
      out.push({ tile: p.tile, pts: line.map(([lx, ly]): Pt => [x + p.x * place + lx, p.y + ly]) });
    }
    x += drawnWidth(ch) + GAP;
  }
  const width = x - GAP;
  // Centre it, with y pointing up (glyphs are drawn y-down, 0 to 2).
  return out.map((s) => ({ tile: s.tile, pts: s.pts.map(([px, py]): Pt => [px - width / 2, 1 - py]) }));
}

/** The width of a word laid out as above. */
export const wordWidth = (word: string) => [...word].reduce((t, ch) => t + drawnWidth(ch), 0) + GAP * (word.length - 1);

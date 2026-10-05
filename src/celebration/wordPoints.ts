import { LETTERS, drawnWidth, type TileId } from '../glyphs';
import { lookCenterline, strokeCenterline, type Pt } from '../ink';

const GAP = 0.7;

/** A word's strokes as centrelines in word units (letters on one baseline, centred on the origin, y up). */
export function wordStrokes(word: string): { tile: TileId; pts: Pt[] }[] {
  let x = 0;
  const out: { tile: TileId; pts: Pt[] }[] = [];
  for (const ch of word) {
    const g = LETTERS[ch];
    const squeeze = g.squeeze ?? 1;
    for (const p of g.parts) {
      const line = p.look ? lookCenterline(p, p.look, squeeze) : strokeCenterline(p.tile, p.rot ?? 0, squeeze);
      out.push({ tile: p.tile, pts: line.map(([lx, ly]): Pt => [x + p.x * squeeze + lx, p.y + ly]) });
    }
    x += drawnWidth(ch) + GAP;
  }
  const width = x - GAP;
  // Centre it, with y pointing up (glyphs are drawn y-down, 0 to 2).
  return out.map((s) => ({ tile: s.tile, pts: s.pts.map(([px, py]): Pt => [px - width / 2, 1 - py]) }));
}

/** The width of a word laid out as above. */
export const wordWidth = (word: string) => [...word].reduce((t, ch) => t + drawnWidth(ch), 0) + GAP * (word.length - 1);

/**
 * `n` points spread evenly along a word's strokes (by length), each nudged across its stroke by up
 * to `pen` units so the letters read as inked, with the stroke type each point came from.
 */
export function samplePoints(word: string, n: number, pen: number, random: () => number) {
  const strokes = wordStrokes(word).map((s) => {
    const lens = s.pts.slice(1).map((p, i) => Math.hypot(p[0] - s.pts[i][0], p[1] - s.pts[i][1]));
    return { ...s, lens, length: lens.reduce((t, l) => t + l, 0) };
  });
  const total = strokes.reduce((t, s) => t + s.length, 0);
  const xy = new Float32Array(n * 2);
  const tiles: TileId[] = [];
  for (let i = 0; i < n; i++) {
    let at = ((i + random()) / n) * total;
    const s = strokes.find((q) => (at -= q.length) < 0) ?? strokes[strokes.length - 1];
    let along = at + s.length;
    let k = 0;
    while (k < s.lens.length - 1 && along > s.lens[k]) along -= s.lens[k++];
    const [a, b] = [s.pts[k], s.pts[k + 1]];
    const f = s.lens[k] ? Math.min(1, along / s.lens[k]) : 0;
    const nx = -(b[1] - a[1]) / (s.lens[k] || 1);
    const ny = (b[0] - a[0]) / (s.lens[k] || 1);
    const off = (random() + random() - 1) * pen;
    xy[i * 2] = a[0] + (b[0] - a[0]) * f + nx * off;
    xy[i * 2 + 1] = a[1] + (b[1] - a[1]) * f + ny * off;
    tiles.push(s.tile);
  }
  return { xy, tiles };
}

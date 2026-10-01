import { LETTERS, TILES, placementTransform, type Placement, type TileId } from '../glyphs';

export const STROKE = 0.2;
const PAD = 0.3;

export function TileStroke({ tile, transform }: { tile: TileId; transform?: string }) {
  return (
    <path
      className="stroke"
      d={TILES[tile].path}
      transform={transform}
      stroke={`var(--t-${tile})`}
      strokeWidth={STROKE}
    />
  );
}

export function PlacedStrokes({ parts }: { parts: Placement[] }) {
  return (
    <>
      {parts.map((part, i) => (
        <TileStroke key={i} tile={part.tile} transform={placementTransform(part)} />
      ))}
    </>
  );
}

/** A single letter as its own SVG, `size` px tall at cap height. */
export function Glyph({ letter, size = 64 }: { letter: string; size?: number }) {
  const glyph = LETTERS[letter];
  const w = glyph.width + PAD * 2;
  const h = 2 + PAD * 2 + 0.6; // room for Q's tail
  return (
    <svg
      viewBox={`${-PAD} ${-PAD} ${w} ${h}`}
      height={(size * h) / 2}
      width={(size * w) / 2}
      aria-label={letter}
    >
      <PlacedStrokes parts={glyph.parts} />
    </svg>
  );
}

const GAP = 0.7;

/** A whole word laid out on one baseline. */
export function GlyphWord({ word, size = 48 }: { word: string; size?: number }) {
  let x = 0;
  const letters = [...word].map((ch) => {
    const at = x;
    x += LETTERS[ch].width + GAP;
    return { ch, at };
  });
  const w = Math.max(x - GAP, 0) + PAD * 2;
  const h = 2 + PAD * 2 + 0.6;
  return (
    <svg viewBox={`${-PAD} ${-PAD} ${w} ${h}`} height={(size * h) / 2} width={(size * w) / 2} aria-label={word}>
      {letters.map(({ ch, at }, i) => (
        <g key={i} transform={`translate(${at} 0)`}>
          <PlacedStrokes parts={LETTERS[ch].parts} />
        </g>
      ))}
    </svg>
  );
}

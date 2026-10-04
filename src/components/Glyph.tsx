import { LETTERS, drawnWidth, type Placement, type TileId } from '../glyphs';
import { inkOutline, inkSeed } from '../ink';

const PAD = 0.3;

/** Smallest stroke half-width (in units) that still draws ~1.2 px thick at `pxPerUnit`. */
export const minHalfWidthAt = (pxPerUnit: number) => 0.6 / pxPerUnit;

interface TileStrokeProps {
  tile: TileId;
  /** Degrees clockwise. */
  rot?: number;
  x?: number;
  y?: number;
  minHalfWidth?: number;
  /** Wobble seed; defaults to the stroke's own (see inkSeed). Pass it when drawing at the origin. */
  seed?: number;
  /** Overrides the stroke's colour (e.g. a removal tint). */
  fill?: string;
  className?: string;
  /** Narrow the stroke horizontally (a formed W); see LetterGlyph.squeeze. */
  squeeze?: number;
  /** Drawn length as a fraction of the stroke's own (G's short bar); see Placement.len. */
  len?: number;
}

/** SVG scale that shortens a stroke along its own axis, about its centre. */
export const lengthScale = (rot = 0, len = 1) => (len === 1 ? '' : (rot % 180 === 0 ? `scale(${len} 1)` : `scale(1 ${len})`));

/** One stroke, drawn in ink (see ink.ts). The only place strokes are rendered. */
export function TileStroke({ tile, rot = 0, x = 0, y = 0, minHalfWidth = 0, seed, fill, className = 'ink', squeeze = 1, len = 1 }: TileStrokeProps) {
  const transform = `${x || y ? `translate(${x} ${y}) ` : ''}${lengthScale(rot, len)}`.trim();
  return (
    <path
      className={className}
      d={inkOutline(tile, rot, seed ?? inkSeed({ tile, x, y, rot }), minHalfWidth, squeeze)}
      transform={transform || undefined}
      fill={fill ?? `var(--t-${tile})`}
    />
  );
}

/** A letter's strokes in its own coordinates; `squeeze` narrows it towards x = 0. */
export function PlacedStrokes({ parts, minHalfWidth, squeeze = 1 }: { parts: Placement[]; minHalfWidth?: number; squeeze?: number }) {
  return (
    <>
      {parts.map((part, i) => (
        <TileStroke
          key={i}
          tile={part.tile}
          rot={part.rot}
          x={part.x * squeeze}
          y={part.y}
          seed={inkSeed(part)}
          minHalfWidth={minHalfWidth}
          squeeze={squeeze}
          len={part.len}
        />
      ))}
    </>
  );
}

/** A single letter as its own SVG, `size` px tall at cap height. */
export function Glyph({ letter, size = 64 }: { letter: string; size?: number }) {
  const glyph = LETTERS[letter];
  const w = drawnWidth(letter) + PAD * 2;
  const h = 2 + PAD * 2 + 0.6; // room for Q's tail
  return (
    <svg
      viewBox={`${-PAD} ${-PAD} ${w} ${h}`}
      height={(size * h) / 2}
      width={(size * w) / 2}
      aria-label={letter}
    >
      <PlacedStrokes parts={glyph.parts} minHalfWidth={minHalfWidthAt(size / 2)} squeeze={glyph.squeeze} />
    </svg>
  );
}

const GAP = 0.7;

/** A whole word laid out on one baseline. */
export function GlyphWord({ word, size = 48 }: { word: string; size?: number }) {
  let x = 0;
  const letters = [...word].map((ch) => {
    const at = x;
    x += drawnWidth(ch) + GAP;
    return { ch, at };
  });
  const w = Math.max(x - GAP, 0) + PAD * 2;
  const h = 2 + PAD * 2 + 0.6;
  return (
    <svg viewBox={`${-PAD} ${-PAD} ${w} ${h}`} height={(size * h) / 2} width={(size * w) / 2} aria-label={word}>
      {letters.map(({ ch, at }, i) => (
        <g key={i} transform={`translate(${at} 0)`}>
          <PlacedStrokes parts={LETTERS[ch].parts} minHalfWidth={minHalfWidthAt(size / 2)} squeeze={LETTERS[ch].squeeze} />
        </g>
      ))}
    </svg>
  );
}

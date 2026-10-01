import { useEffect, useRef } from 'react';
import { AnimatePresence, type AnimationScope } from 'motion/react';
import { LETTERS, type TileId } from '../glyphs';
import { PlacedStrokes } from './Glyph';
import { Stroke } from './Stroke';

const GAP = 0.7;
const HEIGHT = 2.9;

interface Props {
  word: string;
  maxWidth: number;
  tileEl: (tile: TileId) => Element | null;
  scope: AnimationScope;
  /** A letter to preview, faintly, where the next letter would go. */
  ghost: string | null;
}

/** The word being typed, assembled from strokes. */
export function WordLine({ word, maxWidth, tileEl, scope, ghost }: Props) {
  let at = 0;
  const letters = [...word].map((ch) => {
    const x = at;
    at += LETTERS[ch].width + GAP;
    return { ch, x };
  });
  const total = Math.max(at - GAP, 0);
  const ghostWidth = ghost ? LETTERS[ghost].width : 0;
  // Shrink letters when the word gets long so it always fits on one line.
  const unit = Math.min(26, (maxWidth - 24) / Math.max(total + (ghost ? GAP + ghostWidth : 0), 8));

  // Keep the word centered, but hold still while strokes fly back to their tiles: exiting
  // strokes aim at a fixed target, so moving the layer under them would make them miss.
  const prevOffset = useRef(0);
  const prevTotal = useRef(0);
  const shrinking = total < prevTotal.current;
  const offset = total > 0 ? (-total * unit) / 2 : ghost ? (-ghostWidth * unit) / 2 : prevOffset.current;
  useEffect(() => {
    prevOffset.current = offset;
    prevTotal.current = total;
  });

  return (
    <div className="word-line" ref={scope} style={{ height: HEIGHT * unit + 16 }}>
      <div
        className="word-layer"
        style={{
          top: 0.35 * unit + 8,
          transform: `translateX(${offset}px)`,
          transitionDelay: shrinking ? '0.45s' : '0s',
        }}
      >
        <AnimatePresence>
          {letters.flatMap(({ ch, x }, li) =>
            LETTERS[ch].parts.map((part, pi) => (
              <Stroke
                key={`${li}-${ch}-${pi}`}
                part={part}
                cx={(x + part.x) * unit}
                cy={part.y * unit}
                unit={unit}
                delay={pi * 0.045}
                tileEl={tileEl}
              />
            )),
          )}
        </AnimatePresence>
        {ghost && (
          <svg
            className="ghost"
            style={{ left: ((word ? at : 0) - 0.5) * unit, width: (ghostWidth + 1) * unit, height: 2.6 * unit }}
            viewBox={`-0.5 0 ${ghostWidth + 1} 2.6`}
          >
            <PlacedStrokes parts={LETTERS[ghost].parts} />
          </svg>
        )}
      </div>
      {!word && !ghost && <span className="word-placeholder">type a word</span>}
    </div>
  );
}

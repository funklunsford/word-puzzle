import { useEffect, useRef } from 'react';
import { AnimatePresence, type AnimationScope } from 'motion/react';
import { LETTERS, type TileId } from '../glyphs';
import { Stroke } from './Stroke';

const GAP = 0.7;
const HEIGHT = 2.9;

interface Props {
  word: string;
  maxWidth: number;
  tileEl: (tile: TileId) => Element | null;
  scope: AnimationScope;
}

/** The word being typed, assembled from strokes. */
export function WordLine({ word, maxWidth, tileEl, scope }: Props) {
  let at = 0;
  const letters = [...word].map((ch) => {
    const x = at;
    at += LETTERS[ch].width + GAP;
    return { ch, x };
  });
  const total = Math.max(at - GAP, 0);
  // Shrink letters when the word gets long so it always fits on one line.
  const unit = Math.min(26, (maxWidth - 24) / Math.max(total, 8));

  // Keep the word centered, but hold still while strokes fly back to their tiles: exiting
  // strokes aim at a fixed target, so moving the layer under them would make them miss.
  const prevOffset = useRef(0);
  const prevTotal = useRef(0);
  const shrinking = total < prevTotal.current;
  const offset = total > 0 ? (-total * unit) / 2 : prevOffset.current;
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
      </div>
      {!word && <span className="word-placeholder">type a word</span>}
    </div>
  );
}

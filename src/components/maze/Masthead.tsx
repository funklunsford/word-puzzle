import { motion } from 'motion/react';
import { LETTERS, TILES, TILE_IDS, drawnScale, drawnWidth } from '../../glyphs';
import { inkSeed } from '../../ink';
import { spaced } from '../../spacing';
import { TileStroke } from '../Glyph';

const WORDMARK = 'STROKES';
/** The wordmark's pen: a fifth broader than the game's, so the name stands out but still matches the tray. */
const BOLD = 1.2;
/** Parts row: one tile per stroke type, above the wordmark. */
const PART = 1.6;
const PART_GAP = 0.45;
const PART_Y = -2.6;
const PART_SCALE = 0.55;

interface Placed {
  key: string;
  tile: (typeof TILE_IDS)[number];
  x: number;
  y: number;
  rot: number;
  seed: number;
  /** Where its part tile sits, relative to the stroke's place in the wordmark. */
  from: { x: number; y: number; rot: number };
}

/** Lay out the wordmark and the parts row, and work out where each stroke flies in from. */
function layout() {
  const raw: Omit<Placed, 'from'>[] = [];
  // The letters, optically spaced (see spacing.ts).
  const starts = spaced(WORDMARK, BOLD);
  for (const [li, ch] of [...WORDMARK].entries()) {
    for (const [pi, p] of LETTERS[ch].parts.entries()) {
      raw.push({ key: `${li}-${pi}`, tile: p.tile, x: starts[li] + p.x * drawnScale(ch).place, y: p.y, rot: p.rot ?? 0, seed: inkSeed(p) });
    }
  }
  const markWidth = starts[WORDMARK.length - 1] + drawnWidth(WORDMARK[WORDMARK.length - 1]);
  const rowWidth = TILE_IDS.length * PART + (TILE_IDS.length - 1) * PART_GAP;
  // Centre the wordmark and the parts row in whichever is wider.
  const width = Math.max(markWidth, rowWidth);
  const left = (width - markWidth) / 2;
  const strokes = raw.map((s) => ({ ...s, x: s.x + left }));
  const rowStart = (width - rowWidth) / 2 + PART / 2;
  const parts = TILE_IDS.map((tile, i) => ({ tile, x: rowStart + i * (PART + PART_GAP), y: PART_Y }));
  const placed: Placed[] = strokes.map((s) => {
    const part = parts.find((p) => p.tile === s.tile)!;
    return { ...s, from: { x: part.x - s.x, y: part.y - s.y, rot: (TILES[s.tile].display ?? 0) - s.rot } };
  });
  return { width, parts, placed };
}

const { width, parts, placed } = layout();
const PAD = 0.5;

/** When the `i`th stroke sets off for its letter (its fade in, too). */
const setOff = (i: number) => 0.2 + i * 0.045;

/**
 * The header graphic: the nine strokes as a parts row, and the name built from them. On load every
 * stroke leaves its part tile, turns and snaps into its letter, the way players build words. On
 * phones (`compact`) only the name is shown, its strokes flying in from above, to leave the screen to
 * the game.
 */
/** The wordmark, with an optional line under it (the daily's number and date), and buttons in its corner (the gear). */
export function Masthead({ compact = false, dateline, actions }: { compact?: boolean; dateline?: string; actions?: React.ReactNode }) {
  const top = compact ? -PAD : PART_Y - PART / 2 - PAD;
  return (
    <header className="masthead">
      <svg className="masthead-art" viewBox={`${-PAD} ${top} ${width + 2 * PAD} ${2.4 + PAD - top}`} role="img" aria-label="Strokes">
        {!compact && parts.map((p) => (
          <g key={p.tile} transform={`translate(${p.x} ${p.y})`}>
            <rect
              className="part-tile"
              x={-PART / 2}
              y={-PART / 2}
              width={PART}
              height={PART}
              rx={0.38}
              style={{ ['--tile' as string]: `var(--t-${p.tile})` }}
            />
            <g transform={`scale(${PART_SCALE})`}>
              <TileStroke tile={p.tile} rot={TILES[p.tile].display} />
            </g>
          </g>
        ))}
        {placed.map((s, i) => (
          <g key={s.key} transform={`translate(${s.x} ${s.y})`}>
            <motion.g
              initial={{ x: s.from.x, y: s.from.y, rotate: s.from.rot, scale: PART_SCALE, opacity: 0 }}
              animate={{ x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 }}
              transition={{ type: 'spring', bounce: 0.2, duration: 0.7, delay: setOff(i), opacity: { duration: 0.15, delay: setOff(i) } }}
            >
              <TileStroke tile={s.tile} rot={s.rot} seed={s.seed} weight={BOLD} />
            </motion.g>
          </g>
        ))}
      </svg>
      {dateline && <p className="dateline">{dateline}</p>}
      {actions && <div className="masthead-actions">{actions}</div>}
    </header>
  );
}

import { useId } from 'react';
import { motion } from 'motion/react';
import { LETTERS, TILES, TILE_IDS, drawnScale, drawnWidth, type TileId } from '../../glyphs';
import { inkOutline, inkSeed, type Pt } from '../../ink';
import { profileOf, spaced } from '../../spacing';
import { TileStroke } from '../Glyph';

const WORDMARK = 'DIPLETS';
/** The wordmark's pen: a fifth broader than the game's, so the name stands out but still matches the tray. */
const BOLD = 1.2;
/**
 * A gold pen nib before the D, a cap height tall: an arched top, rounded shoulders and sides
 * sweeping in to a fine point, with a breather hole and a slit cut through it. It leans `tilt`
 * degrees about its middle, its point towards the D, and sits `room` further from the D than the
 * letters' own spacing would put it. It's dipped in ink (see .nib-ink in styles.css).
 */
const NIB = { tilt: -20, room: 0.3 };
/** The nib's right side, from the middle of its top to its point: a quadratic, then two cubics. Its left side mirrors it. */
const NIB_SIDE: Pt[][] = [
  [[0, 0], [0.22, -0.01], [0.42, 0.06]],
  [[0.42, 0.06], [0.5, 0.2], [0.54, 0.38], [0.53, 0.55]],
  [[0.53, 0.55], [0.51, 0.95], [0.15, 1.55], [0, 2]],
];
const mirror = ([x, y]: Pt): Pt => [-x, y];
const curve = (seg: Pt[]) => `${seg.length === 3 ? 'Q' : 'C'}${seg.slice(1).map(([x, y]) => `${x} ${y}`).join(' ')}`;
/** The nib's outline, then its breather hole and slit (cut through it by filling even-odd). */
const NIB_PATH = [
  'M0 0',
  ...NIB_SIDE.map(curve),
  ...[...NIB_SIDE].reverse().map((seg) => curve([...seg].reverse().map(mirror))),
  'Z M0.085 0.82 A0.085 0.085 0 1 0 -0.085 0.82 A0.085 0.085 0 1 0 0.085 0.82 Z M-0.02 0.905 L0.02 0.905 L0.01 1.97 L-0.01 1.97 Z',
].join(' ');
/** A point `t` of the way along a Bézier segment. */
function bezier(seg: Pt[], t: number): Pt {
  let pts = seg;
  while (pts.length > 1) pts = pts.slice(1).map((p, i): Pt => [pts[i][0] + (p[0] - pts[i][0]) * t, pts[i][1] + (p[1] - pts[i][1]) * t]);
  return pts[0];
}
/** A point of the nib, leaning by its tilt about its middle (0, 1). */
function tilted([x, y]: Pt): Pt {
  const t = (NIB.tilt * Math.PI) / 180;
  return [x * Math.cos(t) - (y - 1) * Math.sin(t), 1 + x * Math.sin(t) + (y - 1) * Math.cos(t)];
}
/** The leaning nib's outline as points, its middle at 0: what the name is spaced from. */
const NIB_PROFILE = (() => {
  const side = NIB_SIDE.flatMap((seg) => Array.from({ length: 16 }, (_, i) => bezier(seg, (i + 1) / 16)));
  const outline: Pt[] = [[0, 0], ...side, ...[...side].reverse().map(mirror)];
  return profileOf([outline.map(tilted)]);
})();
/** How far the leaning nib reaches left of its middle. */
const NIB_LEAD = -Math.min(...NIB_PROFILE.left.filter(Number.isFinite));
/** The ink it was dipped in, up to a wavy line across its lower part (clipped to the nib). */
const NIB_INK = 'M-0.7 1.27 C-0.42 1.15 -0.2 1.35 0 1.25 C0.2 1.15 0.42 1.35 0.7 1.22 L0.7 2.1 L-0.7 2.1 Z';
/**
 * Ink run down from the D's bowl (its letter and part), `x` right of its stem: a neck `neck` wide
 * each side, flaring where it leaves the stroke, down to a teardrop of radius `drop` whose centre is
 * `len` below the ink's edge.
 */
const DRIP = { letter: 0, part: 1, x: 0.36, len: 0.42, neck: 0.05, flare: 0.07, drop: 0.1 };
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

/** Lay out the wordmark (the nib, then the name) and the parts row, and work out where each stroke flies in from. */
function layout() {
  const raw: Omit<Placed, 'from'>[] = [];
  // The letters after the nib, optically spaced (see spacing.ts), from the nib's left edge.
  const starts = spaced(WORDMARK, BOLD, NIB_PROFILE).map((x) => x + NIB_LEAD + NIB.room);
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
  const stem = strokes.find((s) => s.key === `${DRIP.letter}-0`)!;
  const bowl = strokes.find((s) => s.key === `${DRIP.letter}-${DRIP.part}`)!;
  const hang = stem.x + DRIP.x;
  // The ink's lower edge there, and how it slopes (the bowl curves up towards its right).
  const slope = (inkFoot(bowl, hang + 0.1) - inkFoot(bowl, hang - 0.1)) / 0.2;
  return { width, parts, placed, nib: left + NIB_LEAD, drip: { tile: bowl.tile, x: hang, y: inkFoot(bowl, hang), slope, order: strokes.indexOf(bowl) } };
}

/** How far down a placed stroke's ink reaches at `x` (its outline has a point about every 0.02 units). */
function inkFoot(s: Omit<Placed, 'from'>, x: number) {
  const nums = inkOutline(s.tile, s.rot, s.seed, 0, 1, undefined, [0, 0], BOLD).match(/-?\d*\.?\d+/g)!.map(Number);
  let foot = -Infinity;
  for (let i = 0; i < nums.length; i += 2) if (Math.abs(nums[i] + s.x - x) < 0.03) foot = Math.max(foot, nums[i + 1]);
  return s.y + foot;
}

const { width, parts, placed, nib, drip } = layout();
const PAD = 0.5;

/**
 * A closed outline about x = 0, `half(y)` wide each side at each of `ys`, its sides lifted by
 * `tilt(y)` per unit out (right side up for a negative tilt).
 */
function symmetric(ys: number[], half: (y: number) => number, tilt: (y: number) => number = () => 0) {
  const at = (x: number, y: number) => `${x.toFixed(3)} ${(y + tilt(y) * x).toFixed(3)}`;
  return `M${ys.map((y) => at(-half(y), y)).join(' L')} L${[...ys].reverse().map((y) => at(half(y), y)).join(' L')} Z`;
}
const steps = (from: number, to: number, n: number) => Array.from({ length: n + 1 }, (_, i) => from + ((to - from) * i) / n);
/**
 * The drip's neck, from inside the ink down to the drop's centre: thinning a little, and flaring
 * where it leaves the stroke, the flare tilted to the ink's edge (`slope`) so none of it shows above.
 */
function neck(slope: number) {
  const flare = (y: number) => Math.exp(-Math.max(0, y) / 0.05);
  return symmetric(steps(-0.08, DRIP.len, 30), (y) => DRIP.neck * (1 - (0.2 * Math.max(0, y)) / DRIP.len) + DRIP.flare * flare(y), (y) => slope * flare(y));
}
const NECK = neck(drip.slope);
/**
 * A drop of radius `r`, centred on the origin: a circle drawn up into a point 3 radii above its
 * centre, so whatever it hangs from swells into it (the sides run on tangent to the circle from a
 * third of a radius above it).
 */
function teardrop(r: number) {
  const ys = [...steps(-3 * r, -r / 3, 8), ...steps(-r / 3, r, 16).slice(1)];
  return symmetric(ys, (y) => (y <= -r / 3 ? (y + 3 * r) / Math.sqrt(8) : Math.sqrt(Math.max(0, r * r - y * y))));
}
const DROP = teardrop(DRIP.drop);
/** Once the D has landed (`LANDED` after its bowl sets off), a bead of ink swells under it, then creeps down and stops. */
const DRIP_RUN = { duration: 1.8, times: [0, 0.2, 1], ease: 'easeOut' as const };
const LANDED = 0.8;

/** When the `i`th stroke sets off for its letter (its fade in, too). */
const setOff = (i: number) => 0.2 + i * 0.045;

/**
 * Ink run down from the D's bowl (see DRIP), hanging from `x, y` on the ink's lower edge. It fades
 * in with the bowl (the `order`th stroke), so with less motion, when it's drawn whole at once, it
 * never hangs there before the letter does.
 */
function Drip({ x, y, tile, order }: { x: number; y: number; tile: TileId; order: number }) {
  const run = { ...DRIP_RUN, delay: setOff(order) + LANDED };
  return (
    <g className="drip" transform={`translate(${x} ${y})`} fill={`var(--t-${tile})`}>
      <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15, delay: setOff(order) }}>
        <motion.path d={NECK} style={{ originY: 0 }} initial={{ scaleY: 0 }} animate={{ scaleY: [0, 0, 1] }} transition={run} />
        <g transform={`translate(0 ${DRIP.len})`}>
          <motion.path
            d={DROP}
            // Grow about the drop's centre, three quarters of the way down its outline.
            style={{ originY: 0.75 }}
            initial={{ y: -DRIP.len, scale: 0 }}
            animate={{ y: [-DRIP.len, -DRIP.len, 0], scale: [0, 0.7, 1] }}
            transition={run}
          />
        </g>
      </motion.g>
    </g>
  );
}

/**
 * The nib (see NIB), its middle at `x`. It drops in first, then ink climbs its tip as if it had
 * just been dipped.
 */
function Nib({ x }: { x: number }) {
  const clip = useId();
  return (
    <g className="nib" transform={`translate(${x} 0)`}>
      <motion.g
        initial={{ y: -1.2, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', bounce: 0.2, duration: 0.7, delay: 0.1, opacity: { duration: 0.15, delay: 0.1 } }}
      >
        <g transform={`rotate(${NIB.tilt} 0 1)`}>
          <defs>
            <clipPath id={clip}>
              <path d={NIB_PATH} clipRule="evenodd" />
            </clipPath>
          </defs>
          <path d={NIB_PATH} fillRule="evenodd" fill="var(--gold)" />
          <g clipPath={`url(#${clip})`}>
            <motion.path
              d={NIB_INK}
              className="nib-ink"
              style={{ originY: 1 }}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ duration: 0.5, delay: 0.6, ease: 'easeOut' }}
            />
          </g>
        </g>
      </motion.g>
    </g>
  );
}

/**
 * The header graphic: the nine strokes as a parts row, and the wordmark: a pen nib and the name
 * built from the strokes. On load every stroke leaves its part tile, turns and snaps into its
 * letter, the way players build words. On phones (`compact`) only the wordmark is shown, its
 * strokes flying in from above, to leave the screen to the game.
 */
/** The wordmark, with an optional line under it (the daily's number and date), and buttons in its corner (the gear). */
export function Masthead({ compact = false, dateline, actions }: { compact?: boolean; dateline?: string; actions?: React.ReactNode }) {
  const top = compact ? -PAD : PART_Y - PART / 2 - PAD;
  return (
    <header className="masthead">
      <svg className="masthead-art" viewBox={`${-PAD} ${top} ${width + 2 * PAD} ${2.4 + PAD - top}`} role="img" aria-label="Diplets">
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
        <Nib x={nib} />
        <Drip x={drip.x} y={drip.y} tile={drip.tile} order={drip.order} />
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

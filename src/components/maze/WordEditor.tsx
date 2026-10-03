import { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { LETTERS, TILES, TILE_IDS, xExtent, type Placement, type TileId } from '../../glyphs';
import { inkSeed } from '../../ink';
import { EMPTY_CELL_X, recognize, slotKey, slotsFor, type Slot } from '../../strokes';
import { TileStroke, minHalfWidthAt } from '../Glyph';

const CELL_W = 4;
const CELL_TOP = -0.7;
const CELL_H = 3.6;
/** A press that moves less than this many pixels is a tap (remove), not a drag. */
const TAP_SLOP = 6;
/** Tray tiles draw their 2.4-unit box in about 40 px. */
const TRAY_PX_PER_UNIT = 40 / 2.4;
const PLACE_SPRING = { type: 'spring', stiffness: 600, damping: 20 } as const;

// Twisting (units, in the cell's coordinates). Bring the cursor within ARM of the spot a rotatable
// stroke is locked onto, then circle around the spot to turn it; straight moves don't turn it.
// Moving further than RELEASE from the spot lets the stroke lock onto a different spot.
const ARM = 0.45;
const RELEASE = 1.6;
const RING = 0.95;

const norm = (deg: number) => ((deg % 360) + 360) % 360;
/** Shortest signed angle from one direction to another, in degrees. */
const wrap = (deg: number) => norm(deg + 180) - 180;
/** The quarter turn nearest to `turn` (unwrapped, so turn − quarter is the leftover twist). */
const quarter = (turn: number) => Math.round(turn / 90) * 90;

type Source = { kind: 'tray' } | { kind: 'cell'; cell: number; index: number };

/** The spot a rotatable stroke is locked onto while it's held over a cell. */
interface Aim {
  cell: number;
  x: number;
  y: number;
  /** The cursor has been brought onto the spot, so circling it now twists the stroke. */
  armed: boolean;
  /** Cursor's last angle around the spot (degrees), or null when it's too close to measure. */
  angle: number | null;
}

interface Drag {
  tile: TileId;
  source: Source;
  /** Where the press started, to tell a tap from a drag. */
  startX: number;
  startY: number;
  /** Set once the pointer has moved TAP_SLOP away: only then is the press a drag. */
  moved: boolean;
  x: number;
  y: number;
  /** Orientation of the held stroke in degrees (continuous while it's being twisted). */
  turn: number;
  /** Valid drop slots per cell (every orientation that fits), computed when the drag starts. */
  slots: Slot[][];
  aim: Aim | null;
  /** Where a release would place the stroke, if its current orientation fits there. */
  target: { cell: number; slot: Slot } | null;
  /** The cell under the pointer: the only one that previews (and accepts) a drop. */
  overCell: number | null;
  overWord: boolean;
}

interface Props {
  cells: Placement[][];
  unit: number;
  disabled: boolean;
  onEdit: (next: Placement[][]) => void;
  onHoverTile: (tile: TileId | null) => void;
}

/** Offset that centers a cell's strokes horizontally. */
function centerOffset(content: Placement[]): number {
  if (!content.length) return -EMPTY_CELL_X;
  const [lo, hi] = xExtent(content);
  return -(lo + hi) / 2;
}

/**
 * The current word as editable strokes, plus the tray of strokes to drag in. Drag a stroke in
 * from the tray, drag a placed stroke to move it (or off the word to remove it), tap a placed
 * stroke to remove it, and twist chevrons, arcs and bowls by circling the cursor around their spot.
 */
export function WordEditor({ cells, unit, disabled, onEdit, onHoverTile }: Props) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const [hover, setHover] = useState<{ cell: number; key: string } | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const svgs = useRef<(SVGSVGElement | null)[]>([]);
  const wordRef = useRef<HTMLDivElement>(null);

  const offsets = useMemo(() => cells.map(centerOffset), [cells]);
  const minHalf = minHalfWidthAt(unit);

  const without = (cell: number, source: Source | undefined) =>
    source?.kind === 'cell' && source.cell === cell ? cells[cell].filter((_, i) => i !== source.index) : cells[cell];

  /** Where the held stroke is over the word: the cell, the spot it's locked onto, its twist, and the drop. */
  const locate = (d: Drag, x: number, y: number): Pick<Drag, 'target' | 'aim' | 'turn' | 'overCell' | 'overWord'> => {
    const inside = (el: Element | null | undefined) => {
      const r = el?.getBoundingClientRect();
      return !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    };
    const toCell = (cell: number) => {
      const m = svgs.current[cell]?.getScreenCTM();
      if (!m) return null;
      const p = new DOMPoint(x, y).matrixTransform(m.inverse());
      return { lx: p.x - offsets[cell], ly: p.y };
    };
    // A locked stroke keeps its spot while the cursor circles nearby, even past the cell's edge
    // (a V's partner spot for W sits right at the edge).
    let overCell: number | null = null;
    if (d.aim) {
      const q = toCell(d.aim.cell);
      if (q && Math.hypot(q.lx - d.aim.x, q.ly - d.aim.y) <= RELEASE) overCell = d.aim.cell;
    }
    if (overCell === null) {
      const c = svgs.current.findIndex((el) => inside(el));
      overCell = c >= 0 ? c : null;
    }
    const overWord = inside(wordRef.current);
    const m = overCell !== null ? svgs.current[overCell]?.getScreenCTM() : null;
    if (overCell === null || !m || !d.slots[overCell].length) {
      return { overCell, overWord, target: null, aim: null, turn: d.turn };
    }
    const p = new DOMPoint(x, y).matrixTransform(m.inverse());
    const lx = p.x - offsets[overCell];
    const ly = p.y;
    const slots = d.slots[overCell];
    const dist = (q: { x: number; y: number }) => Math.hypot(q.x - lx, q.y - ly);
    const nearest = slots.reduce((a, b) => (dist(b.placement) < dist(a.placement) ? b : a));

    // Fixed strokes simply go to the nearest spot.
    if (!TILES[d.tile].rotates) return { overCell, overWord, target: { cell: overCell, slot: nearest }, aim: null, turn: d.turn };

    // Rotatable strokes lock onto a spot; circling the cursor around it turns them.
    let aim = d.aim;
    const stray = !aim || aim.cell !== overCell || dist(aim) > RELEASE;
    if (stray && (!aim || aim.cell !== overCell || aim.x !== nearest.placement.x || aim.y !== nearest.placement.y)) {
      aim = { cell: overCell, x: nearest.placement.x, y: nearest.placement.y, armed: false, angle: null };
    }
    let turn = d.turn;
    if (dist(aim!) < ARM) {
      aim = { ...aim!, armed: true, angle: null };
    } else if (aim!.armed) {
      const angle = (Math.atan2(ly - aim!.y, lx - aim!.x) * 180) / Math.PI;
      if (aim!.angle !== null) turn += wrap(angle - aim!.angle);
      aim = { ...aim!, angle };
    }
    const q = norm(quarter(turn));
    const slot = slots.find((s) => s.placement.x === aim!.x && s.placement.y === aim!.y && norm(s.placement.rot ?? 0) === q);
    return { overCell, overWord, target: slot ? { cell: overCell, slot } : null, aim, turn };
  };

  const finish = (d: Drag) => {
    const next = cells.map((c) => [...c]);
    if (!d.moved) {
      // A tap on a placed stroke removes it.
      if (d.source.kind === 'cell') {
        next[d.source.cell].splice(d.source.index, 1);
        onEdit(next);
      }
      return;
    }
    if (d.target) {
      if (d.source.kind === 'cell') {
        const original = cells[d.source.cell][d.source.index];
        if (d.source.cell === d.target.cell && slotKey(original) === slotKey(d.target.slot.placement)) return;
        next[d.source.cell].splice(d.source.index, 1);
      }
      next[d.target.cell].push(d.target.slot.placement);
      onEdit(next);
    } else if (d.source.kind === 'cell' && !d.overWord) {
      next[d.source.cell].splice(d.source.index, 1);
      onEdit(next);
    }
  };

  // Listeners are attached synchronously on pointer-down (not in an effect) so a quick flick
  // can't release before they exist.
  const start = (e: React.PointerEvent, tile: TileId, rot: number, source: Source) => {
    if (disabled || dragRef.current) return;
    e.preventDefault();
    const slots = cells.map((_, c) => slotsFor(without(c, source), tile));
    const d0: Drag = {
      tile,
      source,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
      x: e.clientX,
      y: e.clientY,
      turn: rot,
      slots,
      aim: null,
      target: null,
      overCell: null,
      overWord: true,
    };
    dragRef.current = d0;
    setDrag(d0);
    setHover(null);
    const update = (ev: PointerEvent) => {
      const d = dragRef.current!;
      const moved = d.moved || Math.hypot(ev.clientX - d.startX, ev.clientY - d.startY) >= TAP_SLOP;
      const nd = { ...d, moved, x: ev.clientX, y: ev.clientY, ...(moved ? locate(d, ev.clientX, ev.clientY) : {}) };
      dragRef.current = nd;
      return nd;
    };
    const onMove = (ev: PointerEvent) => setDrag(update(ev));
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      const d = update(ev);
      dragRef.current = null;
      setDrag(null);
      onHoverTile(null);
      if (ev.type === 'pointerup') finish(d);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  /** Press on a placed stroke. Looked up by position, so a stroke that's animating out is ignored. */
  const pressPlaced = (e: React.PointerEvent, cell: number, p: Placement) => {
    const index = cells[cell].findIndex((q) => slotKey(q) === slotKey(p));
    if (index >= 0) start(e, p.tile, p.rot ?? 0, { kind: 'cell', cell, index });
  };

  const held = drag?.moved ? drag : null;
  // While dragging, the carried stroke leaves its cell (a tap leaves it in place until released).
  const carried = held?.source.kind === 'cell' ? held.source : null;
  const removing = !!held && held.source.kind === 'cell' && !held.target && !held.aim && !held.overWord;

  return (
    <div className={`editor${disabled ? ' disabled' : ''}`}>
      <div className="word-cells" ref={wordRef}>
        {cells.map((content, c) => {
          const letter = recognize(content);
          const squeeze = (letter && LETTERS[letter].squeeze) || 1;
          const [lo, hi] = content.length ? xExtent(content) : [0, 0];
          const squeezed = (x: number) => (lo + hi) / 2 + (x - (lo + hi) / 2) * squeeze;
          const shown = content.filter((_, i) => !(carried?.cell === c && carried.index === i));
          const target = held?.target?.cell === c ? held.target : null;
          const aim = held?.aim?.cell === c ? held.aim : null;
          // Nothing fits here, or the held stroke's current orientation doesn't: the letter goes red.
          const noFit = !!held && held.overCell === c && !held.slots[c].length;
          const misfit = !!aim && !target;
          const red = noFit || misfit;
          return (
            <div className={`cell${letter ? ' formed' : ''}${red ? ' red' : ''}`} key={c}>
              <svg
                ref={(el) => {
                  svgs.current[c] = el;
                }}
                viewBox={`${-CELL_W / 2} ${CELL_TOP} ${CELL_W} ${CELL_H}`}
                width={CELL_W * unit}
                height={CELL_H * unit}
              >
                <g className="cell-content" style={{ transform: `translate(${offsets[c]}px, 0px)` }}>
                  <AnimatePresence>
                    {shown.map((p) => {
                      const key = slotKey(p);
                      const x = squeezed(p.x);
                      const removable = !drag && !disabled && hover?.cell === c && hover.key === key;
                      return (
                        <motion.g
                          key={key}
                          className="placed"
                          initial={{ scale: 1.3, opacity: 0.4 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.5, opacity: 0, transition: { duration: 0.18 } }}
                          transition={PLACE_SPRING}
                        >
                          <TileStroke
                            tile={p.tile}
                            rot={p.rot}
                            x={x}
                            y={p.y}
                            seed={inkSeed(p)}
                            minHalfWidth={minHalf}
                            squeeze={squeeze}
                            fill={red ? 'var(--spicy)' : undefined}
                          />
                          {removable && (
                            <TileStroke
                              tile={p.tile}
                              rot={p.rot}
                              x={x}
                              y={p.y}
                              seed={inkSeed(p)}
                              minHalfWidth={minHalf}
                              squeeze={squeeze}
                              fill="var(--spicy)"
                              className="remove-tint"
                            />
                          )}
                          <path
                            className="hit"
                            d={TILES[p.tile].path}
                            transform={`translate(${x} ${p.y})${squeeze !== 1 ? ` scale(${squeeze} 1)` : ''}${p.rot ? ` rotate(${p.rot})` : ''}`}
                            onPointerDown={(e) => pressPlaced(e, c, p)}
                            onPointerEnter={() => {
                              onHoverTile(p.tile);
                              if (!dragRef.current) setHover({ cell: c, key });
                            }}
                            onPointerLeave={() => {
                              onHoverTile(null);
                              setHover(null);
                            }}
                          >
                            <title>Tap to remove · drag to move</title>
                          </path>
                        </motion.g>
                      );
                    })}
                  </AnimatePresence>
                  {held && aim && (
                    <Held tile={held.tile} x={aim.x} y={aim.y} turn={held.turn} fits={!!target} ring minHalfWidth={minHalf} />
                  )}
                  {held && !aim && target && (
                    <Held
                      tile={held.tile}
                      x={target.slot.placement.x}
                      y={target.slot.placement.y}
                      turn={target.slot.placement.rot ?? 0}
                      fits
                      minHalfWidth={minHalf}
                    />
                  )}
                </g>
              </svg>
              <span className="cell-letter">
                {target ? `→ ${target.slot.toward.join(' ')}` : misfit ? '↻ circle to turn' : noFit ? 'no fit' : (letter ?? '·')}
              </span>
            </div>
          );
        })}
      </div>

      <div className={`tray${removing ? ' removing' : ''}`}>
        {removing ? (
          <span className="tray-hint">Drop to remove</span>
        ) : (
          TILE_IDS.map((t) => (
            <button
              key={t}
              className="tray-tile"
              title={TILES[t].rotates ? `${TILES[t].name}: circle the cursor around its spot to turn it` : TILES[t].name}
              onPointerDown={(e) => start(e, t, TILES[t].display ?? 0, { kind: 'tray' })}
              onPointerEnter={() => onHoverTile(t)}
              onPointerLeave={() => onHoverTile(null)}
            >
              <svg viewBox="-1.2 -1.2 2.4 2.4">
                <TileStroke tile={t} rot={TILES[t].display} minHalfWidth={minHalfWidthAt(TRAY_PX_PER_UNIT)} />
              </svg>
              {TILES[t].rotates && (
                <span className="rotate-badge" aria-hidden>
                  ↻
                </span>
              )}
            </button>
          ))
        )}
      </div>

      {held && !held.aim && !held.target && (
        <svg
          className="drag-ghost"
          viewBox="-1.2 -1.2 2.4 2.4"
          width={2.4 * unit}
          height={2.4 * unit}
          style={{ left: held.x - 1.2 * unit, top: held.y - 1.2 * unit }}
        >
          <Turned tile={held.tile} turn={held.turn} minHalfWidth={minHalf} />
        </svg>
      )}
    </div>
  );
}

/** A stroke at any angle: inked at the nearest quarter turn, then turned the rest of the way. */
function Turned({ tile, turn, minHalfWidth, fill }: { tile: TileId; turn: number; minHalfWidth: number; fill?: string }) {
  const q = quarter(turn);
  return (
    <g transform={turn !== q ? `rotate(${turn - q})` : undefined}>
      <TileStroke tile={tile} rot={norm(q)} minHalfWidth={minHalfWidth} fill={fill} />
    </g>
  );
}

/**
 * The held stroke shown on the spot it would drop into, at its current orientation: in its
 * colour when that orientation fits, red when it doesn't. A faint ring marks where to circle.
 */
function Held(props: { tile: TileId; x: number; y: number; turn: number; fits: boolean; ring?: boolean; minHalfWidth: number }) {
  const { tile, x, y, turn, fits, ring, minHalfWidth } = props;
  return (
    <g className={`held${fits ? '' : ' misfit'}`} transform={`translate(${x} ${y})`}>
      {ring && <circle className="twist-ring" r={RING} />}
      <Turned tile={tile} turn={turn} minHalfWidth={minHalfWidth} fill={fits ? undefined : 'var(--spicy)'} />
    </g>
  );
}

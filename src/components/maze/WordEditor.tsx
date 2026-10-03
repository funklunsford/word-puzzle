import { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { TILES, TILE_IDS, xExtent, type Placement, type TileId } from '../../glyphs';
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
const PREVIEW_SPRING = { type: 'spring', stiffness: 420, damping: 24 } as const;
const PLACE_SPRING = { type: 'spring', stiffness: 600, damping: 20 } as const;

/** Signed rotation from `from` to `to` the short way round, in degrees. */
const turn = (from: number, to: number) => ((((to - from) % 360) + 540) % 360) - 180;

type Source = { kind: 'tray' } | { kind: 'cell'; cell: number; index: number };

interface Drag {
  tile: TileId;
  rot: number;
  source: Source;
  /** Where the press started, to tell a tap from a drag. */
  startX: number;
  startY: number;
  /** Set once the pointer has moved TAP_SLOP away: only then is the press a drag. */
  moved: boolean;
  x: number;
  y: number;
  /** Valid drop slots per cell, computed once when the drag starts. */
  slots: Slot[][];
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
 * from the tray, drag a placed stroke to move it (or off the word to remove it), or tap a
 * placed stroke to remove it.
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

  /**
   * The cell under a screen point, the single slot a drop there would use (the nearest valid one
   * anywhere in that cell), and whether the point is over the word.
   */
  const locate = (d: Drag, x: number, y: number): Pick<Drag, 'target' | 'overCell' | 'overWord'> => {
    const inside = (el: Element | null | undefined) => {
      const r = el?.getBoundingClientRect();
      return !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    };
    const c = svgs.current.findIndex((el) => inside(el));
    const overCell = c >= 0 ? c : null;
    let target: Drag['target'] = null;
    const m = overCell !== null ? svgs.current[overCell]?.getScreenCTM() : null;
    if (overCell !== null && m) {
      const p = new DOMPoint(x, y).matrixTransform(m.inverse());
      const lx = p.x - offsets[overCell];
      let bestD = Infinity;
      for (const s of d.slots[overCell]) {
        const dist = Math.hypot(s.placement.x - lx, s.placement.y - p.y);
        if (dist < bestD) [bestD, target] = [dist, { cell: overCell, slot: s }];
      }
    }
    return { target, overCell, overWord: inside(wordRef.current) };
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
      rot,
      source,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
      x: e.clientX,
      y: e.clientY,
      slots,
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

  // While dragging, the carried stroke leaves its cell (a tap leaves it in place until released).
  const carried = drag?.moved && drag.source.kind === 'cell' ? drag.source : null;
  const removing = drag?.moved && drag.source.kind === 'cell' && !drag.target && !drag.overWord;

  return (
    <div className={`editor${disabled ? ' disabled' : ''}`}>
      <div className="word-cells" ref={wordRef}>
        {cells.map((content, c) => {
          const letter = recognize(content);
          const noFit = drag?.moved && drag.overCell === c && !drag.slots[c].length;
          const shown = content.filter((_, i) => !(carried?.cell === c && carried.index === i));
          return (
            <div className={`cell${letter ? ' formed' : ''}${noFit ? ' no-fit' : ''}`} key={c}>
              <svg
                ref={(el) => {
                  svgs.current[c] = el;
                }}
                viewBox={`${-CELL_W / 2} ${CELL_TOP} ${CELL_W} ${CELL_H}`}
                width={CELL_W * unit}
                height={CELL_H * unit}
              >
                <g className="cell-content" style={{ transform: `translate(${offsets[c]}px, 0px)` }}>
                  {drag?.target?.cell === c && (
                    <Preview placement={drag.target.slot.placement} from={drag.rot} minHalfWidth={minHalf} />
                  )}
                  <AnimatePresence>
                    {shown.map((p) => {
                      const key = slotKey(p);
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
                          <TileStroke tile={p.tile} rot={p.rot} x={p.x} y={p.y} seed={inkSeed(p)} minHalfWidth={minHalf} />
                          {removable && (
                            <>
                              <TileStroke
                                tile={p.tile}
                                rot={p.rot}
                                x={p.x}
                                y={p.y}
                                seed={inkSeed(p)}
                                minHalfWidth={minHalf}
                                fill="var(--spicy)"
                                className="remove-tint"
                              />
                              <RemoveBadge x={p.x} y={p.y} />
                            </>
                          )}
                          <path
                            className="hit"
                            d={TILES[p.tile].path}
                            transform={`translate(${p.x} ${p.y})${p.rot ? ` rotate(${p.rot})` : ''}`}
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
                </g>
              </svg>
              <span className="cell-letter">
                {drag?.target?.cell === c ? `→ ${drag.target.slot.toward.join(' ')}` : noFit ? 'no fit' : (letter ?? '·')}
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
              title={TILES[t].rotates ? `${TILES[t].name}: rotates to fit` : TILES[t].name}
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

      {drag?.moved && (
        <svg
          className="drag-ghost"
          viewBox="-1.2 -1.2 2.4 2.4"
          width={2.4 * unit}
          height={2.4 * unit}
          style={{ left: drag.x - 1.2 * unit, top: drag.y - 1.2 * unit, opacity: drag.target ? 0 : 1 }}
        >
          <TileStroke tile={drag.tile} rot={drag.rot} minHalfWidth={minHalf} />
        </svg>
      )}
    </div>
  );
}

/**
 * The stroke being dragged, shown where it will land. It turns from the orientation it's held in
 * (the tray's `<` for a chevron) to the slot's, so the player sees how it rotates into place.
 */
function Preview({ placement, from, minHalfWidth }: { placement: Placement; from: number; minHalfWidth: number }) {
  const to = placement.rot ?? 0;
  return (
    <g transform={`translate(${placement.x} ${placement.y})`}>
      <motion.g
        key={slotKey(placement)}
        className="preview"
        initial={{ rotate: turn(to, from), scale: 1.08 }}
        animate={{ rotate: 0, scale: 1 }}
        transition={PREVIEW_SPRING}
      >
        <TileStroke tile={placement.tile} rot={to} seed={inkSeed(placement)} minHalfWidth={minHalfWidth} />
      </motion.g>
    </g>
  );
}

/** The small × shown on a hovered stroke: tapping removes it. */
function RemoveBadge({ x, y }: { x: number; y: number }) {
  return (
    <g className="remove-badge" transform={`translate(${x + 0.32} ${y - 0.32})`}>
      <circle r={0.2} />
      <path d="M-0.08 -0.08 L0.08 0.08 M0.08 -0.08 L-0.08 0.08" />
    </g>
  );
}

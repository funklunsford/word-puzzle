import { useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { TILES, TILE_IDS, placementTransform, xExtent, type Placement, type TileId } from '../../glyphs';
import { EMPTY_CELL_X, recognize, slotKey, slotsFor, type Slot } from '../../strokes';
import { STROKE } from '../Glyph';

const CELL_W = 4;
const CELL_TOP = -0.7;
const CELL_H = 3.6;
const PREVIEW_SPRING = { type: 'spring', stiffness: 420, damping: 24 } as const;

/** Signed rotation from `from` to `to` the short way round, in degrees. */
const turn = (from: number, to: number) => ((((to - from) % 360) + 540) % 360) - 180;

type Source = { kind: 'tray' } | { kind: 'cell'; cell: number; index: number };

interface Drag {
  tile: TileId;
  rot: number;
  source: Source;
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

/** The current word as editable strokes, plus the tray of strokes to drag in. */
export function WordEditor({ cells, unit, disabled, onEdit, onHoverTile }: Props) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const svgs = useRef<(SVGSVGElement | null)[]>([]);
  const wordRef = useRef<HTMLDivElement>(null);

  const offsets = useMemo(() => cells.map(centerOffset), [cells]);

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
    const d0: Drag = { tile, rot, source, slots, x: e.clientX, y: e.clientY, target: null, overCell: null, overWord: true };
    dragRef.current = d0;
    setDrag(d0);
    const update = (ev: PointerEvent) => {
      const d = dragRef.current!;
      const nd = { ...d, x: ev.clientX, y: ev.clientY, ...locate(d, ev.clientX, ev.clientY) };
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

  const removing = drag?.source.kind === 'cell' && !drag.target && !drag.overWord;

  return (
    <div className={`editor${disabled ? ' disabled' : ''}`}>
      <div className="word-cells" ref={wordRef}>
        {cells.map((content, c) => {
          const shown = without(c, drag?.source);
          const letter = recognize(content);
          const noFit = drag?.overCell === c && !drag.slots[c].length;
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
                  {drag?.target?.cell === c && <Preview placement={drag.target.slot.placement} from={drag.rot} />}
                  {shown.map((p, i) => {
                    const index = drag?.source.kind === 'cell' && drag.source.cell === c && i >= drag.source.index ? i + 1 : i;
                    return (
                      <g key={`${slotKey(p)}#${i}`} transform={placementTransform(p)}>
                        <motion.g initial={{ scale: 1.3, opacity: 0.4 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 600, damping: 20 }}>
                          <path className="stroke" d={TILES[p.tile].path} stroke={`var(--t-${p.tile})`} strokeWidth={STROKE} />
                          <path
                            className="hit"
                            d={TILES[p.tile].path}
                            onPointerDown={(e) => start(e, p.tile, p.rot ?? 0, { kind: 'cell', cell: c, index })}
                            onPointerEnter={() => onHoverTile(p.tile)}
                            onPointerLeave={() => onHoverTile(null)}
                          />
                        </motion.g>
                      </g>
                    );
                  })}
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
                <path
                  className="stroke"
                  d={TILES[t].path}
                  transform={TILES[t].display ? `rotate(${TILES[t].display})` : undefined}
                  stroke={`var(--t-${t})`}
                  strokeWidth={STROKE}
                />
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

      {drag && (
        <svg
          className="drag-ghost"
          viewBox="-1.2 -1.2 2.4 2.4"
          width={2.4 * unit}
          height={2.4 * unit}
          style={{ left: drag.x - 1.2 * unit, top: drag.y - 1.2 * unit, opacity: drag.target ? 0 : 1 }}
        >
          <path
            className="stroke"
            d={TILES[drag.tile].path}
            transform={drag.rot ? `rotate(${drag.rot})` : undefined}
            stroke={`var(--t-${drag.tile})`}
            strokeWidth={STROKE}
          />
        </svg>
      )}
    </div>
  );
}

/**
 * The stroke being dragged, shown where it will land. It turns from the orientation it's held in
 * (the tray's `<` for a chevron) to the slot's, so the player sees how it rotates into place.
 */
function Preview({ placement, from }: { placement: Placement; from: number }) {
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
        <path
          className="stroke"
          d={TILES[placement.tile].path}
          transform={to ? `rotate(${to})` : undefined}
          stroke={`var(--t-${placement.tile})`}
          strokeWidth={STROKE}
        />
      </motion.g>
    </g>
  );
}

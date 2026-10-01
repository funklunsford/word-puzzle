import { motion } from 'motion/react';
import { TILES, type TileId } from '../glyphs';
import type { Board as BoardData, GameState } from '../game';
import { TileStroke } from './Glyph';
import { TILE_BOX } from './Stroke';

interface Props {
  board: BoardData;
  state: GameState;
  inUse: Set<TileId>;
  /** Tile counts for the letter being previewed (hovered key), if any. */
  preview: Map<TileId, number> | null;
  focusTile: TileId | null;
  onHoverTile: (tile: TileId | null) => void;
  onToggleTile: (tile: TileId) => void;
  registerTile: (tile: TileId, el: Element | null) => void;
}

export function Board({ board, state, inUse, preview, focusTile, onHoverTile, onToggleTile, registerTile }: Props) {
  // Center tile in the middle of the row.
  const others = board.tiles.filter((t) => t !== board.center);
  const half = Math.ceil(others.length / 2);
  const order = [...others.slice(0, half), board.center, ...others.slice(half)];

  return (
    <div className="board">
      {order.map((tile) => {
        const isCenter = tile === board.center;
        const count = preview?.get(tile);
        const lifted = preview ? !!count : inUse.has(tile) || focusTile === tile;
        const dim = (preview && !count) || (focusTile && focusTile !== tile);
        return (
          <motion.button
            key={tile}
            type="button"
            className={`tile${isCenter ? ' center' : ''}${lifted ? ' using' : ''}${dim ? ' dim' : ''}${focusTile === tile ? ' focused' : ''}`}
            animate={{ y: lifted ? -6 : 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 22 }}
            title={TILES[tile].name}
            onPointerEnter={(e) => e.pointerType === 'mouse' && onHoverTile(tile)}
            onPointerLeave={(e) => e.pointerType === 'mouse' && onHoverTile(null)}
            onClick={() => onToggleTile(tile)}
          >
            {state.spicy === tile && <span className="spicy" aria-label="spicy">🌶️</span>}
            {count ? (
              <motion.span className="count" initial={{ scale: 0 }} animate={{ scale: 1 }}>
                ×{count}
              </motion.span>
            ) : null}
            <svg
              ref={(el) => registerTile(tile, el)}
              viewBox={`${-TILE_BOX / 2} ${-TILE_BOX / 2} ${TILE_BOX} ${TILE_BOX}`}
              className="tile-svg"
            >
              <TileStroke tile={tile} transform={TILES[tile].display ? `rotate(${TILES[tile].display})` : undefined} />
            </svg>
            <span className="tile-name">{TILES[tile].name}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

import { motion } from 'motion/react';
import { TILES, type TileId } from '../glyphs';
import type { Board as BoardData, GameState } from '../game';
import { TileStroke } from './Glyph';
import { TILE_BOX } from './Stroke';

interface Props {
  board: BoardData;
  state: GameState;
  inUse: Set<TileId>;
  registerTile: (tile: TileId, el: Element | null) => void;
}

export function Board({ board, state, inUse, registerTile }: Props) {
  // Center tile in the middle of the row.
  const others = board.tiles.filter((t) => t !== board.center);
  const half = Math.ceil(others.length / 2);
  const order = [...others.slice(0, half), board.center, ...others.slice(half)];

  return (
    <div className="board">
      {order.map((tile) => {
        const isCenter = tile === board.center;
        const using = inUse.has(tile);
        return (
          <motion.div
            key={tile}
            className={`tile${isCenter ? ' center' : ''}${using ? ' using' : ''}`}
            animate={{ y: using ? -6 : 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 22 }}
            title={TILES[tile].name}
          >
            {state.spicy === tile && <span className="spicy" aria-label="spicy">🌶️</span>}
            <svg
              ref={(el) => registerTile(tile, el)}
              viewBox={`${-TILE_BOX / 2} ${-TILE_BOX / 2} ${TILE_BOX} ${TILE_BOX}`}
              className="tile-svg"
            >
              <TileStroke tile={tile} />
            </svg>
          </motion.div>
        );
      })}
    </div>
  );
}

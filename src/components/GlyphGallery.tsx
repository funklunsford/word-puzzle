import { LETTERS, TILES, TILE_IDS, recipe } from '../glyphs';
import { Glyph, GlyphWord, TileStroke } from './Glyph';

const SAMPLES = ['SMUSH', 'STROKE', 'QUICK BROWN FOX', 'JUMPS OVER', 'THE LAZY DOG', 'WAXY ZEBRA'];

export function GlyphGallery() {
  return (
    <div className="gallery">
      <h1>Glyph gallery</h1>
      <div className="legend">
        {TILE_IDS.map((id) => (
          <span className="legend-item" key={id}>
            <svg viewBox="-1.2 -1.2 2.4 2.4" width={28} height={28}>
              <TileStroke tile={id} rot={TILES[id].display} />
            </svg>
            {TILES[id].name}
          </span>
        ))}
      </div>
      <div className="gallery-grid">
        {Object.keys(LETTERS).map((letter) => (
          <div className="gallery-cell" key={letter}>
            <Glyph letter={letter} size={56} />
            <small>
              {[...recipe(letter)].map(([t, n]) => (n > 1 ? `${t}×${n}` : t)).join(' ')}
            </small>
          </div>
        ))}
      </div>
      <div className="gallery-words">
        {SAMPLES.map((line) => (
          <div key={line} style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
            {line.split(' ').map((w) => (
              <GlyphWord key={w} word={w} size={40} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

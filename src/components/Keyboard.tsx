import { Glyph } from './Glyph';

const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

interface Props {
  playable: Set<string>;
  /** Letters that use the focused tile; other keys are dimmed. */
  matches: Set<string> | null;
  onKey: (key: string) => void;
  onHoverKey: (letter: string | null) => void;
}

/** QWERTY order, but only the letters this board's strokes can build. */
export function Keyboard({ playable, matches, onKey, onHoverKey }: Props) {
  const rows = ROWS.map((row) => [...row].filter((ch) => playable.has(ch))).filter((row) => row.length);
  return (
    <div className="keyboard">
      {rows.map((row) => (
        <div className="kb-row" key={row.join('')}>
          {row.map((ch) => (
            <button
              key={ch}
              className={`key${matches ? (matches.has(ch) ? ' match' : ' dim') : ''}`}
              onClick={() => onKey(ch)}
              onPointerEnter={(e) => e.pointerType === 'mouse' && onHoverKey(ch)}
              onPointerLeave={(e) => e.pointerType === 'mouse' && onHoverKey(null)}
              aria-label={ch}
            >
              <Glyph letter={ch} size={17} />
            </button>
          ))}
        </div>
      ))}
      <div className="kb-row">
        <button className="key wide" onClick={() => onKey('Enter')}>
          SMUSH
        </button>
        <button className="key wide" onClick={() => onKey('Backspace')} aria-label="Backspace">
          ⌫
        </button>
      </div>
    </div>
  );
}

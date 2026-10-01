import { Glyph } from './Glyph';

const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

interface Props {
  playable: Set<string>;
  blocked: Set<string>;
  onKey: (key: string) => void;
}

export function Keyboard({ playable, blocked, onKey }: Props) {
  return (
    <div className="keyboard">
      {ROWS.map((row, r) => (
        <div className="kb-row" key={row}>
          {r === 2 && (
            <button className="key wide" onClick={() => onKey('Enter')}>
              SMUSH
            </button>
          )}
          {[...row].map((ch) => (
            <button
              key={ch}
              className={`key${blocked.has(ch) ? ' blocked' : ''}`}
              disabled={!playable.has(ch)}
              onClick={() => onKey(ch)}
              aria-label={ch}
            >
              <Glyph letter={ch} size={17} />
            </button>
          ))}
          {r === 2 && (
            <button className="key wide" onClick={() => onKey('Backspace')} aria-label="Backspace">
              ⌫
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

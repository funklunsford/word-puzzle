import { useEffect, useId, useRef, type ReactNode } from 'react';
import { motion } from 'motion/react';
import type { ThemeChoice } from '../../theme';
import type { MotionChoice, Prefs } from '../../prefs';
import type { Difficulty } from '../../easycore';
import { PALETTES } from '../../palettes';
import { TILES, TILE_IDS, TRAY_TURN } from '../../glyphs';
import { opticalOffset } from '../../ink';
import { TileStroke, minHalfWidthAt } from '../Glyph';

const THEMES: { choice: ThemeChoice; label: string }[] = [
  { choice: 'system', label: 'System' },
  { choice: 'light', label: 'Light' },
  { choice: 'dark', label: 'Dark' },
];
const MOTIONS: { choice: MotionChoice; label: string }[] = [
  { choice: 'system', label: 'System' },
  { choice: 'less', label: 'Less' },
  { choice: 'full', label: 'Full' },
];
const DIFFICULTIES: { choice: Difficulty; label: string }[] = [
  { choice: 'easy', label: 'Easycore' },
  { choice: 'classic', label: 'Classic' },
  { choice: 'hard', label: 'Hardcore' },
];
const HARDCORE_NOTE = 'Only words on a lowest-stroke route count, and there are no hints. Turning it on starts the puzzle over, or picks up the Hardcore game you left.';
/** What the chosen difficulty means, under the choice. */
const DIFFICULTY_NOTES: Record<Difficulty, string> = {
  easy: 'Shorter puzzles with everyday words: its own daily.',
  classic: 'The daily puzzle, with hints if you need them.',
  hard: HARDCORE_NOTE,
};

/** One of a few choices, as a row of buttons (a radio group), and anything to show with it (`children`) above its note. */
function Segmented<T extends string>({ label, options, value, onChange, note, children }: { label: string; options: { choice: T; label: string }[]; value: T; onChange: (v: T) => void; note: string; children?: ReactNode }) {
  const id = useId();
  return (
    <div className="setting">
      <span className="setting-label" id={id}>
        {label}
      </span>
      <div className="segmented" role="radiogroup" aria-labelledby={id}>
        {options.map((o) => (
          <button key={o.choice} role="radio" aria-checked={value === o.choice} className={value === o.choice ? 'on' : ''} onClick={() => onChange(o.choice)}>
            {o.label}
          </button>
        ))}
      </div>
      {children}
      <p className="setting-note">{note}</p>
    </div>
  );
}

/** The tray's nine strokes in the page's stroke colours, so a palette shows as it's chosen. */
function StrokeColours() {
  // A tile here is at most 34 px across its 2.4 units.
  const minHalf = minHalfWidthAt(34 / 2.4);
  return (
    <div className="stroke-colours" aria-hidden="true">
      {TILE_IDS.map((t) => (
        <span key={t} className="stroke-colour" style={{ ['--tile' as string]: `var(--t-${t})` }} title={TILES[t].name}>
          <svg viewBox="-1.2 -1.2 2.4 2.4">
            {/* Centred by eye, as in the tray (see opticalOffset). */}
            <g transform={`translate(${opticalOffset(t, TRAY_TURN[t], minHalf).join(' ')})`}>
              <TileStroke tile={t} rot={TRAY_TURN[t]} minHalfWidth={minHalf} />
            </g>
          </svg>
        </span>
      ))}
    </div>
  );
}

/** On or off, with a line on what it does. A tap anywhere on the row flips it. */
function Toggle({ label, note, on, onChange }: { label: string; note: string; on: boolean; onChange: (on: boolean) => void }) {
  const id = useId();
  return (
    <label className="toggle">
      <span className="toggle-text">
        <span className="toggle-label" id={`${id}-l`}>
          {label}
        </span>
        <span className="setting-note" id={`${id}-n`}>
          {note}
        </span>
      </span>
      <button
        role="switch"
        aria-checked={on}
        aria-labelledby={`${id}-l`}
        aria-describedby={`${id}-n`}
        className="switch"
        onClick={() => onChange(!on)}
      >
        <span className="knob" />
      </button>
    </label>
  );
}

interface Props {
  theme: ThemeChoice;
  onTheme: (choice: ThemeChoice) => void;
  prefs: Prefs;
  onPrefs: (patch: Partial<Prefs>) => void;
  /**
   * The difficulty being played: with `easycore` (the flag), chosen from Easycore, Classic and
   * Hardcore; without it, the Hardcore switch (Classic when off). Turning Hardcore on starts a
   * puzzle in progress over (see src/hardcore.ts); Easycore has its own daily (src/easycore.ts).
   */
  difficulty: Difficulty;
  onDifficulty: (difficulty: Difficulty) => void;
  easycore: boolean;
  onClose: () => void;
}

/** The settings pop-up (the gear). Escape, the ×, Done or a tap outside closes it. */
export function Settings({ theme, onTheme, prefs, onPrefs, difficulty, onDifficulty, easycore, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <motion.div className="help-backdrop" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
      <motion.section
        className="help-card settings-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
        transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
      >
        <div className="help-head">
          <h2 id="settings-title">Settings</h2>
          <button ref={closeRef} className="close" aria-label="Close settings" onClick={onClose}>
            ×
          </button>
        </div>
        <Segmented label="Appearance" options={THEMES} value={theme} onChange={onTheme} note="System follows your device's light or dark mode." />
        <Segmented
          label="Stroke colours"
          options={PALETTES}
          value={prefs.palette}
          onChange={(palette) => onPrefs({ palette })}
          note="Clear keeps every stroke easy to tell apart with colour blindness. Your result card uses these colours too."
        >
          <StrokeColours />
        </Segmented>
        <Segmented
          label="Motion"
          options={MOTIONS}
          value={prefs.motion}
          onChange={(motion) => onPrefs({ motion })}
          note="Less: strokes snap instead of springing, and a win shows its finished picture. System follows your device."
        />
        {easycore && <Segmented label="Difficulty" options={DIFFICULTIES} value={difficulty} onChange={onDifficulty} note={DIFFICULTY_NOTES[difficulty]} />}
        <div className="setting">
          <span className="setting-label">Playing</span>
          {!easycore && <Toggle label="Hardcore" note={HARDCORE_NOTE} on={difficulty === 'hard'} onChange={(on) => onDifficulty(on ? 'hard' : 'classic')} />}
          <Toggle
            label="Letter guide"
            note="The A to Z under the word, lighting up the letters a stroke is in."
            on={prefs.letters}
            onChange={(letters) => onPrefs({ letters })}
          />
          <Toggle
            label="Definitions"
            note="Each word's meaning, above it. You can still tap a word in your path to look it up."
            on={prefs.definitions}
            onChange={(definitions) => onPrefs({ definitions })}
          />
        </div>
        <button className="pill help-go" onClick={onClose}>
          Done
        </button>
      </motion.section>
    </motion.div>
  );
}

/** A gear drawn in strokes: a ring with eight teeth. */
export function GearIcon() {
  const teeth = Array.from({ length: 8 }, (_, i) => (i * Math.PI) / 4);
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="gear-icon">
      <circle cx="12" cy="12" r="5.6" />
      <circle cx="12" cy="12" r="2.2" />
      {teeth.map((a) => (
        <line key={a} x1={12 + Math.cos(a) * 6.4} y1={12 + Math.sin(a) * 6.4} x2={12 + Math.cos(a) * 8.6} y2={12 + Math.sin(a) * 8.6} />
      ))}
    </svg>
  );
}

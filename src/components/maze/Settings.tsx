import { useEffect, useId, useRef } from 'react';
import { motion } from 'motion/react';
import type { ThemeChoice } from '../../theme';
import type { MotionChoice, Prefs } from '../../prefs';
import { COARSE, useMedia } from '../../useMedia';

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

/** One of a few choices, as a row of buttons (a radio group). */
function Segmented<T extends string>({ label, options, value, onChange, note }: { label: string; options: { choice: T; label: string }[]; value: T; onChange: (v: T) => void; note: string }) {
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
      <p className="setting-note">{note}</p>
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
      <button role="switch" aria-checked={on} aria-labelledby={`${id}-l`} aria-describedby={`${id}-n`} className="switch" onClick={() => onChange(!on)}>
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
  onClose: () => void;
}

/** The settings pop-up (the gear). Escape, the ×, Done or a tap outside closes it. */
export function Settings({ theme, onTheme, prefs, onPrefs, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  // Phones turn strokes with a double-tap only, so they don't offer swipes.
  const touch = useMedia(COARSE);
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
          label="Motion"
          options={MOTIONS}
          value={prefs.motion}
          onChange={(motion) => onPrefs({ motion })}
          note="Less: strokes snap instead of springing, and a win shows its finished picture. System follows your device."
        />
        <div className="setting">
          <span className="setting-label">Playing</span>
          {!touch && (
            <Toggle
              label="Swipe to turn"
              note="Off: double-click a stroke to turn it, in the tray or in a letter."
              on={prefs.swipe}
              onChange={(swipe) => onPrefs({ swipe })}
            />
          )}
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
        <div className="setting">
          <span className="setting-label">Sharing</span>
          <Toggle
            label="Colour-blind squares"
            note="Your result card's squares use yellow, blue and red, so none needs telling orange from red."
            on={prefs.colorBlind}
            onChange={(colorBlind) => onPrefs({ colorBlind })}
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

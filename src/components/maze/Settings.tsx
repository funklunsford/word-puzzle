import { useEffect, useId, useRef } from 'react';
import { motion } from 'motion/react';
import type { ThemeChoice } from '../../theme';
import type { MotionChoice, Prefs } from '../../prefs';

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

/**
 * On or off, with a line on what it does. A tap anywhere on the row flips it. A locked one says
 * why (`locked`) and doesn't flip; it can still be focused, so a screen reader hears why.
 */
function Toggle({ label, note, on, onChange, locked }: { label: string; note: string; on: boolean; onChange: (on: boolean) => void; locked?: string }) {
  const id = useId();
  return (
    <label className={`toggle${locked ? ' locked' : ''}`}>
      <span className="toggle-text">
        <span className="toggle-label" id={`${id}-l`}>
          {label}
        </span>
        <span className="setting-note" id={`${id}-n`}>
          {note}
        </span>
        {locked && (
          <span className="setting-note toggle-locked" id={`${id}-k`}>
            {locked}
          </span>
        )}
      </span>
      <button
        role="switch"
        aria-checked={on}
        aria-disabled={locked ? true : undefined}
        aria-labelledby={`${id}-l`}
        aria-describedby={locked ? `${id}-n ${id}-k` : `${id}-n`}
        className="switch"
        onClick={() => !locked && onChange(!on)}
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
  /** Hardcore, which can only be switched before the puzzle starts (see src/hardcore.ts). */
  hardcore: boolean;
  hardcoreLocked: boolean;
  onHardcore: (on: boolean) => void;
  onClose: () => void;
}

/** The settings pop-up (the gear). Escape, the ×, Done or a tap outside closes it. */
export function Settings({ theme, onTheme, prefs, onPrefs, hardcore, hardcoreLocked, onHardcore, onClose }: Props) {
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
          label="Motion"
          options={MOTIONS}
          value={prefs.motion}
          onChange={(motion) => onPrefs({ motion })}
          note="Less: strokes snap instead of springing, and a win shows its finished picture. System follows your device."
        />
        <div className="setting">
          <span className="setting-label">Playing</span>
          {/* Like Wordle's hard mode: chosen before a puzzle starts, so it never restarts one. */}
          <Toggle
            label="Hardcore"
            note="Only words on a lowest-stroke route count, and there are no hints."
            on={hardcore}
            onChange={onHardcore}
            locked={hardcoreLocked ? 'Change it before your first stroke or hint, or after Restart.' : undefined}
          />
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

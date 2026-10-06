import { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import type { ThemeChoice } from '../../theme';

const THEMES: { choice: ThemeChoice; label: string }[] = [
  { choice: 'system', label: 'System' },
  { choice: 'light', label: 'Light' },
  { choice: 'dark', label: 'Dark' },
];

/** The settings pop-up (the gear): for now, light or dark. Escape, the ×, Done or a tap outside closes it. */
export function Settings({ theme, onTheme, onClose }: { theme: ThemeChoice; onTheme: (choice: ThemeChoice) => void; onClose: () => void }) {
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
        <div className="setting">
          <span className="setting-label" id="theme-label">
            Appearance
          </span>
          <div className="segmented" role="radiogroup" aria-labelledby="theme-label">
            {THEMES.map(({ choice, label }) => (
              <button key={choice} role="radio" aria-checked={theme === choice} className={theme === choice ? 'on' : ''} onClick={() => onTheme(choice)}>
                {label}
              </button>
            ))}
          </div>
          <p className="setting-note">System follows your device's light or dark mode.</p>
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

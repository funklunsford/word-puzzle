import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import type { Difficulty } from '../../easycore';

/** The difficulties as players see them. (The code and storage keep easy, classic and hard: classic is Normal.) */
export const DIFFICULTY_NAMES: Record<Difficulty, string> = { easy: 'Easy', classic: 'Normal', hard: 'Hard' };

/** Each in a line, for the date line's menu, How to play and the nudge up after a win. */
export const DIFFICULTY_LINES: Record<Difficulty, string> = {
  easy: 'Shorter puzzles with everyday words',
  classic: 'The daily puzzle, with hints you earn',
  hard: 'Lowest-stroke words only, no hints',
};

const ORDER: Difficulty[] = ['easy', 'classic', 'hard'];
/** The menu's width, and the least room it keeps from the window's edges. */
const MENU_W = 264;
const EDGE = 12;

interface Props {
  value: Difficulty;
  /** A difficulty picked: played at once, as Settings does. */
  onChange: (difficulty: Difficulty) => void;
}

/**
 * The difficulty in the date line ("No. 22 · Normal ▾ · Tuesday, October 27"): tapping it opens the
 * three under it, each with its line, kept inside the window. Picking one plays it. A pick, Escape, a
 * tap outside, Tab, or the page scrolling or resizing closes it (Escape and a pick back to the chip).
 */
export function DifficultyChip({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState<{ left: number; top: number; width: number } | null>(null);
  const chip = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();
  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) chip.current?.focus();
  };

  useLayoutEffect(() => {
    if (!open || !chip.current) return;
    const r = chip.current.getBoundingClientRect();
    // Under the whole line it's in, which a phone wraps.
    const below = (chip.current.closest('p') ?? chip.current).getBoundingClientRect().bottom;
    const width = Math.min(MENU_W, window.innerWidth - 2 * EDGE);
    const left = Math.min(Math.max(EDGE, r.left + r.width / 2 - width / 2), window.innerWidth - width - EDGE);
    setAt({ left, top: below + 8, width });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const items = () => [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? [])];
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(true);
      else if (e.key === 'Tab') close(false);
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const all = items();
        const i = all.indexOf(document.activeElement as HTMLElement);
        all[(i + (e.key === 'ArrowDown' ? 1 : all.length - 1)) % all.length]?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!menu.current?.contains(t) && !chip.current?.contains(t)) close(false);
    };
    // Scrolling or resizing would leave it behind its chip.
    const onMove = () => close(false);
    window.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    window.addEventListener('scroll', onMove);
    window.addEventListener('resize', onMove);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
      window.removeEventListener('scroll', onMove);
      window.removeEventListener('resize', onMove);
    };
  }, [open]);

  // Once placed, the one being played has the focus.
  useEffect(() => {
    if (open && at) menu.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
  }, [open, at]);

  return (
    <>
      <button
        ref={chip}
        className="difficulty-chip"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={`Difficulty: ${DIFFICULTY_NAMES[value]}`}
        onClick={() => setOpen((o) => !o)}
      >
        {DIFFICULTY_NAMES[value]}
        <svg viewBox="0 0 10 6" aria-hidden="true">
          <path d="M1 1 L5 5 L9 1" />
        </svg>
      </button>
      {createPortal(
        <AnimatePresence>
          {open && at && (
            <motion.div
              ref={menu}
              id={id}
              className="difficulty-menu"
              role="menu"
              aria-label="Difficulty"
              style={{ left: at.left, top: at.top, width: at.width }}
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ type: 'spring', bounce: 0.15, duration: 0.3 }}
            >
              {ORDER.map((d) => (
                <button
                  key={d}
                  role="menuitemradio"
                  aria-checked={d === value}
                  className={d === value ? 'on' : undefined}
                  onClick={() => {
                    close(true);
                    if (d !== value) onChange(d);
                  }}
                >
                  <strong>{DIFFICULTY_NAMES[d]}</strong>
                  <small>{DIFFICULTY_LINES[d]}</small>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}

/**
 * The three to pick from, each with its line (How to play's last card, before the first puzzle; and
 * the phone's sheet, whose title names them: `labelledBy`). Picking one plays it.
 */
export function DifficultyList({ value, onChange, labelledBy }: Props & { labelledBy?: string }) {
  const id = useId();
  return (
    <div className="difficulty-pick">
      {!labelledBy && (
        <span className="difficulty-pick-label" id={id}>
          How hard?
        </span>
      )}
      <div role="radiogroup" aria-labelledby={labelledBy ?? id}>
        {ORDER.map((d) => (
          <button key={d} role="radio" aria-checked={d === value} className={d === value ? 'on' : undefined} onClick={() => d !== value && onChange(d)}>
            <span className="pick-dot" aria-hidden="true" />
            <span>
              <strong>{DIFFICULTY_NAMES[d]}</strong>
              <small>{DIFFICULTY_LINES[d]}</small>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * The difficulty on a phone: a tag under the score's count ("NORMAL ▾", and on Hard "HARD ▾" in the
 * Hard tag's colours, which it stands in for), where a thumb finds it. It opens the three in a sheet
 * from the bottom of the screen, big enough to tap. A pick plays it; a tap outside, Escape or dragging
 * the sheet down closes it, back to the tag.
 */
export function DifficultyTag({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const tag = useRef<HTMLButtonElement>(null);
  const sheet = useRef<HTMLElement>(null);
  const id = useId();
  const close = () => {
    setOpen(false);
    tag.current?.focus();
  };
  useEffect(() => {
    if (!open) return;
    sheet.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        ref={tag}
        className={`difficulty-tag${value === 'hard' ? ' hard' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Difficulty: ${DIFFICULTY_NAMES[value]}`}
        onClick={() => setOpen(true)}
      >
        {DIFFICULTY_NAMES[value]}
        <svg viewBox="0 0 10 6" aria-hidden="true">
          <path d="M1 1 L5 5 L9 1" />
        </svg>
      </button>
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div className="sheet-backdrop" onClick={close} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <motion.section
                ref={sheet}
                className="difficulty-sheet"
                role="dialog"
                aria-modal="true"
                aria-labelledby={id}
                onClick={(e) => e.stopPropagation()}
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
                drag="y"
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0, bottom: 0.7 }}
                onDragEnd={(_, info) => (info.offset.y > 80 || info.velocity.y > 500) && close()}
              >
                <div className="sheet-grab" aria-hidden="true" />
                <h2 id={id}>Difficulty</h2>
                <DifficultyList
                  value={value}
                  labelledBy={id}
                  onChange={(d) => {
                    close();
                    onChange(d);
                  }}
                />
              </motion.section>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}

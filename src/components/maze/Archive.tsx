import { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import type { How, PastDay } from '../../archive';

/** What each row says of how it went. */
const SAYS: Record<How, (strokes?: number) => string> = {
  new: () => 'Not played',
  started: () => 'In progress',
  solved: (strokes) => `Solved in ${strokes}`,
  ace: () => 'Ace ★',
};
/** The same, read aloud. */
const READS: Record<How, (strokes?: number) => string> = {
  new: () => 'not played',
  started: () => 'in progress',
  solved: (strokes) => `solved in ${strokes} strokes`,
  ace: (strokes) => `solved in ${strokes} strokes, an Ace`,
};

const longDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

interface Props {
  days: PastDay[];
  /** Whose dailies they are ("Easycore dailies"). */
  whose: string;
  /** The daily being played, if one is. */
  playing?: string;
  /** Play a daily: an earlier day's, or today's (null). */
  onPlay: (date: string | null) => void;
  onClose: () => void;
}

/**
 * Past puzzles (the calendar): every daily so far, newest first, each with its number, its date and
 * how it went. Tapping one plays it. Escape, the × or a tap outside closes it.
 */
export function Archive({ days, whose, playing, onPlay, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLOListElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    // The one being played, in view (it may be far down).
    list.current?.querySelector('[aria-current]')?.scrollIntoView({ block: 'nearest' });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <motion.div className="help-backdrop" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
      <motion.section
        className="help-card archive-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="archive-title"
        aria-describedby="archive-whose"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
        transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
      >
        <div className="help-head">
          <h2 id="archive-title">Past puzzles</h2>
          <button ref={closeRef} className="close" aria-label="Close past puzzles" onClick={onClose}>
            ×
          </button>
        </div>
        <p className="archive-whose" id="archive-whose">
          {whose}, newest first
        </p>
        <ol className="past-days" ref={list}>
          {days.map((d) => (
            <li key={d.date}>
              <button
                className="past-day"
                aria-current={d.date === playing || undefined}
                aria-label={`No. ${d.number}, ${longDate(d.date)}${d.today ? ", today's" : ''}: ${READS[d.how](d.strokes)}`}
                onClick={() => onPlay(d.today ? null : d.date)}
              >
                <span className="past-no">
                  No. {d.number}
                  {d.today && <span className="past-today">Today</span>}
                </span>
                <span className="past-date">{longDate(d.date)}</span>
                <span className={`past-how ${d.how}`}>{SAYS[d.how](d.strokes)}</span>
              </button>
            </li>
          ))}
        </ol>
        <p className="setting-note archive-note">Solved on a later day, a puzzle counts towards dailies solved and aces, but not your streak.</p>
      </motion.section>
    </motion.div>
  );
}

/** A calendar drawn in strokes, like the gear: its page, the bar across its top, two rings and a row of days. */
export function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="calendar-icon">
      <rect x="3.8" y="5.6" width="16.4" height="14.6" rx="3" />
      <path d="M3.8 10.4h16.4" />
      <path d="M8.4 3.4v4.2M15.6 3.4v4.2" />
      <path d="M8.2 15.3h.01M12 15.3h.01M15.8 15.3h.01" />
    </svg>
  );
}

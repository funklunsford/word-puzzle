import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { addMonths, monthGrid, type How, type PastDay } from '../../archive';

/** What the line under the calendar says of how a day went. */
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
const shortDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const monthName = (month: string) => new Date(`${month}-01T12:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
/** The weekdays' initials, from Sunday (October 4, 2026 was one). */
const WEEKDAYS = Array.from({ length: 7 }, (_, i) => new Date(Date.UTC(2026, 9, 4 + i)).toLocaleDateString(undefined, { weekday: 'narrow', timeZone: 'UTC' }));
const dayOf = (date: string) => Number(date.slice(8));

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
 * Past puzzles (the calendar): the dailies so far, a month at a time, each day a tile showing how it
 * went. Tapping one plays it; pointing at one (or tabbing to it) says its number and how it went
 * under the month, which otherwise sums the month up. It opens on the month of the daily being
 * played. Escape, the × or a tap outside closes it.
 */
export function Archive({ days, whose, playing, onPlay, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const todays = days.find((d) => d.today)?.date ?? days[0].date;
  const first = days[days.length - 1].date.slice(0, 7);
  const last = todays.slice(0, 7);
  const [month, setMonth] = useState(() => (playing && playing >= days[days.length - 1].date && playing <= todays ? playing : todays).slice(0, 7));
  const [pointed, setPointed] = useState<string | null>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const byDate = new Map(days.map((d) => [d.date, d]));
  const shown = pointed ? byDate.get(pointed) : undefined;
  const inMonth = days.filter((d) => d.date.startsWith(month));
  const solved = inMonth.filter((d) => d.how === 'solved' || d.how === 'ace').length;
  const aces = inMonth.filter((d) => d.how === 'ace').length;
  const detail = shown
    ? `No. ${shown.number} · ${shortDate(shown.date)}${shown.today ? ' · Today' : ''} · ${SAYS[shown.how](shown.strokes)}`
    : `${solved} of ${inMonth.length} solved${aces ? ` · ${aces} Ace${aces === 1 ? '' : 's'}` : ''}`;
  const turn = (n: number) => {
    setMonth(addMonths(month, n));
    setPointed(null);
  };

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
          {whose}
        </p>
        <div className="month-head">
          <button className="month-turn" aria-label="Earlier month" disabled={month <= first} onClick={() => turn(-1)}>
            ‹
          </button>
          <h3 className="month-name" id="archive-month" aria-live="polite">
            {monthName(month)}
          </h3>
          <button className="month-turn" aria-label="Later month" disabled={month >= last} onClick={() => turn(1)}>
            ›
          </button>
        </div>
        <div className="month" role="group" aria-labelledby="archive-month" onMouseLeave={() => setPointed(null)}>
          {WEEKDAYS.map((w, i) => (
            <span key={`w${i}`} className="weekday" aria-hidden="true">
              {w}
            </span>
          ))}
          {monthGrid(month).map((date, i) => {
            const d = date ? byDate.get(date) : undefined;
            // A date with no daily (still to come, or before the first) is just its number; a filler is blank.
            if (!d)
              return (
                <span key={date ?? `x${i}`} className="past-day none" aria-hidden="true">
                  {date && dayOf(date)}
                </span>
              );
            return (
              <button
                key={d.date}
                className={`past-day ${d.how}${d.today ? ' today' : ''}`}
                aria-current={d.date === playing || undefined}
                aria-label={`No. ${d.number}, ${longDate(d.date)}${d.today ? ", today's" : ''}: ${READS[d.how](d.strokes)}`}
                onClick={() => onPlay(d.today ? null : d.date)}
                onMouseEnter={() => setPointed(d.date)}
                onFocus={() => setPointed(d.date)}
                onBlur={() => setPointed(null)}
              >
                {dayOf(d.date)}
                {d.how === 'ace' && (
                  <span className="past-star" aria-hidden="true">
                    ★
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <p className="month-detail">{detail}</p>
        <ul className="past-key" aria-hidden="true">
          <li>
            <span className="past-swatch new" />
            Not played
          </li>
          <li>
            <span className="past-swatch started" />
            In progress
          </li>
          <li>
            <span className="past-swatch solved" />
            Solved
          </li>
          <li>
            <span className="past-swatch ace" />
            Ace
          </li>
        </ul>
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

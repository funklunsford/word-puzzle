// The end of a game's stats: the player's record over the dailies, worked out from the results this
// browser keeps (one per daily solved, the best of them), so replaying a day never counts it twice.

/** A daily's kept result, as far as the record needs it. */
export interface Solved {
  strokes: number;
  best: number;
}

export interface DailyRecord {
  /** Dailies solved, and how many of them in the lowest possible strokes. */
  solved: number;
  perfect: number;
  /** Dailies solved in a row, up to and including `upTo`'s. */
  streak: number;
  /** The longest run of dailies solved in a row. */
  bestStreak: number;
}

/** The record over `days` (every daily, in order), from each one's result if it was solved. */
export function dailyRecord(days: readonly string[], resultOf: (date: string) => Solved | null, upTo: string): DailyRecord {
  let solved = 0;
  let perfect = 0;
  let run = 0;
  let bestStreak = 0;
  let streak = 0;
  for (const day of days) {
    if (day > upTo) break;
    const r = resultOf(day);
    if (r) {
      solved++;
      if (r.strokes <= r.best) perfect++;
      run++;
      bestStreak = Math.max(bestStreak, run);
    } else run = 0;
    if (day === upTo) streak = run;
  }
  return { solved, perfect, streak, bestStreak };
}

/** A time as m:ss (h:mm:ss from an hour). */
export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const [h, m, sec] = [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60];
  const pad = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

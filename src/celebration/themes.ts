// How each puzzle celebrates a win: its colours, words and timing. Only the pilot, WILD → TAME,
// has one so far; the goal is a fresh one each day, generated from the day's start and goal.

export interface CelebrationTheme {
  /** The big line once the goal word has formed. */
  title: string;
  /** Hot colours for the start word bursting apart. */
  wild: string[];
  /** The background while it's wild; it calms to the page's own background. */
  stormBg: string;
  /** Seconds: the start word holds, bursts, runs wild, then settles into the goal word. */
  timing: { burst: number; calm: number; settled: number };
}

export const THEMES: Record<string, CelebrationTheme> = {
  // WILD → TAME: the start word bursts into wild ink, whips around, then is tamed into the goal word.
  'WILD→TAME': {
    title: 'Tamed!',
    wild: ['#ff6b35', '#ff2e63', '#ffc93c', '#f9844a', '#e84a5f'],
    stormBg: '#1b0f17',
    timing: { burst: 0.45, calm: 1.9, settled: 3.6 },
  },
};

export const themeFor = (start: string, goal: string): CelebrationTheme | undefined => THEMES[`${start}→${goal}`];

// How each puzzle celebrates a win: its scene, colours, words and timing. Only the pilot,
// WILD → TAME, has one so far; the goal is a fresh one each day, generated from the day's words.

export interface CelebrationTheme {
  /** The big line once the goal word has formed. */
  title: string;
  /** The background while it's wild; it calms to the page's own background. */
  stormBg: string;
  /** Seconds: the start word holds until `burst`, grows wild, is tamed from `calm`, and has `settled`. */
  timing: { burst: number; calm: number; settled: number };
  /** The flora scene's colours (see flora.ts): wild growth, then the trained garden. */
  flora?: {
    wildStems: string[];
    wildLeaves: string[];
    wildFern: string;
    wildFlowers: string[];
    wildCentre: string;
    tameStem: string;
    tameLeaves: string[];
    tameCentre: string;
  };
}

export const THEMES: Record<string, CelebrationTheme> = {
  // WILD → TAME: WILD, drawn in vines, runs wild (tendrils, ferns, big blooms), then is gathered
  // into TAME and trained: a leafy vine on each stroke, fern fronds on the bars, a flower at each tip.
  'WILD→TAME': {
    title: 'Tamed!',
    stormBg: '#0c1a10',
    timing: { burst: 0.45, calm: 2.0, settled: 3.7 },
    flora: {
      wildStems: ['#2f6b3a', '#3e7f45', '#285c33', '#4a8a3f'],
      wildLeaves: ['#2f8f46', '#4caf50', '#3a7d44', '#6cc05f', '#1f6f3a', '#5aa83c'],
      wildFern: '#3f9a52',
      wildFlowers: ['#ff4f8b', '#ff8a3d', '#ffd23f', '#b061ff', '#ff5e5b', '#ff77c8'],
      wildCentre: '#ffe08a',
      tameStem: '#6f9e68',
      tameLeaves: ['#8cc084', '#7fb878', '#97c98c'],
      tameCentre: '#f6e7b8',
    },
  },
};

export const themeFor = (start: string, goal: string): CelebrationTheme | undefined => THEMES[`${start}→${goal}`];

// The contract between the celebration shell (Celebration.tsx) and a scene: each day's
// celebration (src/daily/days/{DATE}.ts) and the Perfect encore (perfect.ts) are scenes.

import type * as THREE_NS from 'three';

export type Three = typeof THREE_NS;

/** How a day's celebration is titled, and when its beats fall. */
export interface CelebrationTheme {
  /** The big line once the goal word has formed: 12 characters at most, e.g. "Tamed!". */
  title: string;
  /** The opening background; the shell calms it to the page's own background from `calm` to `settled`. */
  stormBg: string;
  /** Seconds: the start word holds until `burst`, the change runs to `calm`, and the goal word has `settled`. */
  timing: { burst: number; calm: number; settled: number };
}

export interface SceneOptions {
  start: string;
  goal: string;
  theme: CelebrationTheme;
  /** A phone-sized screen: draw about 40% less. */
  small: boolean;
  /** A theme-aware colour from the page (a CSS custom property), as sRGB 0–1. */
  cssColor: (name: string, fallback: string) => [number, number, number];
}

export interface Scene {
  /** Everything to draw. The shell adds these to its scene; nothing else touches the page. */
  objects: THREE_NS.Object3D[];
  /** How far the art reaches beyond the words (in word units), for framing. */
  margin: number;
  /** Draw the moment `t` seconds in: the same frame for the same `t`, whatever was drawn before. */
  update(t: number): void;
  /** Free every geometry and material the scene made. */
  dispose(): void;
}

/** What a day's celebration module exports. */
export interface CelebrationModule {
  theme: CelebrationTheme;
  scene: (THREE: Three, options: SceneOptions) => Scene;
}

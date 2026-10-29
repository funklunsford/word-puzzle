// The chalk outlines' masks (public/chalk/*.png), for "Chalk & Charcoal: frames" in src/styles.css:
// a rough rounded rectangle (or pill) for each corner radius, white on transparent at 3×, used as a
// 9-slice -webkit-mask-box-image. Each image is an element's border box plus PAD on every side, so
// the chalk has room to wobble; its slices are the radius plus PAD. The roughness is an SVG filter (a
// wobble and a dry-brush grain), drawn once here by headless Chrome, so the page never runs it.
//
//   npx vite-node scripts/chalk-masks.ts     (Chrome at its macOS path, or CHROME=/path/to/chrome)

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = new URL('../public/chalk/', import.meta.url).pathname;
/** Room around the border box for the wobble, the straight run between corners, and the scale. */
const PAD = 6;
const MID = 96;
const SCALE = 3;
/** Name: corner radius (a pill's is half its height) and stroke width, in CSS px. */
const MASKS: Record<string, [number, number]> = { r24: [24, 3], r18: [18, 2.6], r16: [16, 2.4], r14: [14, 2.4], r12: [12, 2.1], p44: [22, 2.4], p32: [16, 2.1], p22: [11, 2] };

const dir = mkdtempSync(join(tmpdir(), 'chalk-'));
for (const [name, [r, w]] of Object.entries(MASKS)) {
  const slice = r + PAD;
  const size = 2 * slice + MID;
  const o = PAD + w / 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <filter id="chalk" x="-10%" y="-10%" width="120%" height="120%">
    <feTurbulence type="fractalNoise" baseFrequency="0.028" numOctaves="2" seed="5" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="3" xChannelSelector="R" yChannelSelector="G" result="d"/>
    <feTurbulence type="fractalNoise" baseFrequency="0.7 0.12" numOctaves="2" seed="11" result="g"/>
    <feColorMatrix in="g" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.21 1.55" result="m"/>
    <feComposite in="d" in2="m" operator="in"/>
  </filter>
  <rect x="${o}" y="${o}" width="${size - 2 * o}" height="${size - 2 * o}" rx="${Math.max(0, r - w / 2)}" fill="none" stroke="#fff" stroke-width="${w}" stroke-linejoin="round" filter="url(#chalk)"/>
</svg>`;
  const file = join(dir, `${name}.svg`);
  writeFileSync(file, svg);
  execFileSync(CHROME, ['--headless=new', '--hide-scrollbars', '--disable-gpu', `--force-device-scale-factor=${SCALE}`, `--window-size=${size},${size}`, '--default-background-color=00000000', `--screenshot=${OUT}${name}.png`, `file://${file}`], { stdio: 'ignore' });
  console.log(`${name}.png: ${size}×${size} css px at ${SCALE}×, slices ${slice * SCALE} (${slice}px)`);
}

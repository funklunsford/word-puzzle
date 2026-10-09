// The celebration for a puzzle with no day's scene of its own (only a Perfect solve celebrates one):
// the goal word, still, a ribbon per stroke in the strokes' colours, for the confetti to give way to.

import type * as THREE_NS from 'three';
import type { Three } from './scene';
import { wordStrokes } from './wordPoints';

export function plainScene(THREE: Three, { word, cssColor }: { word: string; cssColor: (name: string, fallback: string) => [number, number, number] }) {
  const positions: number[] = [];
  const colors: number[] = [];
  const index: number[] = [];
  const HALF = 0.06;
  for (const { tile, pts } of wordStrokes(word)) {
    const c = new THREE.Color().setRGB(...cssColor(`--t-${tile}`, '#395a7b'), THREE.SRGBColorSpace);
    const base = positions.length / 3;
    pts.forEach((p, i) => {
      const [a, b] = [pts[Math.max(0, i - 1)], pts[Math.min(pts.length - 1, i + 1)]];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const [nx, ny] = [-(b[1] - a[1]) / len, (b[0] - a[0]) / len];
      positions.push(p[0] + nx * HALF, p[1] + ny * HALF, 0, p[0] - nx * HALF, p[1] - ny * HALF, 0);
      colors.push(c.r, c.g, c.b, c.r, c.g, c.b);
      if (i) index.push(base + 2 * i - 2, base + 2 * i - 1, base + 2 * i, base + 2 * i - 1, base + 2 * i + 1, base + 2 * i);
    });
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(index);
  const mesh: THREE_NS.Mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  return {
    objects: [mesh],
    update: () => {},
    dispose: () => {
      geometry.dispose();
      (mesh.material as THREE_NS.Material).dispose();
    },
    margin: 0.4,
  };
}

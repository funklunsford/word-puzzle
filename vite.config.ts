import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative asset and data paths, so the built site works from any folder (e.g. GitHub Pages' /strokes/).
  base: './',
});

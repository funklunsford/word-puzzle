import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { MazeApp } from './MazeApp';
import './styles.css';

// The glyph gallery (every letter and stroke, for design work) is on the dev server only, at /#gallery:
// the site has just the game.
const GlyphGallery = import.meta.env.DEV ? lazy(() => import('./components/GlyphGallery').then((m) => ({ default: m.GlyphGallery }))) : null;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {GlyphGallery && location.hash === '#gallery' ? (
      <Suspense>
        <GlyphGallery />
      </Suspense>
    ) : (
      <MazeApp />
    )}
  </StrictMode>,
);

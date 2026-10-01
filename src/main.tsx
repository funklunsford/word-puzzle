import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GlyphGallery } from './components/GlyphGallery';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GlyphGallery />
  </StrictMode>,
);

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { GlyphGallery } from './components/GlyphGallery';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>{location.hash === '#gallery' ? <GlyphGallery /> : <App />}</StrictMode>,
);

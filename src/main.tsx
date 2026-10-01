import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { MazeApp } from './MazeApp';
import { GlyphGallery } from './components/GlyphGallery';
import './styles.css';

const views: Record<string, () => React.ReactElement> = {
  '#gallery': () => <GlyphGallery />,
  '#smush': () => <App />,
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>{(views[location.hash] ?? (() => <MazeApp />))()}</StrictMode>,
);

import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { drawResultCard, shareText, type ShareResult } from '../../share';

/**
 * Share a result: the picture card and the text grid, with Share (the phone's share sheet, card and
 * text together), Copy text and Save image. The card is drawn as the sheet opens, so Share can hand
 * it over in the tap itself (iPhones refuse a share that waits).
 */
export function ShareSheet({ result, onClose }: { result: ShareResult; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [image, setImage] = useState<string | null>(null);
  const file = useRef<File | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const text = shareText(result);
  const name = `strokes-${result.number ?? 'result'}.png`;

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  useEffect(() => {
    let live = true;
    drawResultCard(result).then((canvas) => {
      if (!live) return;
      setImage(canvas.toDataURL('image/png'));
      canvas.toBlob((blob) => {
        if (live && blob) file.current = new File([blob], name, { type: 'image/png' });
      }, 'image/png');
    });
    return () => {
      live = false;
    };
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyFailed(true); // the text is on screen to copy by hand
    }
  };
  const share = () => {
    const data: ShareData = { text };
    if (file.current && navigator.canShare?.({ files: [file.current] })) data.files = [file.current];
    navigator.share(data).catch((e: Error) => {
      if (e?.name !== 'AbortError') copy();
    });
  };
  const save = () => {
    if (!image) return;
    const a = document.createElement('a');
    a.href = image;
    a.download = name;
    a.click();
  };

  return (
    <motion.div className="help-backdrop" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
      <motion.section
        className="help-card share-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-title"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
        transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
      >
        <div className="help-head">
          <h2 id="share-title">Share your result</h2>
          <button ref={closeRef} className="close" aria-label="Close sharing" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="share-preview">
          {image ? <img src={image} alt={`Strokes result card: ${result.start} to ${result.goal} in ${result.strokes} strokes`} /> : <div className="share-loading" />}
        </div>
        <pre className={`share-grid${copyFailed ? ' select' : ''}`}>{text}</pre>
        {copyFailed && <p className="setting-note">Copying isn't allowed here: select the text above to copy it.</p>}
        <div className="pill-row">
          {'share' in navigator && (
            <button className="pill" onClick={share}>
              Share
            </button>
          )}
          <button className="pill quiet" onClick={copy}>
            {copied ? 'Copied!' : 'Copy text'}
          </button>
          <button className="pill quiet" onClick={save} disabled={!image}>
            Save image
          </button>
        </div>
      </motion.section>
    </motion.div>
  );
}

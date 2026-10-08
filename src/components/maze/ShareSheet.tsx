import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { SITE, drawResultCard, type ShareResult } from '../../share';
import { usePrefs } from '../../prefs';

/**
 * Share a result: the picture card, with the link back to the game. Share hands the phone's share
 * sheet the card and the link together; Copy image and Save image are there for anywhere else (the
 * link is on the card too). The card is drawn as the sheet opens, so Share can hand it over in the
 * tap itself (iPhones refuse a share that waits).
 */
export function ShareSheet({ result, onClose }: { result: ShareResult; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const { colorBlind } = usePrefs();
  const [image, setImage] = useState<string | null>(null);
  const file = useRef<File | null>(null);
  const [copied, setCopied] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const name = `strokes-${result.number ?? 'result'}.png`;
  const title = `Strokes${result.number ? ` No. ${result.number}` : ''}${result.start.length === 5 ? ' · 5 letters' : ''}`;
  const canCopy = typeof ClipboardItem !== 'undefined' && !!navigator.clipboard?.write;

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  useEffect(() => {
    let live = true;
    drawResultCard(result, colorBlind).then((canvas) => {
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
    if (!file.current) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': file.current })]);
      setCopied(true);
      setNote(null);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setNote("Copying isn't allowed here: save the image instead.");
    }
  };
  const share = () => {
    // The card and the link; where a phone can't take a picture, the link alone.
    const data: ShareData = file.current && navigator.canShare?.({ files: [file.current] }) ? { files: [file.current], url: SITE, title } : { url: SITE, title };
    navigator.share(data).catch((e: Error) => {
      if (e?.name !== 'AbortError') setNote("Sharing didn't work here: copy or save the image instead.");
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
        {note && <p className="setting-note share-note">{note}</p>}
        <div className="pill-row">
          {'share' in navigator && (
            <button className="pill" onClick={share} disabled={!image}>
              Share
            </button>
          )}
          {canCopy && (
            <button className="pill quiet" onClick={copy} disabled={!image}>
              {copied ? 'Copied!' : 'Copy image'}
            </button>
          )}
          <button className="pill quiet" onClick={save} disabled={!image}>
            Save image
          </button>
        </div>
      </motion.section>
    </motion.div>
  );
}

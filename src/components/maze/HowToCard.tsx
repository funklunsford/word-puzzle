import { useEffect, useRef, useState, type RefObject } from 'react';
import { motion } from 'motion/react';
import { SAMPLE } from '../../tutorial';
import { GlyphWord } from '../Glyph';

const ARROW = 'M0 0 L1 0 M0.7 -0.28 L1 0 L0.7 0.28';

interface Props {
  /** The phone layout: the example's words a little smaller. */
  compact: boolean;
  /** The card opened by itself, on a first visit: it offers the sample, or skipping to today's puzzle. */
  firstVisit: boolean;
  /** The sample can be played now (the 5-letter game, with nothing in progress to lose). */
  canSample: boolean;
  /** The sample's been played through before. */
  sampled: boolean;
  easycore: boolean;
  inkPots: boolean;
  closeRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onSample: () => void;
  onSkip: () => void;
}

/** Which of the two cards this is, as dots. */
const Dots = ({ page }: { page: number }) => (
  <div className="how-dots" aria-hidden="true">
    <span className={page === 0 ? 'on' : undefined} />
    <span className={page === 1 ? 'on' : undefined} />
  </div>
);

/**
 * How to play, on two cards. The first: the goal, with the sample puzzle's start and goal words as
 * the path card draws them, and the three rules. The second: good to know (scoring, hints, the other
 * difficulties), and the way on: on a first visit, the sample puzzle on the real board.
 */
export function HowToCard({ compact, firstVisit, canSample, sampled, easycore, inkPots, closeRef, onClose, onSample, onSkip }: Props) {
  const [page, setPage] = useState(0);
  const next = useRef<HTMLButtonElement>(null);
  const go = useRef<HTMLButtonElement>(null);
  // Turning the card moves the focus to its main button (on opening, the dialog focuses its ×).
  const [turned, setTurned] = useState(false);
  useEffect(() => {
    if (turned) (page === 0 ? next : go).current?.focus();
  }, [page, turned]);
  const turn = (to: number) => {
    setTurned(true);
    setPage(to);
  };
  const chip = compact ? 15 : 17;
  const head = (title: string, back?: boolean) => (
    <div className="help-head">
      {back && (
        <button className="how-back" aria-label="Back to how to play" onClick={() => turn(0)}>
          <svg viewBox="0 0 10 16" width={10} height={16} aria-hidden="true">
            <path d="M8 2 L2 8 L8 14" />
          </svg>
        </button>
      )}
      <h2 id="help-title">{title}</h2>
      <button ref={closeRef} className="close" aria-label="Close how to play" onClick={onClose}>
        ×
      </button>
    </div>
  );
  return (
    <motion.div key={page} initial={turned ? { opacity: 0, x: page ? 14 : -14 } : false} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.18 }}>
      {page === 0 ? (
        <>
          {head('How to play')}
          <p className="how-lead">Turn the start word into the goal word in as few strokes as you can.</p>
          <div className="how-example" aria-label={`For example, ${SAMPLE.start} to ${SAMPLE.goal}`}>
            <span className="how-chip">
              <span className="tag">start</span>
              <GlyphWord word={SAMPLE.start} size={chip} />
            </span>
            <svg className="how-arrow" viewBox="-0.1 -0.5 1.2 1" width={26} height={16} aria-hidden="true">
              <path d={ARROW} />
            </svg>
            <span className="how-chip goal">
              <span className="tag">goal</span>
              <GlyphWord word={SAMPLE.goal} size={chip} />
            </span>
          </div>
          <ol className="how-rules">
            <li>
              Change up to <strong>3 strokes</strong> at a time: add, remove, move or turn them.
            </li>
            <li>
              Make a <strong>real word</strong> and you get 3 new strokes.
            </li>
            <li>
              Going back to a word you've already made is <strong>free</strong>: it adds no strokes.
            </li>
          </ol>
          <div className="how-actions">
            <button ref={next} className="pill help-go" onClick={() => turn(1)}>
              Next
            </button>
          </div>
          <Dots page={0} />
        </>
      ) : (
        <>
          {head('Good to know', true)}
          <ul className="how-tips">
            <li>
              Scored like golf: an <strong>Ace</strong> is the fewest strokes possible.
            </li>
            <li>
              Each new word earns a <strong>Hint</strong>.
            </li>
            {easycore ? (
              <li>
                Easier or harder: choose <strong>Easycore</strong> or <strong>Hardcore</strong> in Settings.
              </li>
            ) : (
              <li>
                For a challenge, turn on <strong>Hardcore</strong> in Settings.
              </li>
            )}
            {inkPots && (
              <li>
                Reach an <strong>ink pot</strong> word to bank a free stroke.
              </li>
            )}
          </ul>
          <div className="how-actions">
            {firstVisit && canSample ? (
              <>
                <button ref={go} className="pill help-go" onClick={onSample}>
                  Try a sample puzzle
                </button>
                <button className="link-btn how-skip" onClick={onSkip}>
                  Skip to today's puzzle
                </button>
              </>
            ) : (
              <>
                <button ref={go} className="pill help-go" onClick={onClose}>
                  Play
                </button>
                {canSample && (
                  <button className="link-btn how-skip" onClick={onSample}>
                    {sampled ? 'Try the sample puzzle again' : 'Try a sample puzzle'}
                  </button>
                )}
              </>
            )}
          </div>
          <Dots page={1} />
        </>
      )}
    </motion.div>
  );
}

import { useCallback, useState } from 'react';
import { useReduceMotion } from '../../prefs';
import { HowToShow } from './HowToShow';
import { HowToTry } from './HowToTry';

/**
 * How to play's top half: a word step shown (HowToShow), then the same step to try, and a turn
 * (HowToTry): one above the other, or side by side on a wide screen. The demo plays once as the card
 * opens. The practice's ghost waits until it's done, or until the player starts, which stops it:
 * there's never two hands moving at once.
 */
export function HowTo({ touch }: { touch: boolean }) {
  const reduce = useReduceMotion();
  const [watching, setWatching] = useState(true);
  const playing = watching && !reduce;
  const stop = useCallback(() => setWatching(false), []);
  const again = useCallback(() => setWatching(true), []);
  return (
    <div className="how-to">
      <HowToShow touch={touch} playing={playing} onDone={stop} onAgain={again} />
      <HowToTry touch={touch} waiting={playing} onStart={stop} />
    </div>
  );
}

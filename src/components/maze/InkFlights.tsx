import { useCallback, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { InkDrop } from './InkDrop';

type Point = { x: number; y: number };

interface Flight {
  id: number;
  from: Point;
  to: Point;
  delay: number;
}

/** The centre of an element on screen. */
export const centerOf = (el: Element): Point => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};

/**
 * Drops of ink in flight between two places on screen: from the word just reached up into the ink
 * bank when a pot is collected, and from the bank down into the word when ink pays for a step.
 * Each arcs over the shortest way, so the ink visibly comes from where it was and goes where it's
 * used.
 */
export function useInkFlights() {
  const [flights, setFlights] = useState<Flight[]>([]);
  const next = useRef(0);
  // Landing callbacks live outside state: state updaters may run twice (StrictMode), callbacks mustn't.
  const landings = useRef(new Map<number, () => void>());
  const launch = useCallback((from: Point, to: Point, delay = 0, onLand?: () => void) => {
    const id = next.current++;
    if (onLand) landings.current.set(id, onLand);
    setFlights((f) => [...f, { id, from, to, delay }]);
  }, []);
  const land = (id: number) => {
    const onLand = landings.current.get(id);
    landings.current.delete(id);
    onLand?.();
    setFlights((f) => f.filter((x) => x.id !== id));
  };
  const layer = (
    <div className="ink-flights" aria-hidden="true">
      {flights.map((f) => (
        <motion.div
          key={f.id}
          className="ink-flight"
          initial={{ x: f.from.x, y: f.from.y, scale: 0.4, opacity: 0 }}
          animate={{
            x: [f.from.x, (f.from.x + f.to.x) / 2, f.to.x],
            y: [f.from.y, Math.min(f.from.y, f.to.y) - 56, f.to.y],
            scale: [0.5, 1.15, 0.85],
            opacity: [0, 1, 1],
          }}
          transition={{ duration: 0.7, times: [0, 0.45, 1], ease: 'easeInOut', delay: f.delay }}
          onAnimationComplete={() => land(f.id)}
        >
          <InkDrop size={16} />
        </motion.div>
      ))}
    </div>
  );
  return { launch, layer };
}

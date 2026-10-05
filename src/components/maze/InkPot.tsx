import { useId } from 'react';
import { motion } from 'motion/react';

/** The inkwell's squat glass body, flaring to a wide base (its neck and lip sit on top). */
const BODY = 'M-0.42 -0.45 H0.42 Q0.62 -0.45 0.68 -0.25 L0.86 0.62 Q0.9 0.85 0.66 0.85 H-0.66 Q-0.9 0.85 -0.86 0.62 L-0.68 -0.25 Q-0.62 -0.45 -0.42 -0.45 Z';
/** A quill standing in the pot: its vane, then the shaft dipping into the neck. */
const VANE = 'M0.18 -0.62 C0.3 -1.02 0.7 -1.34 1.02 -1.4 C0.98 -1.06 0.74 -0.72 0.3 -0.52 Z';
const SHAFT = 'M0.06 -0.3 L1.0 -1.38';
const DRAIN = { type: 'spring', bounce: 0, duration: 0.6 } as const;
const HOP = { duration: 0.45, times: [0, 0.4, 1], ease: 'easeOut' as const };

/**
 * An ink pot: a squat glass inkwell with a quill in it, whose ink drains when it's collected
 * (`full` → false). It hops once when it comes within reach (`near`), so the change is noticed
 * without any looping motion.
 */
export function InkPot({ full = true, near = false, size = 18 }: { full?: boolean; near?: boolean; size?: number }) {
  const clip = useId();
  return (
    <motion.svg
      className={`ink-pot${full ? '' : ' empty'}`}
      viewBox="-1 -1.5 2.1 2.4"
      width={(size * 2.1) / 2.4}
      height={size}
      aria-hidden="true"
      animate={{ y: near ? [0, -size * 0.18, 0] : 0 }}
      transition={HOP}
    >
      <defs>
        <clipPath id={clip}>
          <path d={BODY} />
        </clipPath>
      </defs>
      <path className="quill" d={VANE} />
      <path className="quill-shaft" d={SHAFT} />
      <rect className="glass" x={-0.28} y={-0.62} width={0.56} height={0.2} />
      <rect className="glass" x={-0.38} y={-0.74} width={0.76} height={0.15} rx={0.05} />
      <path className="glass body" d={BODY} />
      <g clipPath={`url(#${clip})`}>
        <motion.rect
          className="ink"
          x={-0.95}
          y={-0.2}
          width={1.9}
          height={1.05}
          style={{ originY: 1 }}
          initial={false}
          animate={{ scaleY: full ? 1 : 0.1 }}
          transition={DRAIN}
        />
      </g>
      <path className="outline" d={BODY} />
      <path className="shine" d="M-0.52 -0.18 L-0.62 0.5" />
    </motion.svg>
  );
}

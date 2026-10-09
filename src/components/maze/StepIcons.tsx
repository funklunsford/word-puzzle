/**
 * Icons for the step's buttons (Undo, Reset, Hint), drawn in strokes like the gear: round-ended
 * lines in the button's own colour (ink, or muted when it's disabled), in either theme. They sit
 * beside the labels, which stay, so they're hidden from screen readers.
 */

/** Undo: a hooked arrow, back one stroke. */
export function UndoIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="step-icon">
      <path d="M8.6 4.6 4.4 9l4.2 4.3" />
      <path d="M4.8 9h9.4c3.1 0 5.4 2.3 5.4 5.3s-2.3 5.3-5.4 5.3h-3.6" />
    </svg>
  );
}

/** Reset: a loop that comes round to where it started, back to the start of the step. */
export function ResetIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="step-icon">
      <path d="M5.6 8.2A7.6 7.6 0 1 1 4.5 13.6" />
      <path d="M4.6 3.8 5.4 8.4l4.5-.9" />
    </svg>
  );
}

/** Hint: a light bulb, its glass lit in gold while there's a hint to take. */
export function HintIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="step-icon">
      <path className="glow" d="M9.2 15.6c-.2-2.3-3.4-3.6-3.4-7.2a6.2 6.2 0 0 1 12.4 0c0 3.6-3.2 4.9-3.4 7.2Z" />
      <path d="M9.6 18.6h4.8M10.6 21.2h2.8" />
    </svg>
  );
}

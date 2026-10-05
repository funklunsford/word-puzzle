/** A drop of ink: an ink pot on the map (hollow until collected) or a banked free stroke. */
export function InkDrop({ filled = true, size = 12 }: { filled?: boolean; size?: number }) {
  return (
    <svg className={`ink-drop${filled ? '' : ' empty'}`} viewBox="-1 -1.25 2 2.4" width={size} height={size * 1.2} aria-hidden="true">
      <path d="M0 -1.1 C0.55 -0.35 0.8 0.05 0.8 0.4 A0.8 0.8 0 0 1 -0.8 0.4 C-0.8 0.05 -0.55 -0.35 0 -1.1 Z" />
    </svg>
  );
}

/**
 * Where the tour's copy card sits relative to the ring it draws (#177).
 *
 * Beside the ring, not under it: **right of it first, then below, then above**.
 * The card is exactly as wide as the Works dropdown, and a dropdown hangs
 * directly beneath the control that opens it — so a card placed below the ring
 * lands squarely on the list the step is asking the reader to use. Since the
 * tour is non-blocking and every step names an action to perform *now*, a card
 * that covers the control it describes makes its own step impossible.
 *
 * That is also why an open panel counts as part of the obstacle: the ring is
 * around the button, but what must stay uncovered is the button *and* whatever
 * it has opened.
 *
 * Pure, so the placement can be asserted against real toolbar geometry — jsdom
 * reports every rect as zero-sized, and a rendered card can therefore prove
 * nothing about what it covers.
 */

export interface Rect {
  top: number;
  left: number;
  right: number;
  bottom: number;
}

export interface Viewport {
  width: number;
  height: number;
}

/** Padding between an anchor's edge and the spotlight ring around it. */
export const RING_PAD = 6;
/** Gap between the ring and the copy card that sits beside it. */
export const CARD_GAP = 12;
/** Matches the Works dropdown's `w-80`, so card and list read as one column. */
export const TOUR_CARD_WIDTH = 320;
/**
 * What the card is assumed to need vertically when choosing a side. The card
 * grows with its copy, so this is a working estimate, not a measurement — it
 * only decides which side wins, and every side clamps into the viewport.
 */
export const TOUR_CARD_HEIGHT = 180;

/** The box enclosing both, so a ring and the panel hanging off it read as one obstacle. */
export function unionRects(a: Rect, b: Rect | null): Rect {
  if (!b) return a;
  return {
    top: Math.min(a.top, b.top),
    left: Math.min(a.left, b.left),
    right: Math.max(a.right, b.right),
    bottom: Math.max(a.bottom, b.bottom),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

/**
 * Whether a panel hangs off this ring — the test for "the ringed control opened
 * it", made of geometry alone: a dropdown sits directly against the control that
 * opens it, so it touches the ring. A panel open elsewhere on the toolbar is
 * somebody else's, and must not drag the card across the screen.
 */
export function touchesRing(ring: Rect, panel: Rect): boolean {
  return !(
    panel.left > ring.right + RING_PAD ||
    panel.right < ring.left - RING_PAD ||
    panel.top > ring.bottom + RING_PAD ||
    panel.bottom < ring.top - RING_PAD
  );
}

/**
 * @param ring   the anchor box the spotlight rings.
 * @param panel  a dropdown the ringed control has open, or null.
 * @param viewport the window, in the same client coordinates as the rects.
 */
export function placeTourCard(
  ring: Rect,
  panel: Rect | null,
  viewport: Viewport,
): { top: number; left: number } {
  const obstacle = unionRects(ring, panel);
  const minLeft = CARD_GAP;
  const maxLeft = viewport.width - TOUR_CARD_WIDTH - CARD_GAP;
  const minTop = CARD_GAP;
  const maxTop = viewport.height - TOUR_CARD_HEIGHT - CARD_GAP;

  const rightOf = obstacle.right + RING_PAD + CARD_GAP;
  if (rightOf <= maxLeft) {
    // Level with the top of the ring — not the obstacle — so the card reads as
    // a label on the control, even when a long list hangs below it.
    return { top: clamp(ring.top - RING_PAD, minTop, maxTop), left: rightOf };
  }

  const left = clamp(obstacle.left, minLeft, maxLeft);
  const below = obstacle.bottom + RING_PAD + CARD_GAP;
  if (below <= maxTop) return { top: below, left };

  // Above the whole obstacle, not just the ring: a panel reaching up beside the
  // ring must stay uncovered here too. On a viewport with room on no side the
  // clamp wins and the card does cover the control — the least bad of three bad
  // options, and only below the desktop widths this app supports (ADR-0011).
  return {
    top: Math.max(minTop, obstacle.top - RING_PAD - CARD_GAP - TOUR_CARD_HEIGHT),
    left,
  };
}

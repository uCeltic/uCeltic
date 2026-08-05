/**
 * Where an open note panel goes on the screen (#166).
 *
 * The panel is portalled out of its column and positioned `fixed`, so the
 * viewport is the only box left that can clip it — and this is the arithmetic
 * that keeps it inside that box. Kept apart from the component because it is
 * the part with the edge cases: a marker at the bottom of the screen, a marker
 * against the right edge, a window narrower than the panel.
 */

/** The part of a marker's `DOMRect` the placement actually reads. */
export interface MarkerRect {
  left: number;
  top: number;
  bottom: number;
}

export interface Viewport {
  width: number;
  height: number;
}

/**
 * A `position: fixed` box, in the form the style attribute wants it.
 *
 * Exactly one of `top`/`bottom` is set. Anchoring by `bottom` is what lets the
 * panel hang ABOVE its marker without anyone having to know how tall it turned
 * out to be — the height is the text's business, and it is only capped here.
 */
export interface NotePanelPlacement {
  left: number;
  width: number;
  maxHeight: number;
  top?: number;
  bottom?: number;
}

/**
 * How wide the panel likes to be.
 *
 * Wider than the 12rem popover it replaces, because the notes are longer than
 * that popover was built for: 62 of them, median 32 characters but running to
 * 263, and some hold a `<p>`. Its right edge no longer cuts anything off, so
 * width is now only a question of how the text reads.
 */
export const PANEL_WIDTH_PX = 288;

/** How close to the viewport's edge the panel may come. */
export const MARGIN_PX = 8;

/**
 * The least height the panel is ever given.
 *
 * Only a viewport too short for either side of the marker reaches it, and there
 * the honest answer is "no room" — but a panel with no height shows nothing at
 * all, whereas a short scrolling one still shows the note.
 */
export const MIN_HEIGHT_PX = 48;

/** The gap between the marker and the panel — the pointer crosses this. */
const GAP_PX = 6;

export function placeNotePanel(
  marker: MarkerRect,
  viewport: Viewport,
): NotePanelPlacement {
  const width = Math.min(PANEL_WIDTH_PX, viewport.width - 2 * MARGIN_PX);
  // Left-aligned to the marker, as the popover always was, until that would put
  // the panel's far edge off screen — then it slides back in rather than being
  // cut off. It may cover the neighbouring column doing so, which is fine: the
  // panel is floating chrome and it is only up while the pointer is on it.
  const left = clamp(marker.left, MARGIN_PX, viewport.width - width - MARGIN_PX);

  const roomAbove = marker.top - GAP_PX - MARGIN_PX;
  const roomBelow = viewport.height - marker.bottom - GAP_PX - MARGIN_PX;

  // Above by preference — that is how the popover has always read, and the
  // marker is at the end of a word the eye has just left. It goes below only
  // when above is the tighter side, which is what a note near the top of the
  // screen gets.
  const room = Math.max(roomAbove, roomBelow, MIN_HEIGHT_PX);

  return roomAbove >= roomBelow
    ? { left, width, maxHeight: room, bottom: viewport.height - marker.top + GAP_PX }
    : { left, width, maxHeight: room, top: marker.bottom + GAP_PX };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

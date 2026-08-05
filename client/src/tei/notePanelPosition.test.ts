/**
 * #166 — where the note panel goes once it is out of the column's scroll box.
 *
 * Freed from the column, the panel is placed against the viewport instead, and
 * the viewport is the only thing that can clip it. So the two symptoms the issue
 * reports are two clamps: pick the side of the marker that has room, and keep
 * the panel's box inside the viewport's width whatever the marker's `left` is.
 */
import { describe, expect, it } from "vitest";
import {
  MARGIN_PX,
  MIN_HEIGHT_PX,
  PANEL_WIDTH_PX,
  placeNotePanel,
  type MarkerRect,
} from "./notePanelPosition";

const VIEWPORT = { width: 1200, height: 800 };

/** A marker's bounding rect: `x`/`y` is its top-left, and it is small. */
function marker(x: number, y: number): MarkerRect {
  return { left: x, top: y, bottom: y + 12 };
}

describe("placing the note panel against the viewport", () => {
  it("hangs it above a marker with room above, the way the popover always read", () => {
    const placement = placeNotePanel(marker(400, 500), VIEWPORT);

    expect(placement.bottom).toBeGreaterThan(0);
    expect(placement.top).toBeUndefined();
  });

  it("drops it below a marker near the top, where there is no room above", () => {
    const placement = placeNotePanel(marker(400, 10), VIEWPORT);

    expect(placement.top).toBeGreaterThan(22);
    expect(placement.bottom).toBeUndefined();
  });

  // The reported symptom: a marker at the very bottom of a column. Above is now
  // the side with the room, and the panel is measured against the viewport, so
  // what used to be cut off by the scroll box has somewhere to go.
  it("keeps a panel opened at the bottom of the screen inside the viewport", () => {
    const placement = placeNotePanel(marker(400, 780), VIEWPORT);

    expect(placement.bottom).toBeGreaterThanOrEqual(MARGIN_PX);
    expect(placement.maxHeight).toBeLessThanOrEqual(780 - MARGIN_PX);
    expect(placement.maxHeight).toBeGreaterThan(0);
  });

  it("never lets the panel run past the right edge, whatever the marker's left", () => {
    const placement = placeNotePanel(marker(1190, 400), VIEWPORT);

    expect(placement.left + placement.width).toBeLessThanOrEqual(
      VIEWPORT.width - MARGIN_PX,
    );
  });

  it("never lets it run past the left edge either", () => {
    expect(placeNotePanel(marker(2, 400), VIEWPORT).left).toBe(MARGIN_PX);
  });

  // A marker in the middle keeps the old left-aligned reading: the panel starts
  // where the note is, so the eye does not have to look for it.
  it("aligns the panel to the marker when there is nothing to clamp against", () => {
    expect(placeNotePanel(marker(400, 400), VIEWPORT).left).toBe(400);
  });

  it("takes its full width when the viewport has it, and shrinks when it does not", () => {
    expect(placeNotePanel(marker(400, 400), VIEWPORT).width).toBe(PANEL_WIDTH_PX);
    expect(placeNotePanel(marker(10, 400), { width: 200, height: 800 }).width).toBe(
      200 - 2 * MARGIN_PX,
    );
  });

  // What lets a 263-character note scroll rather than be cut off: the panel is
  // told how tall it may grow, and it is always the room actually available.
  it("caps the height at the room on the side it chose", () => {
    const below = placeNotePanel(marker(400, 10), VIEWPORT);
    expect(below.maxHeight).toBeLessThanOrEqual(800 - 22 - MARGIN_PX);

    const above = placeNotePanel(marker(400, 700), VIEWPORT);
    expect(above.maxHeight).toBeLessThanOrEqual(700 - MARGIN_PX);
  });

  it("still offers a usable height for a marker pinned to the very edge", () => {
    for (const y of [0, 799]) {
      expect(placeNotePanel(marker(400, y), VIEWPORT).maxHeight).toBeGreaterThan(0);
    }
  });

  // A viewport too short for either side of the marker is the one case where
  // the room runs out. A negative `max-height` is discarded by CSS, so the
  // panel would come back full height and be cut off by the window instead —
  // the very failure this whole placement exists to stop.
  it("never hands back a height a browser would throw away", () => {
    const cramped = placeNotePanel(marker(400, 10), { width: 1200, height: 24 });

    expect(cramped.maxHeight).toBe(MIN_HEIGHT_PX);
  });
});

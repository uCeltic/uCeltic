import { describe, expect, it } from "vitest";
import {
  TOUR_CARD_HEIGHT,
  TOUR_CARD_WIDTH,
  placeTourCard,
  type Rect,
} from "./tourCardPlacement";

const VIEWPORT = { width: 1440, height: 900 };

// The Works button as the toolbar actually lays it out: top-left, and the
// dropdown it opens hangs directly beneath it — 320 wide (w-80), up to 384 tall
// (max-h-96).
const WORKS_BUTTON: Rect = { top: 12, left: 16, right: 132, bottom: 44 };
const WORKS_DROPDOWN: Rect = { top: 48, left: 16, right: 336, bottom: 432 };

function cardRect(ring: Rect, panel: Rect | null = null, viewport = VIEWPORT) {
  const { top, left } = placeTourCard(ring, panel, viewport);
  return {
    top,
    left,
    right: left + TOUR_CARD_WIDTH,
    bottom: top + TOUR_CARD_HEIGHT,
  };
}

function overlaps(a: Rect, b: Rect): boolean {
  return (
    a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
  );
}

describe("placeTourCard", () => {
  it("puts the card to the right of the ring when there is room", () => {
    const card = cardRect(WORKS_BUTTON);
    expect(card.left).toBeGreaterThan(WORKS_BUTTON.right);
    expect(card.top).toBeLessThan(WORKS_BUTTON.bottom);
  });

  it("does not cover the Works dropdown while the ring is on the Works button", () => {
    const card = cardRect(WORKS_BUTTON, WORKS_DROPDOWN);
    expect(overlaps(card, WORKS_DROPDOWN)).toBe(false);
    expect(card.left).toBeGreaterThan(WORKS_DROPDOWN.right);
  });

  it("drops below the ring when the right-hand side has no room", () => {
    const nearRightEdge: Rect = { top: 12, left: 1200, right: 1400, bottom: 44 };
    const card = cardRect(nearRightEdge);
    expect(card.top).toBeGreaterThan(nearRightEdge.bottom);
    expect(card.right).toBeLessThanOrEqual(VIEWPORT.width);
  });

  it("drops below the open panel, not onto it, when it goes below at all", () => {
    const nearRightEdge: Rect = { top: 12, left: 1200, right: 1400, bottom: 44 };
    const panel: Rect = { top: 48, left: 1080, right: 1400, bottom: 300 };
    expect(overlaps(cardRect(nearRightEdge, panel), panel)).toBe(false);
  });

  it("goes above the ring when there is room neither right nor below", () => {
    const bottomRight: Rect = {
      top: 820,
      left: 1200,
      right: 1400,
      bottom: 860,
    };
    const card = cardRect(bottomRight);
    expect(card.bottom).toBeLessThan(bottomRight.top);
  });

  it("keeps the card on screen when the ring fills the viewport's height", () => {
    const tall: Rect = { top: 0, left: 1200, right: 1400, bottom: 890 };
    const card = cardRect(tall);
    expect(card.top).toBeGreaterThanOrEqual(0);
    expect(card.bottom).toBeLessThanOrEqual(VIEWPORT.height);
  });

  it("is exactly as wide as the Works dropdown", () => {
    expect(TOUR_CARD_WIDTH).toBe(WORKS_DROPDOWN.right - WORKS_DROPDOWN.left);
  });
});

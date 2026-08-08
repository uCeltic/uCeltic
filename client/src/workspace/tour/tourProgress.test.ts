import { describe, expect, it } from "vitest";
import {
  NO_LATCHES,
  clearLatchesAfterBoundary,
  deriveStepIndex,
  latchProgress,
  visibleStepIndex,
} from "./tourProgress";
import { NOTHING_DONE, signals } from "./tourSignals.fixture";
import type { TourStep } from "./tourSteps";

// A miniature script with the same shape as the real one: an opening step, the
// search step that is the latch boundary, two reversible steps after it, and a
// final step with no gate. Kept local so these tests describe the mechanism
// rather than the current five cards' wording.
const STEPS: TourStep[] = [
  {
    id: "open",
    anchors: [],
    title: "Open",
    body: "",
    gate: (s) => s.openVersionCount >= 2,
  },
  {
    id: "search",
    anchors: [],
    title: "Search",
    body: "",
    gate: (s) => s.selectionSearchCompleted,
    latchBoundary: true,
  },
  {
    id: "results",
    anchors: [],
    title: "Results",
    body: "",
    gate: (s) => s.resultNavigated,
  },
  {
    id: "font",
    anchors: [],
    title: "Font",
    body: "",
    gate: (s) => s.fontSizeChanged,
  },
  { id: "last", anchors: [], title: "Last", body: "" },
];



describe("deriveStepIndex", () => {
  it("is the first step whose action has not happened", () => {
    expect(deriveStepIndex(STEPS, NOTHING_DONE, NO_LATCHES)).toBe(0);
  });

  it("advances as each step's action happens", () => {
    expect(
      deriveStepIndex(STEPS, signals({ openVersionCount: 2 }), NO_LATCHES),
    ).toBe(1);
    expect(
      deriveStepIndex(
        STEPS,
        signals({ openVersionCount: 2, selectionSearchCompleted: true }),
        NO_LATCHES,
      ),
    ).toBe(2);
    expect(
      deriveStepIndex(
        STEPS,
        signals({
          openVersionCount: 2,
          selectionSearchCompleted: true,
          resultNavigated: true,
        }),
        NO_LATCHES,
      ),
    ).toBe(3);
  });

  it("stops on the final step, which has no action to wait for", () => {
    const done = signals({
      openVersionCount: 2,
      selectionSearchCompleted: true,
      resultNavigated: true,
      fontSizeChanged: true,
    });
    expect(deriveStepIndex(STEPS, done, NO_LATCHES)).toBe(STEPS.length - 1);
  });

  it("follows the workspace backwards before any search has completed", () => {
    const latched = latchProgress(
      STEPS,
      signals({ openVersionCount: 2 }),
      NO_LATCHES,
    );
    expect(deriveStepIndex(STEPS, NOTHING_DONE, latched)).toBe(0);
  });

  it("does not rewind past a completed search once one has completed", () => {
    const latched = latchProgress(
      STEPS,
      signals({ openVersionCount: 2, selectionSearchCompleted: true }),
      NO_LATCHES,
    );
    // Every column closed and the results thrown away: the workspace is back to
    // empty, but the opening steps stay taught.
    expect(deriveStepIndex(STEPS, NOTHING_DONE, latched)).toBe(2);
  });

  it("keeps a step after the search taught once its action has happened", () => {
    const afterSearch = latchProgress(
      STEPS,
      signals({ openVersionCount: 2, selectionSearchCompleted: true }),
      NO_LATCHES,
    );
    const afterNavigating = latchProgress(
      STEPS,
      signals({
        openVersionCount: 2,
        selectionSearchCompleted: true,
        resultNavigated: true,
      }),
      afterSearch,
    );
    // Back on the first match: navigating is reversible, having learnt it is not.
    expect(
      deriveStepIndex(
        STEPS,
        signals({ openVersionCount: 2, selectionSearchCompleted: true }),
        afterNavigating,
      ),
    ).toBe(3);
  });
});

describe("visibleStepIndex", () => {
  it("shows the derived step while the manual pointer is behind it", () => {
    expect(
      visibleStepIndex(
        STEPS,
        signals({ openVersionCount: 2 }),
        NO_LATCHES,
        0,
      ),
    ).toBe(1);
  });

  it("lets the manual pointer run ahead of an action never performed", () => {
    expect(visibleStepIndex(STEPS, NOTHING_DONE, NO_LATCHES, 3)).toBe(3);
  });

  it("never runs off the end of the script", () => {
    expect(visibleStepIndex(STEPS, NOTHING_DONE, NO_LATCHES, 99)).toBe(
      STEPS.length - 1,
    );
  });
});

describe("latchProgress", () => {
  it("latches nothing before a search has completed", () => {
    expect(
      latchProgress(
        STEPS,
        signals({ openVersionCount: 2, fontSizeChanged: true }),
        NO_LATCHES,
      ),
    ).toEqual([false, false, false, false, false]);
  });

  it("latches every step up to the search once one completes", () => {
    expect(
      latchProgress(STEPS, signals({ selectionSearchCompleted: true }), NO_LATCHES),
    ).toEqual([true, true, false, false, false]);
  });

  it("latches a later step on its own, as its action happens", () => {
    expect(
      latchProgress(
        STEPS,
        signals({ selectionSearchCompleted: true, fontSizeChanged: true }),
        NO_LATCHES,
      ),
    ).toEqual([true, true, false, true, false]);
  });

  it("never unlatches what is already latched", () => {
    const latched = [true, true, true, true, false];
    expect(
      latchProgress(STEPS, signals({ selectionSearchCompleted: true }), latched),
    ).toEqual(latched);
  });
});

describe("clearLatchesAfterBoundary", () => {
  it("keeps the search and everything before it, clears what follows", () => {
    expect(
      clearLatchesAfterBoundary(STEPS, [true, true, true, true, true]),
    ).toEqual([true, true, false, false, false]);
  });

  it("leaves an untaught tour untaught", () => {
    expect(clearLatchesAfterBoundary(STEPS, NO_LATCHES)).toEqual([
      false,
      false,
      false,
      false,
      false,
    ]);
  });
});

/**
 * The eleven-step script walked as a reader walks it (#178): each action in
 * turn, asserting the tour moves on by itself. Pure — the signals here are the
 * snapshot the stores and the DOM probe produce, and neither is mounted.
 */
import { describe, expect, it } from "vitest";
import { TOUR_STEPS, DRAG_REORDER_STEP_ID } from "./tourSteps";
import {
  NO_LATCHES,
  deriveStepIndex,
  latchProgress,
  type TourSignals,
} from "./tourProgress";
import { NOTHING_DONE } from "./tourSignals.fixture";

const stepIndex = (id: string) => TOUR_STEPS.findIndex((s) => s.id === id);

/**
 * A reader working through the workspace: each action is the change it makes to
 * the workspace, and `at()` answers which card is showing after it.
 */
function reader(from: TourSignals = NOTHING_DONE) {
  let signals = from;
  let latched: readonly boolean[] = NO_LATCHES;
  return {
    does(change: Partial<TourSignals>) {
      signals = { ...signals, ...change };
      latched = latchProgress(TOUR_STEPS, signals, latched);
      return this;
    },
    at() {
      return deriveStepIndex(TOUR_STEPS, signals, latched);
    },
  };
}

describe("the eleven-step script", () => {
  it("has a gate on every step but the last", () => {
    const withoutGate = TOUR_STEPS.filter((step) => !step.gate);
    expect(withoutGate.map((s) => s.id)).toEqual([TOUR_STEPS.at(-1)!.id]);
  });

  it("walks all eleven steps with no press of Next", () => {
    const walker = reader();
    expect(walker.at()).toBe(0);

    // 1. Click Works.
    expect(walker.does({ worksDropdownOpen: true }).at()).toBe(1);
    // 2. Open a story.
    expect(walker.does({ workExpanded: true }).at()).toBe(2);
    // 3. Tick two versions.
    expect(walker.does({ versionsTicked: 2 }).at()).toBe(3);
    // 4. Open selected — which closes the dropdown and clears the ticks, as
    //    WorkPicker really does. The tour must not fall back to step 1.
    expect(
      walker
        .does({
          openDocumentCount: 2,
          worksDropdownOpen: false,
          workExpanded: false,
          versionsTicked: 0,
        })
        .at(),
    ).toBe(4);
    // 5. Select a passage.
    expect(walker.does({ passageSelected: true }).at()).toBe(5);
    // 6. Click the floating Search — the click can collapse the selection.
    expect(
      walker.does({ searchFired: true, passageSelected: false }).at(),
    ).toBe(6);
    // 7. The result card arrives.
    expect(walker.does({ searchCompleted: true }).at()).toBe(7);
    // 8. Move between matches.
    expect(walker.does({ resultNavigated: true }).at()).toBe(8);
    // 9. Drag a column.
    expect(walker.does({ columnsReordered: true }).at()).toBe(9);
    // 10. Change the text size.
    expect(walker.does({ fontSizeChanged: true }).at()).toBe(10);
    // 11. The last card waits for nothing; "Done" ends the tour.
    expect(walker.at()).toBe(TOUR_STEPS.length - 1);
  });

  it("asks nothing of which work, which versions, or how many matched", () => {
    // Any expanded work and any two ticks, and a search that found nothing:
    // the walk to the result card is the same.
    const walker = reader()
      .does({ worksDropdownOpen: true })
      .does({ workExpanded: true })
      .does({ versionsTicked: 2 })
      .does({ openDocumentCount: 2 })
      .does({ passageSelected: true })
      .does({ searchFired: true });
    expect(walker.at()).toBe(stepIndex("read-result"));

    // A search that returned nothing still completed.
    expect(walker.does({ searchCompleted: true }).at()).toBe(
      stepIndex("navigate-results"),
    );
    // And with no matches to move between, the rest is still reachable — by
    // Next, which always moves forward (ADR-0022).
    expect(walker.does({ fontSizeChanged: true }).at()).toBe(
      stepIndex("navigate-results"),
    );
  });

  it("follows the reader backwards through the opening steps", () => {
    const walker = reader().does({ worksDropdownOpen: true });
    expect(walker.at()).toBe(1);

    // The dropdown closed again with nothing opened: the tour asks for it again.
    expect(walker.does({ worksDropdownOpen: false }).at()).toBe(0);
  });

  it("un-ticking a version goes back to asking for two", () => {
    const walker = reader()
      .does({ worksDropdownOpen: true })
      .does({ workExpanded: true })
      .does({ versionsTicked: 2 });
    expect(walker.at()).toBe(stepIndex("open-selected"));

    expect(walker.does({ versionsTicked: 1 }).at()).toBe(
      stepIndex("tick-versions"),
    );
  });

  it("keeps the search steps taught when a column is closed afterwards", () => {
    const walker = reader()
      .does({ worksDropdownOpen: true, workExpanded: true, versionsTicked: 2 })
      .does({ openDocumentCount: 2, passageSelected: true })
      .does({ searchFired: true, searchCompleted: true });
    expect(walker.at()).toBe(stepIndex("navigate-results"));

    expect(
      walker.does({ openDocumentCount: 1, searchFired: false, searchCompleted: false }).at(),
    ).toBe(stepIndex("navigate-results"));
  });

  describe("the reversible steps latch", () => {
    const searched = () =>
      reader().does({
        worksDropdownOpen: true,
        workExpanded: true,
        versionsTicked: 2,
        openDocumentCount: 2,
        passageSelected: true,
        searchFired: true,
        searchCompleted: true,
      });

    it("moving back to the first match does not un-teach navigation", () => {
      const walker = searched().does({ resultNavigated: true });
      expect(walker.does({ resultNavigated: false }).at()).toBe(
        stepIndex(DRAG_REORDER_STEP_ID),
      );
    });

    it("dragging a column back where it was does not un-teach reordering", () => {
      const walker = searched()
        .does({ resultNavigated: true })
        .does({ columnsReordered: true });
      expect(walker.does({ columnsReordered: false }).at()).toBe(
        stepIndex("font-size"),
      );
    });

    it("putting the text size back does not un-teach it", () => {
      const walker = searched()
        .does({ resultNavigated: true })
        .does({ columnsReordered: true })
        .does({ fontSizeChanged: true });
      expect(walker.does({ fontSizeChanged: false }).at()).toBe(
        TOUR_STEPS.length - 1,
      );
    });
  });
});

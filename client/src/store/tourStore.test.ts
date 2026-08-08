import { beforeEach, describe, expect, it } from "vitest";
import { useTourStore } from "./tourStore";
import { TOUR_STEPS } from "../workspace/tour/tourSteps";
import { TOUR_DISMISSED_KEY } from "../workspace/tour/tourStorage";
import { signals } from "../workspace/tour/tourSignals.fixture";

const searchStepIndex = TOUR_STEPS.findIndex((s) => s.latchBoundary);

beforeEach(() => {
  localStorage.clear();
  useTourStore.setState({ isOpen: false, manualIndex: 0, latched: [] });
});

describe("tourStore", () => {
  it("start opens the tour with its manual pointer back at the first step", () => {
    useTourStore.setState({ manualIndex: 3 });
    useTourStore.getState().start();
    expect(useTourStore.getState().isOpen).toBe(true);
    expect(useTourStore.getState().manualIndex).toBe(0);
  });

  it("re-opening forgets the steps after the search, and keeps the ones before", () => {
    useTourStore.setState({ latched: TOUR_STEPS.map(() => true) });
    useTourStore.getState().start();
    const latched = useTourStore.getState().latched;
    expect(latched.slice(0, searchStepIndex + 1).every(Boolean)).toBe(true);
    expect(latched.slice(searchStepIndex + 1).some(Boolean)).toBe(false);
  });

  it("syncProgress records what the workspace has taught", () => {
    useTourStore.getState().syncProgress(signals({ selectionSearchCompleted: true }));
    expect(useTourStore.getState().latched[searchStepIndex]).toBe(true);
  });

  it("syncProgress keeps the same array when nothing new latched", () => {
    const store = useTourStore.getState();
    store.syncProgress(signals({ selectionSearchCompleted: true }));
    const first = useTourStore.getState().latched;
    store.syncProgress(signals({ selectionSearchCompleted: true }));
    // Same reference, so a signal that changes nothing cannot re-render the
    // overlay every animation frame.
    expect(useTourStore.getState().latched).toBe(first);
  });

  it("next moves the manual pointer past the step it was pressed on", () => {
    useTourStore.getState().start();
    useTourStore.getState().next(2);
    expect(useTourStore.getState().manualIndex).toBe(3);
    expect(useTourStore.getState().isOpen).toBe(true);
  });

  it("next on the last step finishes and persists the dismissal", () => {
    useTourStore.setState({ isOpen: true });
    useTourStore.getState().next(TOUR_STEPS.length - 1);
    expect(useTourStore.getState().isOpen).toBe(false);
    expect(localStorage.getItem(TOUR_DISMISSED_KEY)).toBe("1");
  });

  it("back moves the manual pointer back from the step showing", () => {
    useTourStore.setState({ isOpen: true, manualIndex: 3 });
    useTourStore.getState().back(3);
    expect(useTourStore.getState().manualIndex).toBe(2);
  });

  it("back never goes below the first step", () => {
    useTourStore.getState().start();
    useTourStore.getState().back(0);
    expect(useTourStore.getState().manualIndex).toBe(0);
  });

  it("end closes the tour and records the dismissal", () => {
    useTourStore.getState().start();
    useTourStore.getState().end();
    expect(useTourStore.getState().isOpen).toBe(false);
    expect(localStorage.getItem(TOUR_DISMISSED_KEY)).toBe("1");
  });
});

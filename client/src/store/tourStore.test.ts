import { beforeEach, describe, expect, it } from "vitest";
import { useTourStore } from "./tourStore";
import { TOUR_STEPS } from "../workspace/tour/tourSteps";
import { TOUR_DISMISSED_KEY } from "../workspace/tour/tourStorage";

beforeEach(() => {
  localStorage.clear();
  useTourStore.setState({ isOpen: false, stepIndex: 0 });
});

describe("tourStore", () => {
  it("start opens the tour at the first step", () => {
    useTourStore.setState({ stepIndex: 3 });
    useTourStore.getState().start();
    expect(useTourStore.getState().isOpen).toBe(true);
    expect(useTourStore.getState().stepIndex).toBe(0);
  });

  it("next advances one step without finishing before the end", () => {
    useTourStore.getState().start();
    useTourStore.getState().next();
    expect(useTourStore.getState().stepIndex).toBe(1);
    expect(useTourStore.getState().isOpen).toBe(true);
  });

  it("next on the last step finishes and persists the dismissal", () => {
    useTourStore.setState({ isOpen: true, stepIndex: TOUR_STEPS.length - 1 });
    useTourStore.getState().next();
    expect(useTourStore.getState().isOpen).toBe(false);
    expect(localStorage.getItem(TOUR_DISMISSED_KEY)).toBe("1");
  });

  it("back never goes below the first step", () => {
    useTourStore.getState().start();
    useTourStore.getState().back();
    expect(useTourStore.getState().stepIndex).toBe(0);
  });

  it("end closes the tour and records the dismissal", () => {
    useTourStore.getState().start();
    useTourStore.getState().end();
    expect(useTourStore.getState().isOpen).toBe(false);
    expect(localStorage.getItem(TOUR_DISMISSED_KEY)).toBe("1");
  });
});

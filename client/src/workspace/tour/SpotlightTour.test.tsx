import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import SpotlightTour from "./SpotlightTour";
import { TOUR_STEPS } from "./tourSteps";
import { TOUR_DISMISSED_KEY } from "./tourStorage";
import { useTourStore } from "../../store/tourStore";

beforeEach(() => {
  localStorage.clear();
  useTourStore.setState({ isOpen: false, stepIndex: 0 });
});

function advanceToLast() {
  for (let i = 0; i < TOUR_STEPS.length - 1; i++) {
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
  }
}

describe("SpotlightTour", () => {
  it("auto-shows on first visit, opening at the first step", () => {
    render(<SpotlightTour />);
    expect(screen.getByText(TOUR_STEPS[0].title)).toBeInTheDocument();
    expect(screen.getByText(`Step 1 of ${TOUR_STEPS.length}`)).toBeInTheDocument();
  });

  it("does not auto-show once a previous run was dismissed", () => {
    localStorage.setItem(TOUR_DISMISSED_KEY, "1");
    render(<SpotlightTour />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("walks the five anchors in order, then finishes on Done and persists", () => {
    render(<SpotlightTour />);
    TOUR_STEPS.forEach((step, i) => {
      expect(screen.getByText(step.title)).toBeInTheDocument();
      if (i < TOUR_STEPS.length - 1) {
        fireEvent.click(screen.getByRole("button", { name: "Next" }));
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(localStorage.getItem(TOUR_DISMISSED_KEY)).toBe("1");
  });

  it("the search step points at the floating select-to-search button, not the toolbar Search", () => {
    const searchStep = TOUR_STEPS.find((s) => s.anchors.includes("selection-search"));
    expect(searchStep).toBeDefined();
    render(<SpotlightTour />);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText(/floating .Search. button/i)).toBeInTheDocument();
  });

  it("skips at any step and persists the dismissal", () => {
    render(<SpotlightTour />);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: /skip/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(localStorage.getItem(TOUR_DISMISSED_KEY)).toBe("1");
  });

  it("cannot go Back from the first step but can once advanced", () => {
    render(<SpotlightTour />);
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("button", { name: "Back" })).toBeEnabled();
  });

  it("labels only the final step's advance control as Done", () => {
    render(<SpotlightTour />);
    expect(screen.queryByRole("button", { name: "Done" })).not.toBeInTheDocument();
    advanceToLast();
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
  });

  it("is non-blocking: the overlay never traps pointer events on the workspace below", () => {
    render(<SpotlightTour />);
    const overlay = screen.getByTestId("spotlight-tour");
    expect(overlay.className).toMatch(/pointer-events-none/);
  });
});

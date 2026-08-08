import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import SpotlightTour from "./SpotlightTour";
import { DRAG_REORDER_STEP_ID, TOUR_STEPS } from "./tourSteps";
import { TOUR_DISMISSED_KEY } from "./tourStorage";
import { DRAG_REORDER_HINT_DISMISSED_KEY } from "../panels/dragReorderHint";
import { useTourStore } from "../../store/tourStore";
import { useDocumentStore } from "../../store/documentStore";
import { useSearchStore, type SearchAttempt } from "../../store/searchStore";
import {
  DEFAULT_FONT_SIZE,
  useWorkspaceStore,
} from "../../store/workspaceStore";
import type { Document } from "../../types/document";

vi.mock("../../api/log", () => ({ logEvent: vi.fn() }));

const stepTitle = (id: string) =>
  TOUR_STEPS.find((step) => step.id === id)!.title;

const stepNumber = (id: string) =>
  TOUR_STEPS.findIndex((step) => step.id === id) + 1;

// A Version — a TEI witness. Only the id and the format matter here: the tour
// counts the columns a search can reach, and never reads one (#175).
const column = (id: string) =>
  ({ id, title: id, format: "tei" }) as Document;

const attempt = (
  origin: SearchAttempt["origin"] = "selection",
): SearchAttempt => ({
  docId: 1,
  query: "cath",
  origin,
  excludedDocId: null,
  params: { matchLength: 130, precision: 1, dissimilarityScore: 0.5, topK: 10 },
});

/** Two documents open, as the fourth step asks for. */
function openTwoDocuments() {
  act(() => {
    useDocumentStore.setState({
      openDocuments: [column("a"), column("b")],
      visibleDocumentIds: ["a", "b"],
    });
  });
}

/** One column's search comes back — with matches, or with none. */
function completeSearch() {
  act(() => {
    useSearchStore.setState({
      lastAttemptByDocument: { a: attempt() },
      isSearchingByDocument: {},
      searchErrorByDocument: {},
    });
  });
}

/**
 * Put a panel the tour probes for on the page. The real panels are probed in
 * tourDomSignals.test.tsx; what is under test here is that the overlay reads
 * them at all, every frame, with no event to prompt it.
 */
function renderPanel(anchor: string): HTMLElement {
  const el = document.createElement("div");
  el.setAttribute("data-tour", anchor);
  document.body.appendChild(el);
  return el;
}

/** The card showing, once the animation frame that probes the DOM has run. */
async function expectCard(id: string) {
  await waitFor(() =>
    expect(screen.getByText(stepTitle(id))).toBeInTheDocument(),
  );
}

beforeEach(() => {
  localStorage.clear();
  document.body.querySelectorAll("[data-tour]").forEach((el) => el.remove());
  useTourStore.setState({ isOpen: false, manualIndex: 0, latched: [] });
  useDocumentStore.setState({ openDocuments: [], visibleDocumentIds: [] });
  useSearchStore.setState({
    lastAttemptByDocument: {},
    isSearchingByDocument: {},
    searchErrorByDocument: {},
    activeResultIndexByDocument: {},
    resultsByDocument: {},
  });
  useWorkspaceStore.setState({ fontSize: DEFAULT_FONT_SIZE });
});

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

  it("walks the whole script in order, then finishes on Done and persists", () => {
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
    const searchStep = TOUR_STEPS.find((s) =>
      s.anchors.includes("selection-search"),
    );
    expect(searchStep).toBeDefined();
    expect(searchStep!.body).toMatch(/“Search” button appears under your selection/);
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
    for (let i = 0; i < TOUR_STEPS.length - 1; i++) {
      fireEvent.click(screen.getByRole("button", { name: "Next" }));
    }
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
  });

  it("prints the quoted passage on its own lines, as the step writes it", () => {
    const quoting = TOUR_STEPS.find((step) => step.body.includes("\n"))!;
    render(<SpotlightTour />);
    act(() => {
      useTourStore.setState({ manualIndex: TOUR_STEPS.indexOf(quoting) });
    });

    const body = screen.getByText(quoting.body.split("\n")[0], {
      exact: false,
    });
    // Without this the browser collapses the blank lines and the quotation runs
    // into the prose around it.
    expect(body.className).toMatch(/whitespace-pre-line/);
    expect(body.textContent).toBe(quoting.body);
  });

  it("is non-blocking: the overlay never traps pointer events on the workspace below", () => {
    render(<SpotlightTour />);
    const overlay = screen.getByTestId("spotlight-tour");
    expect(overlay.className).toMatch(/pointer-events-none/);
  });
});

describe("SpotlightTour advancing with the workspace (#177, #178)", () => {
  it("advances when the Works dropdown opens, with no press of Next", async () => {
    render(<SpotlightTour />);
    await expectCard("open-works");

    renderPanel("works-panel");

    await expectCard("expand-work");
  });

  it("follows the reader backwards: the dropdown closed again asks for it again", async () => {
    render(<SpotlightTour />);
    const panel = renderPanel("works-panel");
    await expectCard("expand-work");

    panel.remove();

    await expectCard("open-works");
  });

  it("advances through the opening steps as the versions are ticked", async () => {
    render(<SpotlightTour />);
    renderPanel("works-panel");
    const list = renderPanel("version-list");
    await expectCard("tick-versions");

    list.innerHTML =
      '<input type="checkbox" checked /><input type="checkbox" checked />';

    await expectCard("open-selected");
  });

  it("does not fall back to the dropdown steps once the columns are open", async () => {
    render(<SpotlightTour />);
    renderPanel("works-panel");
    await expectCard("expand-work");

    // "Open selected" closes the dropdown and clears the ticks — the very
    // action that satisfies the next step erases the evidence for the last two.
    act(() => {
      document.querySelector('[data-tour="works-panel"]')!.remove();
    });
    openTwoDocuments();

    await expectCard("select-passage");
  });

  it("advances when a search is fired, and again when it comes back", async () => {
    render(<SpotlightTour />);
    openTwoDocuments();
    await expectCard("select-passage");

    act(() => {
      useSearchStore.setState({
        lastAttemptByDocument: { a: attempt() },
        isSearchingByDocument: { a: true },
      });
    });
    await expectCard("read-result");

    completeSearch();
    await expectCard("navigate-results");
  });

  it("does not take a typed toolbar search for the step it asks for", async () => {
    render(<SpotlightTour />);
    openTwoDocuments();
    await expectCard("select-passage");

    act(() => {
      useSearchStore.setState({
        lastAttemptByDocument: { a: attempt("typed") },
      });
    });

    // ADR-0008: this step is the floating select-to-search button's.
    await expectCard("select-passage");
  });

  it("waits on the result card while the search is failing", async () => {
    render(<SpotlightTour />);
    openTwoDocuments();
    act(() => {
      useSearchStore.setState({
        lastAttemptByDocument: { a: attempt() },
        searchErrorByDocument: { a: true },
      });
    });

    await expectCard("read-result");
  });

  it("advances when the reader reorders the columns, and does not go back", async () => {
    render(<SpotlightTour />);
    openTwoDocuments();
    completeSearch();
    act(() => {
      useSearchStore.setState({ activeResultIndexByDocument: { a: 1 } });
    });
    await expectCard(DRAG_REORDER_STEP_ID);

    act(() => {
      useDocumentStore.setState({ visibleDocumentIds: ["b", "a"] });
    });
    await expectCard("font-size");

    // Dragged back where it came from: the reorder is undone, having been
    // taught it is not.
    act(() => {
      useDocumentStore.setState({ visibleDocumentIds: ["a", "b"] });
    });
    await expectCard("font-size");
  });

  it("advances when the text size changes", async () => {
    render(<SpotlightTour />);
    openTwoDocuments();
    completeSearch();
    act(() => {
      useSearchStore.setState({ activeResultIndexByDocument: { a: 1 } });
      useDocumentStore.setState({ visibleDocumentIds: ["b", "a"] });
    });
    await expectCard("font-size");

    act(() => {
      useWorkspaceStore.setState({ fontSize: DEFAULT_FONT_SIZE + 2 });
    });

    await expectCard("manuscripts");
  });

  it("lets Next jump a step whose action the reader does not want to perform", () => {
    render(<SpotlightTour />);
    expect(screen.getByText(stepTitle("open-works"))).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText(stepTitle("expand-work"))).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByText(stepTitle("open-works"))).toBeInTheDocument();
  });

  it("re-opening from Help with two documents open starts past the opening steps", async () => {
    localStorage.setItem(TOUR_DISMISSED_KEY, "1");
    useDocumentStore.setState({
      openDocuments: [column("a"), column("b")],
      visibleDocumentIds: ["a", "b"],
    });
    render(<SpotlightTour />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    act(() => {
      useTourStore.getState().start();
    });

    await expectCard("select-passage");
    expect(
      screen.getByText(`Step ${stepNumber("select-passage")} of ${TOUR_STEPS.length}`),
    ).toBeInTheDocument();
  });
});

describe("SpotlightTour and the drag-reorder hint (#178)", () => {
  it("marks the hint acknowledged once its step is passed", () => {
    render(<SpotlightTour />);
    expect(localStorage.getItem(DRAG_REORDER_HINT_DISMISSED_KEY)).toBeNull();

    const dragStep = TOUR_STEPS.findIndex((s) => s.id === DRAG_REORDER_STEP_ID);
    for (let i = 0; i <= dragStep; i++) {
      fireEvent.click(screen.getByRole("button", { name: "Next" }));
    }

    expect(localStorage.getItem(DRAG_REORDER_HINT_DISMISSED_KEY)).toBe("1");
  });

  it("leaves it alone while the reader is still short of that step", () => {
    render(<SpotlightTour />);
    const dragStep = TOUR_STEPS.findIndex((s) => s.id === DRAG_REORDER_STEP_ID);
    for (let i = 0; i < dragStep; i++) {
      fireEvent.click(screen.getByRole("button", { name: "Next" }));
    }

    expect(screen.getByText(stepTitle(DRAG_REORDER_STEP_ID))).toBeInTheDocument();
    expect(localStorage.getItem(DRAG_REORDER_HINT_DISMISSED_KEY)).toBeNull();
  });

  it("leaves it alone when the reader skips the tour on the first card", () => {
    render(<SpotlightTour />);
    fireEvent.click(screen.getByRole("button", { name: /skip/i }));

    expect(localStorage.getItem(DRAG_REORDER_HINT_DISMISSED_KEY)).toBeNull();
  });
});

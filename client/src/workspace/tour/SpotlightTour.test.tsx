import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import SpotlightTour from "./SpotlightTour";
import { TOUR_STEPS } from "./tourSteps";
import { TOUR_DISMISSED_KEY } from "./tourStorage";
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

// Only the id matters here: the tour counts columns, it never reads one.
const column = (id: string) => ({ id, title: id }) as Document;

const attempt = (): SearchAttempt => ({
  docId: 1,
  query: "cath",
  origin: "typed",
  excludedDocId: null,
  params: { matchLength: 130, precision: 1, dissimilarityScore: 0.5, topK: 10 },
});

/** Two documents open, as the first step asks for. */
function openTwoDocuments() {
  act(() => {
    useDocumentStore.setState({
      openDocuments: [column("a"), column("b")],
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

beforeEach(() => {
  localStorage.clear();
  useTourStore.setState({ isOpen: false, manualIndex: 0, latched: [] });
  useDocumentStore.setState({ openDocuments: [] });
  useSearchStore.setState({
    lastAttemptByDocument: {},
    isSearchingByDocument: {},
    searchErrorByDocument: {},
    activeResultIndexByDocument: {},
    resultsByDocument: {},
  });
  useWorkspaceStore.setState({ fontSize: DEFAULT_FONT_SIZE });
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

describe("SpotlightTour advancing with the workspace (#177)", () => {
  it("advances when a second document is opened, with no press of Next", () => {
    render(<SpotlightTour />);
    expect(screen.getByText(stepTitle("open-documents"))).toBeInTheDocument();

    openTwoDocuments();

    expect(screen.getByText(stepTitle("select-to-search"))).toBeInTheDocument();
  });

  it("stays on the opening step while only one document is open", () => {
    render(<SpotlightTour />);
    act(() => {
      useDocumentStore.setState({ openDocuments: [column("a")] });
    });
    expect(screen.getByText(stepTitle("open-documents"))).toBeInTheDocument();
  });

  it("advances when a search comes back, whether or not it found anything", () => {
    render(<SpotlightTour />);
    openTwoDocuments();

    completeSearch();

    expect(screen.getByText(stepTitle("navigate-results"))).toBeInTheDocument();
  });

  it("does not advance on a search that errored — that column offers Retry", () => {
    render(<SpotlightTour />);
    openTwoDocuments();

    act(() => {
      useSearchStore.setState({
        lastAttemptByDocument: { a: attempt() },
        searchErrorByDocument: { a: true },
      });
    });

    expect(screen.getByText(stepTitle("select-to-search"))).toBeInTheDocument();
  });

  it("advances when the reader moves through the results", () => {
    render(<SpotlightTour />);
    openTwoDocuments();
    completeSearch();

    act(() => {
      useSearchStore.setState({ activeResultIndexByDocument: { a: 1 } });
    });

    expect(screen.getByText(stepTitle("font-size"))).toBeInTheDocument();
  });

  it("advances when the text size changes", () => {
    render(<SpotlightTour />);
    openTwoDocuments();
    completeSearch();
    act(() => {
      useSearchStore.setState({ activeResultIndexByDocument: { a: 1 } });
    });

    act(() => {
      useWorkspaceStore.setState({ fontSize: DEFAULT_FONT_SIZE + 2 });
    });

    expect(screen.getByText(stepTitle("manuscripts"))).toBeInTheDocument();
  });

  it("follows the workspace backwards before any search has completed", () => {
    render(<SpotlightTour />);
    openTwoDocuments();
    expect(screen.getByText(stepTitle("select-to-search"))).toBeInTheDocument();

    // A column closed again: nothing has been taught for good yet, so the tour
    // goes back to asking for what it asked for.
    act(() => {
      useDocumentStore.setState({ openDocuments: [column("a")] });
    });

    expect(screen.getByText(stepTitle("open-documents"))).toBeInTheDocument();
  });

  it("does not go back to the opening steps when a column is closed after a search", () => {
    render(<SpotlightTour />);
    openTwoDocuments();
    completeSearch();

    act(() => {
      useDocumentStore.setState({ openDocuments: [column("a")] });
      useSearchStore.setState({ lastAttemptByDocument: {} });
    });

    expect(screen.getByText(stepTitle("navigate-results"))).toBeInTheDocument();
  });

  it("keeps a later step taught when its action is undone", () => {
    render(<SpotlightTour />);
    openTwoDocuments();
    completeSearch();
    act(() => {
      useSearchStore.setState({ activeResultIndexByDocument: { a: 1 } });
    });
    expect(screen.getByText(stepTitle("font-size"))).toBeInTheDocument();

    // Back on the first match. Navigating is reversible; having been taught it
    // is not.
    act(() => {
      useSearchStore.setState({ activeResultIndexByDocument: { a: 0 } });
    });

    expect(screen.getByText(stepTitle("font-size"))).toBeInTheDocument();
  });

  it("lets Next jump a step whose action the reader does not want to perform", () => {
    render(<SpotlightTour />);
    expect(screen.getByText(stepTitle("open-documents"))).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText(stepTitle("select-to-search"))).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByText(stepTitle("open-documents"))).toBeInTheDocument();
  });

  it("re-opening from Help with two documents open starts past the opening step", () => {
    localStorage.setItem(TOUR_DISMISSED_KEY, "1");
    useDocumentStore.setState({
      openDocuments: [column("a"), column("b")],
    });
    render(<SpotlightTour />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    act(() => {
      useTourStore.getState().start();
    });

    expect(screen.getByText(stepTitle("select-to-search"))).toBeInTheDocument();
  });

  it("re-opening from Help teaches the steps after the search again", () => {
    render(<SpotlightTour />);
    openTwoDocuments();
    completeSearch();
    act(() => {
      useWorkspaceStore.setState({ fontSize: DEFAULT_FONT_SIZE + 2 });
    });
    // The text-size step is taught by now, even though the reader never reached
    // its card. Put the size back and close the tour.
    act(() => {
      useWorkspaceStore.setState({ fontSize: DEFAULT_FONT_SIZE });
      useTourStore.getState().end();
    });

    act(() => {
      useTourStore.getState().start();
    });

    // The workspace is untouched — the two documents are still open, so the
    // opening step stays behind us — but the text size is asked for again.
    expect(useDocumentStore.getState().openDocuments).toHaveLength(2);
    expect(screen.queryByText(stepTitle("open-documents"))).not.toBeInTheDocument();
    expect(screen.getByText(stepTitle("navigate-results"))).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText(stepTitle("font-size"))).toBeInTheDocument();
  });
});

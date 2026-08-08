import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import {
  columnsReordered,
  resultNavigated,
  selectionSearchCompleted,
  selectionSearchFired,
  useTourStoreSignals,
} from "./tourSignals";
import { useDocumentStore } from "../../store/documentStore";
import { useSearchStore, type SearchAttempt } from "../../store/searchStore";
import { DEFAULT_FONT_SIZE, useWorkspaceStore } from "../../store/workspaceStore";
import type { Document } from "../../types/document";

vi.mock("../../api/log", () => ({ logEvent: vi.fn() }));

// A Version — a TEI witness. Only the id and the format matter here: the tour
// counts the columns a search can reach, and never reads one (#175).
const column = (id: string) =>
  ({ id, title: id, format: "tei" }) as Document;

const attempt = (origin: SearchAttempt["origin"] = "selection"): SearchAttempt => ({
  docId: 1,
  query: "cath",
  origin,
  excludedDocId: null,
  params: { matchLength: 130, precision: 1, dissimilarityScore: 0.5, topK: 10 },
});

const searchState = (over: Partial<ReturnType<typeof emptySearch>> = {}) => ({
  ...emptySearch(),
  ...over,
});

function emptySearch() {
  return {
    lastAttemptByDocument: {} as Record<string, SearchAttempt>,
    isSearchingByDocument: {} as Record<string, boolean>,
    searchErrorByDocument: {} as Record<string, boolean>,
    activeResultIndexByDocument: {} as Record<string, number>,
  };
}

beforeEach(() => {
  useDocumentStore.setState({ openDocuments: [], visibleDocumentIds: [] });
  useSearchStore.setState({ ...emptySearch(), resultsByDocument: {} });
  useWorkspaceStore.setState({ fontSize: DEFAULT_FONT_SIZE });
});

describe("selectionSearchCompleted", () => {
  it("is false when nothing has ever been searched", () => {
    expect(selectionSearchCompleted(searchState())).toBe(false);
  });

  it("is true once a column's search has come back", () => {
    expect(
      selectionSearchCompleted(searchState({ lastAttemptByDocument: { a: attempt() } })),
    ).toBe(true);
  });

  it("is false while the search is still in flight", () => {
    expect(
      selectionSearchCompleted(
        searchState({
          lastAttemptByDocument: { a: attempt() },
          isSearchingByDocument: { a: true },
        }),
      ),
    ).toBe(false);
  });

  it("is false for a search that errored — that column offers Retry", () => {
    expect(
      selectionSearchCompleted(
        searchState({
          lastAttemptByDocument: { a: attempt() },
          searchErrorByDocument: { a: true },
        }),
      ),
    ).toBe(false);
  });

  it("is false for a typed toolbar search, however well it went", () => {
    // The latch boundary sits on this signal: a typed search counting here would
    // teach the two select-to-search steps as done (ADR-0008).
    expect(
      selectionSearchCompleted(
        searchState({ lastAttemptByDocument: { a: attempt("typed") } }),
      ),
    ).toBe(false);
  });

  it("is true when one column succeeded and another failed", () => {
    expect(
      selectionSearchCompleted(
        searchState({
          lastAttemptByDocument: { a: attempt(), b: attempt() },
          searchErrorByDocument: { b: true },
        }),
      ),
    ).toBe(true);
  });
});

describe("resultNavigated", () => {
  it("is true for any column sitting past its first match", () => {
    expect(
      resultNavigated(searchState({ activeResultIndexByDocument: { a: 0, b: 3 } })),
    ).toBe(true);
  });

  it("does not call sitting on the first match navigation", () => {
    expect(
      resultNavigated(searchState({ activeResultIndexByDocument: { a: 0 } })),
    ).toBe(false);
  });
});

describe("selectionSearchFired", () => {
  it("is true from the moment an attempt is recorded, before it comes back", () => {
    expect(
      selectionSearchFired(
        searchState({
          lastAttemptByDocument: { a: attempt() },
          isSearchingByDocument: { a: true },
        }),
      ),
    ).toBe(true);
  });

  it("is false when nothing has been searched", () => {
    expect(selectionSearchFired(searchState())).toBe(false);
  });

  it("is false for a typed toolbar search — the step asks for the floating one", () => {
    // ADR-0008: the tour's search step points at the select-to-search button,
    // never the toolbar's typed query.
    expect(
      selectionSearchFired(
        searchState({ lastAttemptByDocument: { a: attempt("typed") } }),
      ),
    ).toBe(false);
  });
});

describe("columnsReordered", () => {
  const opened = [column("a"), column("b"), column("c")];

  it("is false while the columns stand in the order they were opened", () => {
    expect(
      columnsReordered({
        openDocuments: opened,
        visibleDocumentIds: ["a", "b", "c"],
      }),
    ).toBe(false);
  });

  it("is false when a column is closed — the rest keep their order", () => {
    expect(
      columnsReordered({
        openDocuments: opened,
        visibleDocumentIds: ["a", "c"],
      }),
    ).toBe(false);
  });

  it("is true once a drag has moved one", () => {
    expect(
      columnsReordered({
        openDocuments: opened,
        visibleDocumentIds: ["c", "a", "b"],
      }),
    ).toBe(true);
  });
});

describe("useTourStoreSignals", () => {
  it("reads an untouched workspace as nothing done", () => {
    expect(renderHook(() => useTourStoreSignals()).result.current).toEqual({
      openVersionCount: 0,
      selectionSearchFired: false,
      selectionSearchCompleted: false,
      resultNavigated: false,
      columnsReordered: false,
      fontSizeChanged: false,
    });
  });

  it("reads the whole workspace: columns, search, order, and text size", () => {
    useDocumentStore.setState({
      openDocuments: [column("a"), column("b")],
      visibleDocumentIds: ["b", "a"],
    });
    useSearchStore.setState({
      lastAttemptByDocument: { a: attempt() },
      activeResultIndexByDocument: { a: 2 },
    });
    useWorkspaceStore.setState({ fontSize: DEFAULT_FONT_SIZE + 2 });

    expect(renderHook(() => useTourStoreSignals()).result.current).toEqual({
      openVersionCount: 2,
      selectionSearchFired: true,
      selectionSearchCompleted: true,
      resultNavigated: true,
      columnsReordered: true,
      fontSizeChanged: true,
    });
  });

  it("hands back the same object while nothing it reads has changed", () => {
    const { result, rerender } = renderHook(() => useTourStoreSignals());
    const first = result.current;
    rerender();
    // The overlay folds these into its latches from an effect keyed on this
    // object; a fresh one every render would run that effect every render.
    expect(result.current).toBe(first);
  });
});

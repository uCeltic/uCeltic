import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { resultNavigated, searchCompleted, useTourSignals } from "./tourSignals";
import { useDocumentStore } from "../../store/documentStore";
import { useSearchStore, type SearchAttempt } from "../../store/searchStore";
import { DEFAULT_FONT_SIZE, useWorkspaceStore } from "../../store/workspaceStore";
import type { Document } from "../../types/document";

vi.mock("../../api/log", () => ({ logEvent: vi.fn() }));

// Only the id matters here: these signals count columns, they never read one.
const column = (id: string) => ({ id, title: id }) as Document;

const attempt = (): SearchAttempt => ({
  docId: 1,
  query: "cath",
  origin: "typed",
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
  useDocumentStore.setState({ openDocuments: [] });
  useSearchStore.setState({ ...emptySearch(), resultsByDocument: {} });
  useWorkspaceStore.setState({ fontSize: DEFAULT_FONT_SIZE });
});

describe("searchCompleted", () => {
  it("is false when nothing has ever been searched", () => {
    expect(searchCompleted(searchState())).toBe(false);
  });

  it("is true once a column's search has come back", () => {
    expect(
      searchCompleted(searchState({ lastAttemptByDocument: { a: attempt() } })),
    ).toBe(true);
  });

  it("is false while the search is still in flight", () => {
    expect(
      searchCompleted(
        searchState({
          lastAttemptByDocument: { a: attempt() },
          isSearchingByDocument: { a: true },
        }),
      ),
    ).toBe(false);
  });

  it("is false for a search that errored — that column offers Retry", () => {
    expect(
      searchCompleted(
        searchState({
          lastAttemptByDocument: { a: attempt() },
          searchErrorByDocument: { a: true },
        }),
      ),
    ).toBe(false);
  });

  it("is true when one column succeeded and another failed", () => {
    expect(
      searchCompleted(
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

describe("useTourSignals", () => {
  it("reads an untouched workspace as nothing done", () => {
    expect(renderHook(() => useTourSignals()).result.current).toEqual({
      openDocumentCount: 0,
      searchCompleted: false,
      resultNavigated: false,
      fontSizeChanged: false,
    });
  });

  it("reads the whole workspace: columns, search, and text size", () => {
    useDocumentStore.setState({ openDocuments: [column("a"), column("b")] });
    useSearchStore.setState({
      lastAttemptByDocument: { a: attempt() },
      activeResultIndexByDocument: { a: 2 },
    });
    useWorkspaceStore.setState({ fontSize: DEFAULT_FONT_SIZE + 2 });

    expect(renderHook(() => useTourSignals()).result.current).toEqual({
      openDocumentCount: 2,
      searchCompleted: true,
      resultNavigated: true,
      fontSizeChanged: true,
    });
  });

  it("hands back the same object while nothing it reads has changed", () => {
    const { result, rerender } = renderHook(() => useTourSignals());
    const first = result.current;
    rerender();
    // The overlay folds these into its latches from an effect keyed on this
    // object; a fresh one every render would run that effect every render.
    expect(result.current).toBe(first);
  });
});

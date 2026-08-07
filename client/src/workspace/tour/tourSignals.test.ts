import { beforeEach, describe, expect, it, vi } from "vitest";
import { tourSignalsFrom } from "./tourSignals";
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

function signals() {
  return tourSignalsFrom(
    useDocumentStore.getState(),
    useSearchStore.getState(),
    useWorkspaceStore.getState(),
  );
}

beforeEach(() => {
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

describe("tourSignalsFrom", () => {
  it("reads an untouched workspace as nothing done", () => {
    expect(signals()).toEqual({
      openDocumentCount: 0,
      searchCompleted: false,
      resultNavigated: false,
      fontSizeChanged: false,
    });
  });

  it("counts the open documents", () => {
    useDocumentStore.setState({ openDocuments: [column("a"), column("b")] });
    expect(signals().openDocumentCount).toBe(2);
  });

  describe("searchCompleted", () => {
    it("is true once a column's search has come back with matches", () => {
      useSearchStore.setState({
        lastAttemptByDocument: { a: attempt() },
        resultsByDocument: { a: [{ start: 0, end: 1, score: 0.9 } as never] },
      });
      expect(signals().searchCompleted).toBe(true);
    });

    it("is true for a search that came back with no matches at all", () => {
      useSearchStore.setState({
        lastAttemptByDocument: { a: attempt() },
        resultsByDocument: { a: [] },
      });
      expect(signals().searchCompleted).toBe(true);
    });

    it("is false while the search is still in flight", () => {
      useSearchStore.setState({
        lastAttemptByDocument: { a: attempt() },
        isSearchingByDocument: { a: true },
      });
      expect(signals().searchCompleted).toBe(false);
    });

    it("is false for a search that errored — that column offers Retry", () => {
      useSearchStore.setState({
        lastAttemptByDocument: { a: attempt() },
        searchErrorByDocument: { a: true },
      });
      expect(signals().searchCompleted).toBe(false);
    });

    it("is true when one column succeeded and another failed", () => {
      useSearchStore.setState({
        lastAttemptByDocument: { a: attempt(), b: attempt() },
        searchErrorByDocument: { b: true },
      });
      expect(signals().searchCompleted).toBe(true);
    });
  });

  it("reads result navigation off any column sitting past its first match", () => {
    useSearchStore.setState({ activeResultIndexByDocument: { a: 0, b: 3 } });
    expect(signals().resultNavigated).toBe(true);
  });

  it("does not call sitting on the first match navigation", () => {
    useSearchStore.setState({ activeResultIndexByDocument: { a: 0 } });
    expect(signals().resultNavigated).toBe(false);
  });

  it("reads the text size against the size the workspace starts at", () => {
    useWorkspaceStore.setState({ fontSize: DEFAULT_FONT_SIZE + 2 });
    expect(signals().fontSizeChanged).toBe(true);
  });
});

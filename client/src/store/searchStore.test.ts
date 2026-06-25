import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSearchStore } from "./searchStore";
import { searchDocument } from "../api/search";
import type { SearchResult } from "../types/search";

// runSearch calls searchDocument internally.
// Mock it here so tests avoid real network requests and can inspect the call history.
vi.mock("../api/search", () => ({ searchDocument: vi.fn() }));
const mockedSearch = vi.mocked(searchDocument);

// sample result for testing
const sampleResult: SearchResult = {
  score: 0.12,
  snippet: "the hound of culann",
  word_start: 4,
  word_end: 8,
  anchor_id: 3,
  anchor_tag: "seg",
  line_no: "12",
};

// reset before each "it" test
beforeEach(() => {
  mockedSearch.mockReset();
  useSearchStore.setState({
    query: "",
    resultsByDocument: {},
    activeResultIndexByDocument: {},
    isSearchingByDocument: {},
    searchErrorByDocument: {},
  });
});

// group tests for the runSearch function
describe("searchStore.runSearch", () => {
  //Test: when the query is not blank
  it("stores results under the document and resets the active index on success", async () => {
    mockedSearch.mockResolvedValue([sampleResult]);
    useSearchStore.getState().setQuery("hound");

    await useSearchStore.getState().runSearch(42, "doc-tei-42");

    const state = useSearchStore.getState();
    expect(state.resultsByDocument["doc-tei-42"]).toEqual([sampleResult]);
    expect(state.activeResultIndexByDocument["doc-tei-42"]).toBe(0);
    expect(mockedSearch).toHaveBeenCalledOnce();
  });

  //Test: the default search uses the canonical 1.3 (130%) window-size ratio
  it("sends the canonical 1.3 window-size ratio by default", async () => {
    mockedSearch.mockResolvedValue([sampleResult]);
    useSearchStore.getState().setQuery("hound");

    await useSearchStore.getState().runSearch(42, "doc-tei-42");

    expect(mockedSearch).toHaveBeenCalledWith(
      expect.objectContaining({ windowSizeRatio: 1.3 }),
    );
  });

  //Test: when the query is blank
  it("skips the API call when the query is blank", async () => {
    useSearchStore.getState().setQuery("   ");
    await useSearchStore.getState().runSearch(42, "doc-tei-42");
    expect(mockedSearch).not.toHaveBeenCalled();
  });

  //Test: the column enters the searching state while the request is in flight
  it("marks the column as searching while the request is in flight", () => {
    // a request that never resolves, so we can observe the in-flight state
    mockedSearch.mockReturnValue(new Promise<SearchResult[]>(() => {}));
    useSearchStore.getState().setQuery("hound");

    useSearchStore.getState().runSearch(42, "doc-tei-42");

    expect(useSearchStore.getState().isSearchingByDocument["doc-tei-42"]).toBe(
      true,
    );
  });

  //Test: the column exits the searching state when the request is completed//Test: on success the column leaves the searching state
  it("clears the column's searching flag after the request resolves", async () => {
    mockedSearch.mockResolvedValue([sampleResult]);
    useSearchStore.getState().setQuery("hound");

    await useSearchStore.getState().runSearch(42, "doc-tei-42");

    expect(useSearchStore.getState().isSearchingByDocument["doc-tei-42"]).toBe(
      false,
    );
  });

  //Test: a failed request surfaces an error state, not empty results
  it("flags the column as errored when the request fails", async () => {
    mockedSearch.mockRejectedValue(new Error("network down"));
    useSearchStore.getState().setQuery("hound");

    await useSearchStore.getState().runSearch(42, "doc-tei-42");

    const state = useSearchStore.getState();
    expect(state.searchErrorByDocument["doc-tei-42"]).toBe(true);
    expect(state.isSearchingByDocument["doc-tei-42"]).toBe(false);
  });

  //Test: starting a search immediately clears the column's old results and error
  it("clears the column's previous results and error the moment a search starts", () => {
    // pre-existing results/error/active index from an earlier search
    useSearchStore.setState({
      resultsByDocument: { "doc-tei-42": [sampleResult] },
      activeResultIndexByDocument: { "doc-tei-42": 3 },
      searchErrorByDocument: { "doc-tei-42": true },
    });
    // a request that never resolves, so we only observe the synchronous clear
    mockedSearch.mockReturnValue(new Promise<SearchResult[]>(() => {}));
    useSearchStore.getState().setQuery("hound");

    useSearchStore.getState().runSearch(42, "doc-tei-42");

    const state = useSearchStore.getState();
    expect(state.resultsByDocument["doc-tei-42"]).toEqual([]);
    expect(state.searchErrorByDocument["doc-tei-42"]).toBe(false);
    expect(state.activeResultIndexByDocument["doc-tei-42"]).toBe(0);
  });

  //Test: columns are independent — resolving one never flips another's flag
  it("keeps each column's searching flag independent", async () => {
    // key the mock off docId so call ordering/timing doesn't matter:
    // doc id 1 (doc-a) resolves, doc id 2 (doc-b) stays pending forever
    mockedSearch.mockImplementation(({ docId }) =>
      docId === 1
        ? Promise.resolve([sampleResult])
        : new Promise<SearchResult[]>(() => {}),
    );
    useSearchStore.getState().setQuery("hound");

    useSearchStore.getState().runSearch(2, "doc-b"); // stays pending
    await useSearchStore.getState().runSearch(1, "doc-a"); // resolves fully

    expect(useSearchStore.getState().isSearchingByDocument["doc-a"]).toBe(
      false,
    );
    expect(useSearchStore.getState().isSearchingByDocument["doc-b"]).toBe(true);
  });
});

describe("searchStore result navigation", () => {
  const results: SearchResult[] = [
    sampleResult,
    { ...sampleResult, snippet: "second" },
    { ...sampleResult, snippet: "third" },
  ];

  // reset results and active index before each "it" test
  beforeEach(() => {
    useSearchStore.setState({
      resultsByDocument: { "doc-1": results },
      activeResultIndexByDocument: { "doc-1": 0 },
    });
  });

  //Test: if out of bounds >= length, set to length-1
  //Test: if out of bounds < 0, set to 0
  it("clamps setActiveResultIndex within the result bounds", () => {
    useSearchStore.getState().setActiveResultIndex("doc-1", 99);
    expect(useSearchStore.getState().activeResultIndexByDocument["doc-1"]).toBe(
      2,
    );

    useSearchStore.getState().setActiveResultIndex("doc-1", -5);
    expect(useSearchStore.getState().activeResultIndexByDocument["doc-1"]).toBe(
      0,
    );
  });

  //Test: if at the last result, nextResult is still the last result
  //Test: if at the first result, prevResult is still the first result
  it("nextResult stops at the last result, prevResult stops at the first", () => {
    const { nextResult, prevResult } = useSearchStore.getState();

    useSearchStore.setState({ activeResultIndexByDocument: { "doc-1": 2 } });
    nextResult("doc-1");
    expect(useSearchStore.getState().activeResultIndexByDocument["doc-1"]).toBe(
      2,
    );

    useSearchStore.setState({ activeResultIndexByDocument: { "doc-1": 0 } });
    prevResult("doc-1");
    expect(useSearchStore.getState().activeResultIndexByDocument["doc-1"]).toBe(
      0,
    );
  });
});

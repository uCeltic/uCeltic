import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSearchStore } from "./searchStore";
import { searchDocument } from "../api/search";
import { logEvent } from "../api/log";
import type { SearchResult } from "../types/search";

// runSearch calls searchDocument internally.
// Mock it here so tests avoid real network requests and can inspect the call history.
vi.mock("../api/search", () => ({ searchDocument: vi.fn() }));
const mockedSearch = vi.mocked(searchDocument);

// behavior logging is a side effect, not the point of these store tests —
// mock it so we can assert the emitted events without a real network call.
vi.mock("../api/log", () => ({ logEvent: vi.fn() }));
const mockedLogEvent = vi.mocked(logEvent);

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
  mockedLogEvent.mockReset();
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

  //Test: a successful search logs one search_performed event with the query,
  //search params, result_count, latency_ms, and error:false
  it("logs a search_performed event on success", async () => {
    mockedSearch.mockResolvedValue([sampleResult]);
    useSearchStore.setState({
      matchLength: 130,
      precision: 1,
      dissimilarityScore: 0.5,
      topK: 10,
    });
    useSearchStore.getState().setQuery("hound");

    await useSearchStore.getState().runSearch(42, "doc-tei-42");

    expect(mockedLogEvent).toHaveBeenCalledOnce();
    const [eventType, payload] = mockedLogEvent.mock.calls[0];
    expect(eventType).toBe("search_performed");
    expect(payload).toMatchObject({
      query: "hound",
      window_size_ratio: 1.3,
      step_size: 1,
      dissimilarity_threshold: 0.5,
      top_k: 10,
      result_count: 1,
      error: false,
    });
    expect(typeof payload?.latency_ms).toBe("number");
  });

  //Test: a failed search logs search_performed with error:true and result_count 0
  it("logs a search_performed event with error true on failure", async () => {
    mockedSearch.mockRejectedValue(new Error("network down"));
    useSearchStore.getState().setQuery("hound");

    await useSearchStore.getState().runSearch(42, "doc-tei-42");

    expect(mockedLogEvent).toHaveBeenCalledOnce();
    const [eventType, payload] = mockedLogEvent.mock.calls[0];
    expect(eventType).toBe("search_performed");
    expect(payload).toMatchObject({
      result_count: 0,
      error: true,
    });
  });

  //Test: a blank query skips the search entirely, so nothing is logged
  it("does not log search_performed when the query is blank", async () => {
    useSearchStore.getState().setQuery("   ");
    await useSearchStore.getState().runSearch(42, "doc-tei-42");
    expect(mockedLogEvent).not.toHaveBeenCalled();
  });

  //Test: a search bar search is tagged as typed
  it("tags a search bar search as query_origin typed", async () => {
    mockedSearch.mockResolvedValue([]);
    useSearchStore.getState().setQuery("hound");

    await useSearchStore.getState().runSearch(42, "doc-tei-42");

    expect(mockedLogEvent.mock.calls[0][1]).toMatchObject({
      query_origin: "typed",
    });
  });

  //Test: a typed search excludes nothing, so the field is present but null
  it("logs excluded_doc_id null for a search bar search", async () => {
    mockedSearch.mockResolvedValue([]);
    useSearchStore.getState().setQuery("hound");

    await useSearchStore.getState().runSearch(42, "doc-tei-42");

    expect(mockedLogEvent.mock.calls[0][1]).toMatchObject({
      excluded_doc_id: null,
    });
  });
});

//A selection-originated search runs the selected text WITHOUT going through the
//search bar's query state (ADR-0008), so it needs its own query per call.
describe("searchStore.runSearch from a selection", () => {
  it("searches the selected text and leaves the search bar's query untouched", async () => {
    mockedSearch.mockResolvedValue([sampleResult]);
    useSearchStore.getState().setQuery("typed text");

    await useSearchStore
      .getState()
      .runSearch(42, "doc-tei-42", {
        query: "selected text",
        origin: "selection",
      });

    expect(mockedSearch).toHaveBeenCalledWith(
      expect.objectContaining({ query: "selected text" }),
    );
    expect(useSearchStore.getState().query).toBe("typed text");
  });

  it("tags the logged event as query_origin selection", async () => {
    mockedSearch.mockResolvedValue([]);

    await useSearchStore
      .getState()
      .runSearch(42, "doc-tei-42", {
        query: "selected text",
        origin: "selection",
      });

    expect(mockedLogEvent.mock.calls[0][1]).toMatchObject({
      query: "selected text",
      query_origin: "selection",
    });
  });

  //Test: a whitespace-only selection is not a query, even though the search bar has one
  it("skips the API call when the selected text is blank", async () => {
    useSearchStore.getState().setQuery("hound");

    await useSearchStore
      .getState()
      .runSearch(42, "doc-tei-42", { query: "  ", origin: "selection" });

    expect(mockedSearch).not.toHaveBeenCalled();
  });

  //Test: the excluded source document is named on every event the search emits
  it("logs the excluded document's id on each searched document's event", async () => {
    mockedSearch.mockResolvedValue([]);

    await useSearchStore.getState().runSearch(42, "doc-tei-42", {
      query: "selected text",
      origin: "selection",
      excludedDocId: "doc-tei-7",
    });

    expect(mockedLogEvent.mock.calls[0][1]).toMatchObject({
      excluded_doc_id: "doc-tei-7",
    });
  });
});

//The source document is skipped rather than searched, so its previous results
//have to be dropped explicitly — otherwise the column keeps showing hits from
//an earlier, unrelated search instead of "not searched this time".
describe("searchStore.clearDocumentResults", () => {
  it("drops the document's results, active index, and error state", () => {
    useSearchStore.setState({
      resultsByDocument: { "doc-tei-1": [sampleResult], "doc-tei-2": [sampleResult] },
      activeResultIndexByDocument: { "doc-tei-1": 3, "doc-tei-2": 2 },
      searchErrorByDocument: { "doc-tei-1": true, "doc-tei-2": true },
    });

    useSearchStore.getState().clearDocumentResults("doc-tei-1");

    const state = useSearchStore.getState();
    expect(state.resultsByDocument["doc-tei-1"]).toBeUndefined();
    expect(state.activeResultIndexByDocument["doc-tei-1"]).toBeUndefined();
    expect(state.searchErrorByDocument["doc-tei-1"]).toBeUndefined();
  });

  //Test: clearing one column must not disturb the columns that were searched
  it("leaves the other documents' results alone", () => {
    useSearchStore.setState({
      resultsByDocument: { "doc-tei-1": [sampleResult], "doc-tei-2": [sampleResult] },
      activeResultIndexByDocument: { "doc-tei-2": 2 },
      searchErrorByDocument: { "doc-tei-2": true },
    });

    useSearchStore.getState().clearDocumentResults("doc-tei-1");

    const state = useSearchStore.getState();
    expect(state.resultsByDocument["doc-tei-2"]).toEqual([sampleResult]);
    expect(state.activeResultIndexByDocument["doc-tei-2"]).toBe(2);
    expect(state.searchErrorByDocument["doc-tei-2"]).toBe(true);
  });
});

describe("searchStore search_param_changed logging", () => {
  beforeEach(() => {
    useSearchStore.setState({
      matchLength: 130,
      precision: 1,
      dissimilarityScore: 0.5,
      topK: 10,
    });
  });

  //Test: each setter logs one search_param_changed event with param/from/to
  it("logs search_param_changed with param, from, and to for each setter", () => {
    const { setMatchLength, setPrecision, setDissimilarityScore, setTopK } =
      useSearchStore.getState();

    setMatchLength(150);
    setPrecision(2);
    setDissimilarityScore(0.7);
    setTopK(20);

    expect(mockedLogEvent).toHaveBeenCalledTimes(4);
    expect(mockedLogEvent).toHaveBeenNthCalledWith(1, "search_param_changed", {
      param: "match_length",
      from: 130,
      to: 150,
    });
    expect(mockedLogEvent).toHaveBeenNthCalledWith(2, "search_param_changed", {
      param: "precision",
      from: 1,
      to: 2,
    });
    expect(mockedLogEvent).toHaveBeenNthCalledWith(3, "search_param_changed", {
      param: "dissimilarity_score",
      from: 0.5,
      to: 0.7,
    });
    expect(mockedLogEvent).toHaveBeenNthCalledWith(4, "search_param_changed", {
      param: "top_k",
      from: 10,
      to: 20,
    });
  });

  //Test: setting a parameter to its current value is not a change, so nothing is logged
  it("does not log search_param_changed when the value is unchanged", () => {
    useSearchStore.getState().setMatchLength(130);
    expect(mockedLogEvent).not.toHaveBeenCalled();
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

  //Test: moving next/prev logs one result_navigated event with action/from_index/to_index
  it("logs result_navigated on next and prev", () => {
    const { nextResult, prevResult } = useSearchStore.getState();

    nextResult("doc-1");
    expect(mockedLogEvent).toHaveBeenNthCalledWith(1, "result_navigated", {
      action: "next",
      from_index: 0,
      to_index: 1,
    });

    prevResult("doc-1");
    expect(mockedLogEvent).toHaveBeenNthCalledWith(2, "result_navigated", {
      action: "prev",
      from_index: 1,
      to_index: 0,
    });
  });

  //Test: a no-op nav (already at the boundary) logs nothing
  it("does not log result_navigated when next/prev is a no-op at the boundary", () => {
    const { nextResult, prevResult } = useSearchStore.getState();

    useSearchStore.setState({ activeResultIndexByDocument: { "doc-1": 2 } });
    nextResult("doc-1");
    expect(mockedLogEvent).not.toHaveBeenCalled();

    useSearchStore.setState({ activeResultIndexByDocument: { "doc-1": 0 } });
    prevResult("doc-1");
    expect(mockedLogEvent).not.toHaveBeenCalled();
  });
});

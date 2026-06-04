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
        isSearching: false,
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
        expect(state.isSearching).toBe(false);
        expect(mockedSearch).toHaveBeenCalledOnce();
    });

    //Test: when the query is blank
    it("skips the API call when the query is blank", async () => {
        useSearchStore.getState().setQuery("   ");
        await useSearchStore.getState().runSearch(42, "doc-tei-42");
        expect(mockedSearch).not.toHaveBeenCalled();
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
        expect(useSearchStore.getState().activeResultIndexByDocument["doc-1"]).toBe(2);

        useSearchStore.getState().setActiveResultIndex("doc-1", -5);
        expect(useSearchStore.getState().activeResultIndexByDocument["doc-1"]).toBe(0);
    });

    //Test: if at the last result, nextResult is still the last result
    //Test: if at the first result, prevResult is still the first result
    it("nextResult stops at the last result, prevResult stops at the first", () => {
        const { nextResult, prevResult } = useSearchStore.getState();

        useSearchStore.setState({ activeResultIndexByDocument: { "doc-1": 2 } });
        nextResult("doc-1");
        expect(useSearchStore.getState().activeResultIndexByDocument["doc-1"]).toBe(2);

        useSearchStore.setState({ activeResultIndexByDocument: { "doc-1": 0 } });
        prevResult("doc-1");
        expect(useSearchStore.getState().activeResultIndexByDocument["doc-1"]).toBe(0);
    });
});
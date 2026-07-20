import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import DocumentArea from "./DocumentArea";
import {
    computeDragEndReorder,
    DRAG_REORDER_HINT_DISMISSED_KEY,
} from "./dragReorderHint";
import { useDocumentStore } from "../../store/documentStore";
import { useSearchStore } from "../../store/searchStore";
import { searchDocument } from "../../api/search";
import type { SearchResult } from "../../types/search";
import type { Document } from "../../types/document";
import type { TEIDoc, TEINode } from "../../types/tei";

vi.mock("../../api/search", () => ({ searchDocument: vi.fn() }));
const mockedSearch = vi.mocked(searchDocument);

const doc: Document = {
    id: "doc-1",
    title: "Acallam",
    format: "txt",
    content: "the hound of culann hunts",
};

const result: SearchResult = {
    score: 0.1,
    snippet: "the hound of culann",
    word_start: 0,
    word_end: 4,
    anchor_id: null,
    anchor_tag: null,
    line_no: null,
};

// A one-paragraph TEI doc. Pre-order DFS ids: body=0, p=1 — so the <p> the two
// words live in renders with data-tei-anchor-id="1", matching word_array.a=1.
function twoWordTei(id: number, w0: string, w1: string): TEIDoc {
    const parsed_json: TEINode = {
        tag: "body",
        children: [
            {
                tag: "p",
                children: [
                    {
                        type: "text",
                        segments: [
                            { kind: "word", text: w0, idx: 0 },
                            { kind: "sep", text: " " },
                            { kind: "word", text: w1, idx: 1 },
                        ],
                    },
                ],
            },
        ],
    };
    return {
        id,
        title: `tei-${id}`,
        language: "ga",
        parsed_json,
        created_at: "",
        meta: { title: "", author: "", language: "", pbCount: 0 },
        anchors: [
            {
                id: 1,
                tag: "p",
                word_char_offsets: [
                    [0, 0, w0.length],
                    [1, w0.length + 1, w0.length + 1 + w1.length],
                ],
            },
        ],
        word_array: [
            { w: w0, a: 1, sep: " " },
            { w: w1, a: 1, sep: "" },
        ],
    };
}
const teiDocA: Document = { id: "doc-a", title: "A", format: "tei", content: twoWordTei(1, "hello", "world") };
const teiDocB: Document = { id: "doc-b", title: "B", format: "tei", content: twoWordTei(2, "foo", "bar") };
const span = (word_start: number, word_end: number): SearchResult => ({
    score: 0.1,
    snippet: "",
    word_start,
    word_end,
    anchor_id: 1, // the <p> anchor — scrollToResult scrolls to it (scrollIntoView)
    anchor_tag: "p",
    line_no: null,
});

const doc2: Document = {
    id: "doc-2",
    title: "Cattle Raid",
    format: "txt",
    content: "the morrigan watches",
};

beforeEach(() => {
    mockedSearch.mockReset();
    localStorage.clear();
    useDocumentStore.setState({
        openDocuments: [doc],
        visibleDocumentIds: ["doc-1"],
        activeDocumentId: "doc-1",
    });
    useSearchStore.setState({
        query: "",
        resultsByDocument: {},
        activeResultIndexByDocument: {},
        isSearchingByDocument: {},
        searchErrorByDocument: {},
    });
});

describe("DocumentArea search flow", () => {
    it("renders the result snippet after a search resolves", async () => {
        mockedSearch.mockResolvedValue([result]);
        render(<DocumentArea />);

        // Before searching, the column shows the empty state.
        expect(screen.getByText("No search results")).toBeInTheDocument();

        //"act" means there will be updates to the DOM, so we need to wait for the next tick
        await act(async () => {
            useSearchStore.getState().setQuery("hound");
            await useSearchStore.getState().runSearch(1, "doc-1");
        });

        expect(screen.getByText("the hound of culann")).toBeInTheDocument();
        expect(screen.getByText("Result 1 / 1")).toBeInTheDocument();
        expect(mockedSearch).toHaveBeenCalledOnce();
    });

    it("shows Searching… and hides Jump/←/→ even when stale results exist", () => {
        // a column mid-search: it still has old results in the store, but the
        // searching flag must take precedence over rendering them.
        useSearchStore.setState({
            resultsByDocument: { "doc-1": [result] },
            activeResultIndexByDocument: { "doc-1": 0 },
            isSearchingByDocument: { "doc-1": true },
        });

        render(<DocumentArea />);

        expect(screen.getByText("Searching…")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Jump" })).not.toBeInTheDocument();
        expect(screen.queryByText(result.snippet)).not.toBeInTheDocument();
    });

    it("shows Search failed — retry when the column's search errored", () => {
        useSearchStore.setState({
            searchErrorByDocument: { "doc-1": true },
        });

        render(<DocumentArea />);

        expect(screen.getByText("Search failed — retry")).toBeInTheDocument();
        expect(screen.queryByText("No search results")).not.toBeInTheDocument();
    });

    it("renders columns independently: one Searching… while another shows its result", () => {
        const doc2: Document = {
            id: "doc-2",
            title: "Cattle Raid",
            format: "txt",
            content: "the morrigan watches",
        };
        useDocumentStore.setState({
            openDocuments: [doc, doc2],
            visibleDocumentIds: ["doc-1", "doc-2"],
            activeDocumentId: "doc-1",
        });
        useSearchStore.setState({
            isSearchingByDocument: { "doc-1": true }, // doc-1 still loading
            resultsByDocument: { "doc-2": [result] }, // doc-2 already resolved
            activeResultIndexByDocument: { "doc-2": 0 },
        });

        render(<DocumentArea />);

        // both states are visible at the same time, each in its own column
        expect(screen.getByText("Searching…")).toBeInTheDocument();
        expect(screen.getByText(result.snippet)).toBeInTheDocument();
        expect(screen.getByText("Result 1 / 1")).toBeInTheDocument();
    });

    it("highlights all columns at once and navigation never clears another column's highlights", () => {
        useDocumentStore.setState({
            openDocuments: [teiDocA, teiDocB],
            visibleDocumentIds: ["doc-a", "doc-b"],
            activeDocumentId: "doc-a",
        });
        useSearchStore.setState({
            resultsByDocument: { "doc-a": [span(0, 1), span(1, 2)], "doc-b": [span(0, 1)] },
            activeResultIndexByDocument: { "doc-a": 0, "doc-b": 0 },
        });

        render(<DocumentArea />);

        const match = () => [...(CSS.highlights.get("search-match") ?? [])].map((r) => r.toString()).sort();
        const active = () => [...(CSS.highlights.get("search-match-active") ?? [])].map((r) => r.toString()).sort();

        // each column's CURRENT result is highlighted (orange) — both columns at once
        expect(active()).toEqual(["foo", "hello"]);
        expect(match()).toEqual([]); // the all-matches highlight is gone

        // navigate column A forward (→)
        fireEvent.click(screen.getAllByRole("button", { name: "→" })[0]);

        // A's current moved hello -> world; B's "foo" highlight is untouched
        expect(active()).toEqual(["foo", "world"]);
        expect(match()).toEqual([]);
    });
});

describe("drag-handle icon", () => {
    it("shows the grip icon and never the old dropdown chevron", () => {
        render(<DocumentArea />);

        expect(screen.getByText("⋮⋮")).toBeInTheDocument();
        expect(screen.queryByText(/▾/)).not.toBeInTheDocument();
    });
});

describe("drag-reorder discovery hint", () => {
    it("stays hidden while only one column is visible", () => {
        render(<DocumentArea />);

        expect(screen.queryByText("Drag to reorder columns")).not.toBeInTheDocument();
    });

    it("appears the first time a second column becomes visible, anchored to that column", () => {
        render(<DocumentArea />);

        act(() => {
            useDocumentStore.setState({
                openDocuments: [doc, doc2],
                visibleDocumentIds: ["doc-1", "doc-2"],
            });
        });

        const hint = screen.getByText("Drag to reorder columns");
        expect(hint).toBeInTheDocument();
        // anchored under doc-2's column, not doc-1's
        expect(
            screen.getByText("Cattle Raid").closest("article")?.contains(hint),
        ).toBe(true);
    });

    it("does not reappear on a later 1->2 transition once dismissed via ✕, and records the dismissal", () => {
        render(<DocumentArea />);

        act(() => {
            useDocumentStore.setState({
                openDocuments: [doc, doc2],
                visibleDocumentIds: ["doc-1", "doc-2"],
            });
        });
        fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));

        expect(screen.queryByText("Drag to reorder columns")).not.toBeInTheDocument();
        expect(localStorage.getItem(DRAG_REORDER_HINT_DISMISSED_KEY)).toBe("1");

        // drop back to one column, then back up to two — still shouldn't reappear
        act(() => {
            useDocumentStore.setState({
                openDocuments: [doc],
                visibleDocumentIds: ["doc-1"],
            });
        });
        act(() => {
            useDocumentStore.setState({
                openDocuments: [doc, doc2],
                visibleDocumentIds: ["doc-1", "doc-2"],
            });
        });
        expect(screen.queryByText("Drag to reorder columns")).not.toBeInTheDocument();
    });

    it("never shows if a past session already recorded the dismissal", () => {
        localStorage.setItem(DRAG_REORDER_HINT_DISMISSED_KEY, "1");
        render(<DocumentArea />);

        act(() => {
            useDocumentStore.setState({
                openDocuments: [doc, doc2],
                visibleDocumentIds: ["doc-1", "doc-2"],
            });
        });

        expect(screen.queryByText("Drag to reorder columns")).not.toBeInTheDocument();
    });
});

describe("computeDragEndReorder", () => {
    it("returns the reordered id list when dropped on a different column", () => {
        const result = computeDragEndReorder(
            { active: { id: "doc-1" }, over: { id: "doc-2" } } as never,
            ["doc-1", "doc-2", "doc-3"],
        );

        expect(result).toEqual(["doc-2", "doc-1", "doc-3"]);
    });

    it("returns null when dropped on itself or outside any droppable", () => {
        expect(
            computeDragEndReorder(
                { active: { id: "doc-1" }, over: { id: "doc-1" } } as never,
                ["doc-1", "doc-2"],
            ),
        ).toBeNull();
        expect(
            computeDragEndReorder(
                { active: { id: "doc-1" }, over: null } as never,
                ["doc-1", "doc-2"],
            ),
        ).toBeNull();
    });
});

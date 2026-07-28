import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import DocumentArea from "./DocumentArea";
import {
    computeDragEndReorder,
    DRAG_REORDER_HINT_DISMISSED_KEY,
} from "./dragReorderHint";
import { useDocumentStore } from "../../store/documentStore";
import { useSearchStore } from "../../store/searchStore";
import { useWorkspaceStore } from "../../store/workspaceStore";
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
        lastAttemptByDocument: {},
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

    it("shows Searching… and hides ←/→ even when stale results exist", () => {
        // a column mid-search: it still has old results in the store, but the
        // searching flag must take precedence over rendering them.
        useSearchStore.setState({
            resultsByDocument: { "doc-1": [result] },
            activeResultIndexByDocument: { "doc-1": 0 },
            isSearchingByDocument: { "doc-1": true },
        });

        render(<DocumentArea />);

        expect(screen.getByText("Searching…")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "←" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "→" })).not.toBeInTheDocument();
        expect(screen.queryByText(result.snippet)).not.toBeInTheDocument();
    });

    it("shows Search failed and a Retry button when the column's search errored", () => {
        useSearchStore.setState({
            searchErrorByDocument: { "doc-1": true },
        });

        render(<DocumentArea />);

        expect(screen.getByText("Search failed")).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "Retry search in Acallam" }),
        ).toBeInTheDocument();
        expect(screen.queryByText("No search results")).not.toBeInTheDocument();
    });

    //Test (#133): the nav row is ←/→ only. Jump was redundant — the text already
    //scrolls to the active match on arrival and on every arrow step.
    it("navigates results with ←/→ alone, without a Jump button", () => {
        useSearchStore.setState({
            resultsByDocument: { "doc-1": [result] },
            activeResultIndexByDocument: { "doc-1": 0 },
        });

        render(<DocumentArea />);

        expect(screen.getByRole("button", { name: "←" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "→" })).toBeInTheDocument();
        expect(
            screen.queryByRole("button", { name: "Jump" }),
        ).not.toBeInTheDocument();
    });

    //Test: the retry affordance belongs to the failure state alone — the empty,
    //loading and results states each have their own controls.
    it("offers no Retry button unless the column errored", () => {
        useSearchStore.setState({
            resultsByDocument: { "doc-1": [result] },
        });

        render(<DocumentArea />);

        expect(
            screen.queryByRole("button", { name: /^Retry search/ }),
        ).not.toBeInTheDocument();
    });

    //Test: one click, one search, on that column only
    it("re-runs only the failed column's search when Retry is clicked", async () => {
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
        mockedSearch.mockRejectedValueOnce(new Error("network down"));
        await act(async () => {
            useSearchStore.getState().setQuery("hound");
            await useSearchStore.getState().runSearch(1, "doc-1");
        });
        useSearchStore.setState({ resultsByDocument: { "doc-2": [result] } });
        mockedSearch.mockReset();
        mockedSearch.mockResolvedValue([result]);

        render(<DocumentArea />);
        await act(async () => {
            fireEvent.click(
                screen.getByRole("button", { name: "Retry search in Acallam" }),
            );
        });

        expect(mockedSearch).toHaveBeenCalledOnce();
        expect(mockedSearch).toHaveBeenCalledWith(
            expect.objectContaining({ docId: 1, query: "hound" }),
        );
        const state = useSearchStore.getState();
        expect(state.searchErrorByDocument["doc-1"]).toBe(false);
        expect(state.isSearchingByDocument["doc-2"]).toBeUndefined();
        expect(state.resultsByDocument["doc-2"]).toEqual([result]);
    });

    //Test: a selection search's query lives nowhere but the recorded attempt
    //(ADR-0008), so retrying one must not fall back to the search bar.
    it("retries a failed selection search with the selected text", async () => {
        mockedSearch.mockRejectedValueOnce(new Error("network down"));
        await act(async () => {
            useSearchStore.getState().setQuery("search bar text");
            await useSearchStore.getState().runSearch(1, "doc-1", {
                query: "selected text",
                origin: "selection",
            });
        });
        mockedSearch.mockReset();
        mockedSearch.mockResolvedValue([]);

        render(<DocumentArea />);
        await act(async () => {
            fireEvent.click(
                screen.getByRole("button", { name: "Retry search in Acallam" }),
            );
        });

        expect(mockedSearch).toHaveBeenCalledWith(
            expect.objectContaining({ query: "selected text" }),
        );
    });

    //Test: the column swaps its failure state for its loading state, which is
    //what takes the button away — a second click has nothing to hit.
    it("replaces the Retry button with the loading state while the retry is in flight", async () => {
        mockedSearch.mockRejectedValueOnce(new Error("network down"));
        await act(async () => {
            useSearchStore.getState().setQuery("hound");
            await useSearchStore.getState().runSearch(1, "doc-1");
        });
        mockedSearch.mockReset();
        mockedSearch.mockReturnValue(new Promise<SearchResult[]>(() => {}));

        render(<DocumentArea />);
        await act(async () => {
            fireEvent.click(
                screen.getByRole("button", { name: "Retry search in Acallam" }),
            );
        });

        expect(screen.getByText("Searching…")).toBeInTheDocument();
        expect(
            screen.queryByRole("button", { name: /^Retry search/ }),
        ).not.toBeInTheDocument();
        expect(mockedSearch).toHaveBeenCalledOnce();
    });

    //Test: TEI columns get a deterministic id from the document they show, so
    //a closed column's search state would otherwise be inherited by the next
    //column opened on the same document — handing it a Retry that re-runs a
    //query from before the close.
    it("clears the column's search state when it is closed", async () => {
        const confirmSpy = vi
            .spyOn(window, "confirm")
            .mockReturnValue(true);
        mockedSearch.mockRejectedValueOnce(new Error("network down"));
        await act(async () => {
            useSearchStore.getState().setQuery("hound");
            await useSearchStore.getState().runSearch(1, "doc-1");
        });

        render(<DocumentArea />);
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "✕" }));
        });

        const state = useSearchStore.getState();
        expect(state.searchErrorByDocument["doc-1"]).toBeUndefined();
        expect(state.lastAttemptByDocument["doc-1"]).toBeUndefined();
        expect(state.resultsByDocument["doc-1"]).toBeUndefined();
        confirmSpy.mockRestore();
    });

    //Test: a failure that repeats leaves the user with the same way out
    it("keeps the Retry button available when the retry fails too", async () => {
        mockedSearch.mockRejectedValue(new Error("network down"));
        await act(async () => {
            useSearchStore.getState().setQuery("hound");
            await useSearchStore.getState().runSearch(1, "doc-1");
        });

        render(<DocumentArea />);
        await act(async () => {
            fireEvent.click(
                screen.getByRole("button", { name: "Retry search in Acallam" }),
            );
        });

        expect(
            screen.getByRole("button", { name: "Retry search in Acallam" }),
        ).toBeInTheDocument();
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

/**
 * #147 — the Tag Filter's per-column navigation.
 *
 * Each visible column finds its own occurrences of the selected entity and
 * navigates them alone, so a person named 12 times in one manuscript and 111
 * times in another is two independent readings of the same selection.
 */
describe("Tag Filter entity navigation", () => {
    // Two manuscripts sharing one authority list — the same xml:ids across
    // files, which is what makes a single selection resolve in both columns.
    function authorityTei(id: number, refs: string[]): TEIDoc {
        const parsed_json: TEINode = {
            tag: "TEI",
            children: [
                {
                    tag: "standOff",
                    children: [
                        {
                            tag: "listPerson",
                            children: [
                                {
                                    tag: "person",
                                    attrs: { id: "fionn" },
                                    children: [
                                        {
                                            tag: "persName",
                                            attrs: { type: "canonical" },
                                            children: [{
                                                type: "text",
                                                segments: [{ kind: "word", text: "Find mac Cumaill", idx: 0 }],
                                            }],
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
                {
                    tag: "text",
                    children: [{
                        tag: "body",
                        children: refs.map((spelling) => ({
                            tag: "persName",
                            attrs: { ref: "#fionn" },
                            children: [{
                                type: "text",
                                segments: [{ kind: "word", text: spelling, idx: 0 }],
                            }],
                        })),
                    }],
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
            anchors: [],
            word_array: [],
        };
    }

    const withAuthorityA: Document = {
        id: "doc-a", title: "G 126", format: "tei",
        content: authorityTei(1, ["Find", "Ḟinn"]),
    };
    const withAuthorityB: Document = {
        id: "doc-b", title: "Franciscan A 4", format: "tei",
        content: authorityTei(2, ["Fionn", "Fhionn", "Finn"]),
    };
    // shakespear.xml's shape: named entities, no authority list, no pointers
    const noAuthority: Document = {
        id: "doc-c", title: "Shakespeare", format: "tei",
        content: twoWordTei(3, "hello", "world"),
    };

    function show(...docs: Document[]) {
        useDocumentStore.setState({
            openDocuments: docs,
            visibleDocumentIds: docs.map((d) => d.id),
            activeDocumentId: docs[0]?.id ?? null,
        });
    }

    beforeEach(() => {
        useWorkspaceStore.setState({
            selectedEntityId: null,
            entityIndexByDocument: {},
        });
    });

    it("shows no navigation card until an entity is selected", () => {
        show(withAuthorityA);
        render(<DocumentArea />);

        expect(screen.queryByText("Find mac Cumaill")).not.toBeInTheDocument();
    });

    //Test: each column counts its own occurrences of the same person
    it("gives each column its own count of the selected entity", () => {
        show(withAuthorityA, withAuthorityB);
        render(<DocumentArea />);

        act(() => useWorkspaceStore.getState().setSelectedEntityId("fionn"));

        expect(screen.getByText("1 / 2")).toBeInTheDocument();
        expect(screen.getByText("1 / 3")).toBeInTheDocument();
    });

    //Test: → moves this column alone, and never the other
    it("navigates one column's occurrences without moving another's", () => {
        show(withAuthorityA, withAuthorityB);
        render(<DocumentArea />);
        act(() => useWorkspaceStore.getState().setSelectedEntityId("fionn"));

        fireEvent.click(screen.getAllByLabelText("Next occurrence")[0]);

        expect(screen.getByText("2 / 2")).toBeInTheDocument();
        expect(screen.getByText("1 / 3")).toBeInTheDocument();
    });

    //Test: a document with no authority list degrades to no card and no error
    it("shows no card for a column whose document has no authority list", () => {
        show(withAuthorityA, noAuthority);
        render(<DocumentArea />);

        act(() => useWorkspaceStore.getState().setSelectedEntityId("fionn"));

        expect(screen.getAllByLabelText("Next occurrence")).toHaveLength(1);
    });

    //Test: every spelling of one person highlights, the current one apart from
    //the rest, and no other named entity is touched
    it("paints the current occurrence and its siblings in separate tiers", () => {
        show(withAuthorityA);
        render(<DocumentArea />);

        act(() => useWorkspaceStore.getState().setSelectedEntityId("fionn"));

        const painted = (name: string) =>
            [...(CSS.highlights.get(name) ?? [])].map((r) => r.toString());
        expect(painted("tag-entity-active")).toEqual(["Find"]);
        expect(painted("tag-entity-other")).toEqual(["Ḟinn"]);
    });

    //Test: the two features share the screen — neither repaint clears the other
    it("keeps the search highlight while an entity is selected", async () => {
        show(teiDocA);
        mockedSearch.mockResolvedValue([span(0, 1)]);
        render(<DocumentArea />);
        await act(async () => {
            useSearchStore.getState().setQuery("hello");
            await useSearchStore.getState().runSearch(1, "doc-a");
        });

        act(() => useWorkspaceStore.getState().setSelectedEntityId("fionn"));

        expect([...(CSS.highlights.get("search-match-active") ?? [])]
            .map((r) => r.toString())).toEqual(["hello"]);
    });
});

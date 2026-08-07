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
import { COLUMN_MIN_WIDTH_PX } from "../responsive";
import { searchDocument } from "../../api/search";
import type { SearchResult } from "../../types/search";
import type { Document } from "../../types/document";
import type { TEIDoc, TEINode } from "../../types/tei";
import type { EntityMenuEntry } from "../../tei/entityMenu";

vi.mock("../../api/search", () => ({ searchDocument: vi.fn() }));
const mockedSearch = vi.mocked(searchDocument);

// The Tag Filter's menu, mocked at the seam DocumentArea reads it from. The
// real hook offers nothing on the current corpus (#162); these tests are about
// what a column does with a menu, not about where the menu comes from. The
// default is the real hook's current answer, so every other test in this file
// sees exactly what the app sees.
const entityMenu = vi.hoisted(() => ({
    current: {
        entries: [] as EntityMenuEntry[],
        columnIndexById: new Map<string, number>(),
        columnsWithNameIndex: new Set<string>(),
    },
}));
vi.mock("../../tei/useEntityMenu", () => ({
    useEntityMenu: () => entityMenu.current,
}));

// The default column these tests search in. It is TEI because a search card is
// a TEI column's furniture: a Local Document is never searched, so it never
// shows one (#175).
const doc: Document = {
    id: "doc-1",
    title: "Acallam",
    format: "tei",
    content: twoWordTei(1, "hound", "culann"),
};

// A Local Document — a `.txt` a visitor opened from their own machine. Not
// searchable, and the workspace has to say so rather than let a column report
// on a search it never ran (#175).
const localDoc: Document = {
    id: "doc-local",
    title: "My Notes",
    format: "txt",
    content: "the hound of culann hunts",
};

// A hit in `doc`, anchored on the <p> it renders (word_array.a=1), so a column
// showing it scrolls the way the app does rather than down the no-anchor path.
const result: SearchResult = {
    score: 0.1,
    snippet: "the hound of culann",
    word_start: 0,
    word_end: 2,
    anchor_id: 1,
    anchor_tag: "p",
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
        work: null,
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
        name_index: null,
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
        useDocumentStore.setState({
            openDocuments: [doc, teiDocB],
            visibleDocumentIds: ["doc-1", "doc-b"],
            activeDocumentId: "doc-1",
        });
        useSearchStore.setState({
            isSearchingByDocument: { "doc-1": true }, // doc-1 still loading
            resultsByDocument: { "doc-b": [result] }, // doc-b already resolved
            activeResultIndexByDocument: { "doc-b": 0 },
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

// A shrunk window (or a split screen) is the case these cover: the columns
// hold a readable width and the strip scrolls, instead of every column
// shrinking until its own controls fall off the edge (#159, ADR-0019).
describe("narrow window: columns keep their width and the strip scrolls", () => {
    function openThreeColumns() {
        useDocumentStore.setState({
            openDocuments: [doc, doc2, teiDocA],
            visibleDocumentIds: ["doc-1", "doc-2", "doc-a"],
        });
    }

    it("floors every column at the readable minimum width", () => {
        openThreeColumns();
        render(<DocumentArea />);

        const columns = document.querySelectorAll<HTMLElement>(
            "[data-doc-column-id]",
        );
        expect(columns).toHaveLength(3);
        for (const column of columns) {
            expect(column.style.minWidth).toBe(`${COLUMN_MIN_WIDTH_PX}px`);
        }
    });

    // jsdom lays nothing out, so these three assert the rules the browser then
    // applies, not the widths it arrives at: the strip's overflow, and the
    // `shrink-0` on the two controls a squeezed column used to lose.
    it("wraps the columns in a strip that scrolls sideways and not down", () => {
        openThreeColumns();
        render(<DocumentArea />);

        const strip = document.querySelector<HTMLElement>("[data-column-strip]")!;
        expect(strip.className).toContain("overflow-x-auto");
        // Vertical overflow is pinned: each column scrolls its own text, so the
        // strip must never grow a second, outer vertical scrollbar.
        expect(strip.className).toContain("overflow-y-hidden");
    });

    it("exempts the close button from shrinking with its header", () => {
        openThreeColumns();
        render(<DocumentArea />);

        for (const close of screen.getAllByRole("button", { name: "✕" })) {
            expect(close.className).toContain("shrink-0");
        }
    });

    it("exempts the result card's prev/next arrows, truncating the metadata instead", () => {
        openThreeColumns();
        useSearchStore.setState({
            resultsByDocument: { "doc-1": [result] },
            activeResultIndexByDocument: { "doc-1": 0 },
        });
        render(<DocumentArea />);

        const nav = document.querySelector<HTMLElement>(
            '[data-tour="result-nav"]',
        )!;
        expect(nav.className).toContain("shrink-0");
        // The line/score metadata is what gives way. `truncate` has to sit on
        // the spans themselves — `text-overflow` does nothing to a box whose
        // children are flex items, and it is what lets them shrink at all.
        const metadata = [...nav.previousElementSibling!.children];
        expect(metadata).toHaveLength(2);
        for (const span of metadata) {
            expect(span.className).toContain("truncate");
        }
    });

    // The drag gesture itself needs layout, which jsdom has none of, so what is
    // pinned here is its outcome: the strip renders in the order a reorder
    // leaves behind. `computeDragEndReorder` covers the arithmetic below.
    it("renders the columns in the order a reorder leaves them in", () => {
        openThreeColumns();
        render(<DocumentArea />);

        act(() => {
            useDocumentStore
                .getState()
                .setVisibleDocumentIds(
                    computeDragEndReorder(
                        { active: { id: "doc-1" }, over: { id: "doc-2" } } as never,
                        useDocumentStore.getState().visibleDocumentIds,
                    )!,
                );
        });

        expect(
            [...document.querySelectorAll("[data-doc-column-id]")].map((c) =>
                c.getAttribute("data-doc-column-id"),
            ),
        ).toEqual(["doc-2", "doc-1", "doc-a"]);
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
 * #147, #162 — the Tag Filter's per-column navigation.
 *
 * Each visible column finds its own occurrences of the selected entity and
 * navigates them alone, so a person named 12 times in one manuscript and 111
 * times in another is two independent readings of the same selection.
 *
 * The menu is mocked here, and deliberately: on the current corpus the real one
 * is empty (#162), because the re-cut witnesses group their names by a
 * `@nymRef` id no file explains and the registry that resolves it is the next
 * slice. What these tests are about is the other half — given a menu and a
 * selection, does a column count, navigate and paint *its own* occurrences —
 * and that half is unchanged by where the entries came from. Mocking the seam
 * keeps it covered across the swap instead of dropping it and rediscovering it.
 *
 * The documents are not mocked. They carry the markup the shipped corpus
 * carries, so the selector that finds an occurrence is tested against the real
 * thing.
 */
describe("Tag Filter entity navigation", () => {
    // Two witnesses grouping their names the same way — the same `@nymRef`
    // across files, which is what makes a single selection resolve in both.
    function nymRefTei(id: number, spellings: string[]): TEIDoc {
        const parsed_json: TEINode = {
            tag: "TEI",
            children: [
                {
                    tag: "text",
                    children: [{
                        tag: "body",
                        children: spellings.map((spelling) => ({
                            tag: "name",
                            attrs: { type: "person", nymRef: "F64" },
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
            work: null,
            parsed_json,
            created_at: "",
            meta: { title: "", author: "", language: "", pbCount: 0 },
            anchors: [],
            word_array: [],
            name_index: null,
        };
    }

    const laud610: Document = {
        id: "doc-a", title: "Laud Misc. 610", format: "tei",
        content: nymRefTei(1, ["Find", "Ḟinn"]),
    };
    const lis204: Document = {
        id: "doc-b", title: "Book of Lismore", format: "tei",
        content: nymRefTei(2, ["Fionn", "Fhionn", "Finn"]),
    };
    // shakespear.xml's shape: text with no marked-up named entity in it at all
    const noEntities: Document = {
        id: "doc-c", title: "Shakespeare", format: "tei",
        content: twoWordTei(3, "hello", "world"),
    };

    // A manuscript that groups its names but never writes this one — the Táin
    // column has Cú Chulainn in it and no Find.
    const noFind: Document = {
        id: "doc-d", title: "Book of Leinster", format: "tei",
        content: twoWordTei(4, "Cú", "Chulainn"),
    };

    // What the registry slice will build: one entry for Find, carrying each
    // column's own count of him. Counts are per column of the menu, in the
    // order the columns were given to it — a column the menu does not cover is
    // simply absent, not a zero.
    //
    // A `null` count is the other silence: that column's document carries no
    // `@nymRef` at all, so it is not among the columns naming entities and has
    // no answer to give about anybody.
    function menuFor(...columns: [docId: string, count: number | null][]) {
        return {
            entries: [{
                id: "F64",
                kind: "person" as const,
                headword: "Find mac Cumaill",
                counts: columns.map(([, count]) => count ?? 0),
            }],
            columnIndexById: new Map(columns.map(([id], i) => [id, i])),
            columnsWithNameIndex: new Set(
                columns.filter(([, count]) => count !== null).map(([id]) => id),
            ),
        };
    }

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
        show(laud610);
        entityMenu.current = menuFor(["doc-a", 2]);
        render(<DocumentArea />);

        expect(screen.queryByText("Find mac Cumaill")).not.toBeInTheDocument();
    });

    //Test: each column counts its own occurrences of the same person, found by
    //the group id rather than by any one spelling of the name
    it("gives each column its own count of the selected entity", () => {
        show(laud610, lis204);
        entityMenu.current = menuFor(["doc-a", 2], ["doc-b", 3]);
        render(<DocumentArea />);

        act(() => useWorkspaceStore.getState().setSelectedEntityId("F64"));

        expect(screen.getByText("1 / 2")).toBeInTheDocument();
        expect(screen.getByText("1 / 3")).toBeInTheDocument();
    });

    //Test: → moves this column alone, and never the other
    it("navigates one column's occurrences without moving another's", () => {
        show(laud610, lis204);
        entityMenu.current = menuFor(["doc-a", 2], ["doc-b", 3]);
        render(<DocumentArea />);
        act(() => useWorkspaceStore.getState().setSelectedEntityId("F64"));

        fireEvent.click(screen.getAllByLabelText("Next occurrence")[0]);

        expect(screen.getByText("2 / 2")).toBeInTheDocument();
        expect(screen.getByText("1 / 3")).toBeInTheDocument();
    });

    //Test: a column the menu says nothing about degrades to no card and no
    //error — no fallback to matching by element name, which is #147's removal
    it("shows no card for a column the menu does not cover", () => {
        show(laud610, noEntities);
        entityMenu.current = menuFor(["doc-a", 2]);
        render(<DocumentArea />);

        act(() => useWorkspaceStore.getState().setSelectedEntityId("F64"));

        expect(screen.getAllByLabelText("Next occurrence")).toHaveLength(1);
    });

    //Test: a document with no `@nymRef` in it was never asked the question, so
    //it gets no card rather than a card saying nobody is in it
    it("shows no card for a column whose document declares no @nymRef", () => {
        show(laud610, noEntities);
        entityMenu.current = menuFor(["doc-a", 2], ["doc-c", null]);
        render(<DocumentArea />);

        act(() => useWorkspaceStore.getState().setSelectedEntityId("F64"));

        expect(screen.getAllByLabelText("Next occurrence")).toHaveLength(1);
    });

    //Test: a manuscript that groups names and never writes this one says so —
    //an absence a researcher comparing witnesses came to find, not a column
    //that quietly drops out of the comparison
    it("says a column names the entity nowhere, rather than dropping its card", () => {
        show(laud610, noFind);
        entityMenu.current = menuFor(["doc-a", 2], ["doc-d", 0]);
        render(<DocumentArea />);

        act(() => useWorkspaceStore.getState().setSelectedEntityId("F64"));

        expect(screen.getAllByText("Find mac Cumaill")).toHaveLength(2);
        expect(screen.getByText("none here")).toBeInTheDocument();
    });

    //Test: and offers no navigation there — there is nothing to step through
    it("disables the arrows on a column that never names the entity", () => {
        show(laud610, noFind);
        entityMenu.current = menuFor(["doc-a", 2], ["doc-d", 0]);
        render(<DocumentArea />);

        act(() => useWorkspaceStore.getState().setSelectedEntityId("F64"));

        expect(screen.getAllByLabelText("Next occurrence")[1]).toBeDisabled();
        expect(screen.getAllByLabelText("Previous occurrence")[1]).toBeDisabled();
    });

    //Test: a column with nothing to highlight is not dimmed either — greying
    //every other name out is what makes the followed one stand out, and there
    //is no followed one here
    it("leaves a column that never names the entity undimmed", () => {
        show(noFind);
        entityMenu.current = menuFor(["doc-d", 0]);
        const { container } = render(<DocumentArea />);

        act(() => useWorkspaceStore.getState().setSelectedEntityId("F64"));

        expect(container.querySelector("[data-entity-focus]")).toBeNull();
    });

    //Test: stepping a column brings the occurrence it landed on into view, in
    //that column — the spans are already rendered, so this is the whole of
    //"go to the next one"
    it("scrolls the column to the occurrence it steps onto", () => {
        show(laud610);
        entityMenu.current = menuFor(["doc-a", 2]);
        const scrollIntoView = vi.spyOn(Element.prototype, "scrollIntoView");
        render(<DocumentArea />);
        act(() => useWorkspaceStore.getState().setSelectedEntityId("F64"));

        fireEvent.click(screen.getByLabelText("Next occurrence"));

        const scrolledTo = scrollIntoView.mock.contexts.at(-1) as Element;
        expect(scrolledTo.textContent).toBe("Ḟinn");
        scrollIntoView.mockRestore();
    });

    //Test: every spelling of one person highlights, the current one apart from
    //the rest, and no other named entity is touched
    it("paints the current occurrence and its siblings in separate tiers", () => {
        show(laud610);
        entityMenu.current = menuFor(["doc-a", 2]);
        render(<DocumentArea />);

        act(() => useWorkspaceStore.getState().setSelectedEntityId("F64"));

        const painted = (name: string) =>
            [...(CSS.highlights.get(name) ?? [])].map((r) => r.toString());
        expect(painted("tag-entity-active")).toEqual(["Find"]);
        expect(painted("tag-entity-other")).toEqual(["Ḟinn"]);
    });

    //Test: the two features share the screen — neither repaint clears the other
    it("keeps the search highlight while an entity is selected", async () => {
        show(teiDocA);
        entityMenu.current = menuFor(["doc-a", 2]);
        mockedSearch.mockResolvedValue([span(0, 1)]);
        render(<DocumentArea />);
        await act(async () => {
            useSearchStore.getState().setQuery("hello");
            await useSearchStore.getState().runSearch(1, "doc-a");
        });

        act(() => useWorkspaceStore.getState().setSelectedEntityId("F64"));

        expect([...(CSS.highlights.get("search-match-active") ?? [])]
            .map((r) => r.toString())).toEqual(["hello"]);
    });
});

// The other two of the three places a Local Document's limit is stated (#175).
// Search runs against TEI only, so a `.txt`/`.docx` column is filtered out
// before the request is built — and a column that was never asked the question
// must not print an answer to it. This is the distinction #164 already settled
// on the entity side, applied to search.
describe("a Local Document says it is reading-only (#175)", () => {
    const READING_ONLY = "Reading only";

    function openLocalColumn() {
        useDocumentStore.setState({
            openDocuments: [localDoc],
            visibleDocumentIds: ["doc-local"],
            activeDocumentId: "doc-local",
        });
    }

    //Test: the chip is a property of the Document, true from the moment it
    //opens — before any search has been attempted.
    it("marks the column Reading only in its header, from the moment it opens", () => {
        openLocalColumn();
        render(<DocumentArea />);

        const chip = screen.getByText(READING_ONLY);
        expect(chip).toBeInTheDocument();
        expect(
            chip.closest("header")?.contains(screen.getByText("My Notes")),
        ).toBe(true);
    });

    //Test: the chip is the only thing the column says about itself, and at the
    //column's floor width its two words can clip — so it carries the whole
    //sentence, the way the truncating title button carries its own.
    it("explains itself in a tooltip that never calls the file an upload", () => {
        openLocalColumn();
        render(<DocumentArea />);

        const tooltip = screen.getByText(READING_ONLY).getAttribute("title")!;
        expect(tooltip).toMatch(/not searchable/i);
        expect(tooltip).toMatch(/stay in your browser/i);
        expect(tooltip).not.toMatch(/upload/i);
    });

    //Test: "No search results" is a claim about the file's text; the truth is
    //that the file was never searched. The column stays silent instead.
    it("renders no result card at all, not an empty one", () => {
        openLocalColumn();
        render(<DocumentArea />);

        expect(screen.queryByText("No search results")).not.toBeInTheDocument();
        expect(screen.queryByText("Searching…")).not.toBeInTheDocument();
        expect(screen.queryByText(/^Result \d/)).not.toBeInTheDocument();
    });

    //Test: a search the visitor runs from the toolbar reaches every TEI column
    //and skips this one — so the silence has to survive that search, not just
    //the state before it.
    it("keeps its silence while a search of the other columns is in flight", () => {
        useDocumentStore.setState({
            openDocuments: [localDoc, doc],
            visibleDocumentIds: ["doc-local", "doc-1"],
            activeDocumentId: "doc-1",
        });
        useSearchStore.setState({
            isSearchingByDocument: { "doc-1": true },
        });

        render(<DocumentArea />);

        const localColumn = screen.getByText("My Notes").closest("article")!;
        expect(localColumn.textContent).not.toMatch(/Searching|search results/i);
        // ...while the TEI column beside it reports on the search it is running
        expect(screen.getByText("Searching…")).toBeInTheDocument();
    });

    //Test: the chip belongs to the Local Document alone — a TEI column is
    //searchable and must not be labelled as if it were not.
    it("leaves a TEI column unmarked and keeps its result card", () => {
        useSearchStore.setState({
            resultsByDocument: { "doc-1": [result] },
            activeResultIndexByDocument: { "doc-1": 0 },
        });

        render(<DocumentArea />);

        expect(screen.queryByText(READING_ONLY)).not.toBeInTheDocument();
        expect(screen.getByText("Result 1 / 1")).toBeInTheDocument();
    });

    //Test: a Local Document is never uploaded and never stored (CONTEXT.md), so
    //nothing the column says may suggest the file left the machine.
    it("never calls the file an upload", () => {
        openLocalColumn();
        render(<DocumentArea />);

        expect(document.body.textContent).not.toMatch(/upload/i);
    });
});

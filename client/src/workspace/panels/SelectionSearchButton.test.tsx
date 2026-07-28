import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import SelectionSearchButton from "./SelectionSearchButton";
import { useDocumentStore } from "../../store/documentStore";
import { useSearchStore } from "../../store/searchStore";
import type { Document, DocumentId } from "../../types/document";
import type { SearchResult } from "../../types/search";
import type { TEIDoc } from "../../types/tei";

// stands in for whatever a column was showing before this selection search
const staleResult: SearchResult = {
  score: 0.12,
  snippet: "an older search's hit",
  word_start: 4,
  word_end: 8,
  anchor_id: 3,
  anchor_tag: "seg",
  line_no: "12",
};

function makeTEIDoc(id: number): TEIDoc {
  return {
    id,
    title: `Doc ${id}`,
    language: "ga",
    work: null,
    parsed_json: { tag: "body", children: [] },
    created_at: "",
    meta: { title: "", author: "", language: "", pbCount: 0 },
    anchors: [],
    word_array: [],
  };
}

const teiDocA: Document = {
  id: "doc-tei-1",
  title: "A",
  format: "tei",
  content: makeTEIDoc(1),
};
const teiDocB: Document = {
  id: "doc-tei-2",
  title: "B",
  format: "tei",
  content: makeTEIDoc(2),
};
const txtDoc: Document = {
  id: "doc-3",
  title: "C",
  format: "txt",
  content: "plain uploaded text",
};

// jsdom implements neither Range.getBoundingClientRect (the button positions
// itself against it) nor selectionchange dispatch, so both are supplied here.
// The rect is a let so a test can move the "text" the way scrolling would.
let selectionRect = { top: 10, left: 20, bottom: 30, right: 60 } as DOMRect;
const realRangeRect = Range.prototype.getBoundingClientRect;

beforeAll(() => {
  Range.prototype.getBoundingClientRect = () => selectionRect;
});
// leave the prototype as we found it — other suites share this worker
afterAll(() => {
  Range.prototype.getBoundingClientRect = realRangeRect;
});

// Stand in for the DOM the DocumentArea columns render.
function renderColumns() {
  const host = document.createElement("div");
  host.innerHTML = `
    <article data-doc-column-id="doc-tei-1">
      <div data-tei-content><p id="tei-a">the hound of culann</p></div>
    </article>
    <article data-doc-column-id="doc-tei-2">
      <div data-tei-content><p id="tei-b">a second passage</p></div>
    </article>
    <article data-doc-column-id="doc-3"><pre id="txt">plain text</pre></article>
  `;
  document.body.appendChild(host);
}

// Select an element's text the way a user dragging over it would, then let the
// listening component know — jsdom does not emit selectionchange on its own.
function selectText(id: string) {
  const range = document.createRange();
  range.selectNodeContents(document.getElementById(id)!);
  const selection = window.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
  fireEvent(document, new Event("selectionchange"));
}

function clearSelection() {
  window.getSelection()!.removeAllRanges();
  fireEvent(document, new Event("selectionchange"));
}

const runSearch = vi.fn();

beforeEach(() => {
  runSearch.mockReset();
  selectionRect = { top: 10, left: 20, bottom: 30, right: 60 } as DOMRect;
  document.body.innerHTML = "";
  CSS.highlights.get("query-source")?.clear();
  useDocumentStore.setState({
    openDocuments: [teiDocA, teiDocB, txtDoc],
    visibleDocumentIds: ["doc-tei-1", "doc-tei-2", "doc-3"],
    activeDocumentId: "doc-tei-1",
  });
  useSearchStore.setState({
    query: "typed in the bar",
    runSearch,
    resultsByDocument: {},
    activeResultIndexByDocument: {},
    isSearchingByDocument: {},
    searchErrorByDocument: {},
  });
  renderColumns();
});

// put the named columns into (or out of) a search, wherever it was fired from
function setSearchingColumns(isSearchingByDocument: Record<DocumentId, boolean>) {
  act(() => useSearchStore.setState({ isSearchingByDocument }));
}

const searchButton = () => screen.queryByRole("button", { name: /selected/i });

// the text the query-source highlight is currently painted over
const querySourceText = () =>
  [...(CSS.highlights.get("query-source") ?? [])].map((r) => r.toString());

describe("SelectionSearchButton", () => {
  it("appears when text is selected inside a TEI viewer", () => {
    render(<SelectionSearchButton />);
    expect(searchButton()).not.toBeInTheDocument();

    selectText("tei-a");

    expect(searchButton()).toBeInTheDocument();
  });

  it("stays away for a selection in a .txt column", () => {
    render(<SelectionSearchButton />);

    selectText("txt");

    expect(searchButton()).not.toBeInTheDocument();
  });

  it("keeps only one button when a second TEI viewer is selected in", () => {
    render(<SelectionSearchButton />);

    selectText("tei-a");
    selectText("tei-b");

    expect(screen.getAllByRole("button", { name: /selected/i })).toHaveLength(1);
  });

  it("goes away when the selection is cleared", () => {
    render(<SelectionSearchButton />);
    selectText("tei-a");

    clearSelection();

    expect(searchButton()).not.toBeInTheDocument();
  });

  it("searches the other visible TEI documents, never the one selected in", () => {
    render(<SelectionSearchButton />);
    selectText("tei-a");

    fireEvent.click(searchButton()!);

    expect(runSearch).toHaveBeenCalledOnce();
    expect(runSearch).toHaveBeenCalledWith(2, "doc-tei-2", {
      query: "the hound of culann",
      origin: "selection",
      excludedDocId: "doc-tei-1",
    });
  });

  //Test: the source column is skipped, not searched — so whatever it was showing
  //from an earlier search has to go, or it reads as a result of THIS search
  it("clears the source document's stale results instead of leaving them", () => {
    useSearchStore.setState({
      resultsByDocument: { "doc-tei-1": [staleResult], "doc-tei-2": [staleResult] },
      activeResultIndexByDocument: { "doc-tei-1": 1 },
      searchErrorByDocument: { "doc-tei-1": true },
    });
    render(<SelectionSearchButton />);
    selectText("tei-a");

    fireEvent.click(searchButton()!);

    const state = useSearchStore.getState();
    expect(state.resultsByDocument["doc-tei-1"]).toBeUndefined();
    expect(state.activeResultIndexByDocument["doc-tei-1"]).toBeUndefined();
    expect(state.searchErrorByDocument["doc-tei-1"]).toBeUndefined();
  });

  //Test: with the source document excluded there is nothing left to search, so
  //the button must not offer a search that would do nothing
  it("stays away when the source is the only visible TEI document", () => {
    useDocumentStore.setState({
      openDocuments: [teiDocA, teiDocB, txtDoc],
      visibleDocumentIds: ["doc-tei-1", "doc-3"],
      activeDocumentId: "doc-tei-1",
    });
    render(<SelectionSearchButton />);

    selectText("tei-a");

    expect(searchButton()).not.toBeInTheDocument();
  });

  it("leaves the search bar's query untouched (ADR-0008)", () => {
    render(<SelectionSearchButton />);
    selectText("tei-a");

    fireEvent.click(searchButton()!);

    expect(useSearchStore.getState().query).toBe("typed in the bar");
  });

  //Test: TEI text scrolls inside its own column, so a button pinned to viewport
  //coordinates has to be re-measured or it drifts away from the text
  it("follows the selected text when a column is scrolled", () => {
    render(<SelectionSearchButton />);
    selectText("tei-a");
    expect(searchButton()).toHaveStyle({ top: "36px" });

    selectionRect = { top: 60, left: 20, bottom: 80, right: 60 } as DOMRect;
    fireEvent.scroll(document.querySelector("[data-tei-content]")!);

    expect(searchButton()).toHaveStyle({ top: "86px" });
  });

  it("takes itself down once the search has been fired", () => {
    render(<SelectionSearchButton />);
    selectText("tei-a");

    fireEvent.click(searchButton()!);

    expect(searchButton()).not.toBeInTheDocument();
  });

  //Test: the results have to stay traceable to the text that drove them once the
  //native selection is gone, which is the whole point of the mark (#95)
  it("marks the text it searched with", () => {
    render(<SelectionSearchButton />);
    selectText("tei-a");

    fireEvent.click(searchButton()!);

    expect(querySourceText()).toEqual(["the hound of culann"]);
  });

  //Test: this button suppresses the collapse a click normally causes, so it has
  //to drop the selection itself — otherwise the native highlight stays painted
  //over the mark and the mark only surfaces on some later, unrelated click
  it("hands the text over from the native selection to the mark", () => {
    render(<SelectionSearchButton />);
    selectText("tei-a");

    fireEvent.click(searchButton()!);

    expect(window.getSelection()!.rangeCount).toBe(0);
    expect(querySourceText()).toEqual(["the hound of culann"]);
  });

  it("moves the mark to the new source when a second selection search fires", () => {
    render(<SelectionSearchButton />);
    selectText("tei-a");
    fireEvent.click(searchButton()!);

    selectText("tei-b");
    fireEvent.click(searchButton()!);

    expect(querySourceText()).toEqual(["a second passage"]);
  });

  //Test: a search already in flight owns the columns' state, so offering to fire
  //a second one over the top of it is the confusing window #96 closes
  it("stays away for a selection made while a search is in flight", () => {
    setSearchingColumns({ "doc-tei-2": true });
    render(<SelectionSearchButton />);

    selectText("tei-a");

    expect(searchButton()).not.toBeInTheDocument();
  });

  //Test: any column counts, not just the ones this button would have searched —
  //here it is the column the selection is in that is busy
  it("stays away while the selection's own column is searching", () => {
    setSearchingColumns({ "doc-tei-1": true });
    render(<SelectionSearchButton />);

    selectText("tei-a");

    expect(searchButton()).not.toBeInTheDocument();
  });

  //Test: a search fired from the tool bar starts while text is still selected —
  //the button standing over it would be that same second-search offer
  it("takes an already-shown button down when a search starts", () => {
    render(<SelectionSearchButton />);
    selectText("tei-a");
    expect(searchButton()).toBeInTheDocument();

    setSearchingColumns({ "doc-tei-2": true });

    expect(searchButton()).not.toBeInTheDocument();
  });

  it("comes back for a new selection once the search has finished", () => {
    setSearchingColumns({ "doc-tei-2": true });
    render(<SelectionSearchButton />);
    selectText("tei-a");

    setSearchingColumns({ "doc-tei-2": false });
    selectText("tei-a");

    expect(searchButton()).toBeInTheDocument();
  });

  //Test: the selection dropped while the search ran is stale by the time it ends
  //— it should stay silent until the user selects something again
  it("does not resurface a selection made during the search", () => {
    render(<SelectionSearchButton />);
    setSearchingColumns({ "doc-tei-2": true });
    selectText("tei-a");

    setSearchingColumns({ "doc-tei-2": false });

    expect(searchButton()).not.toBeInTheDocument();
  });

  //Test: nothing takes the button down when its source column closes, so the
  //click still lands — on a range that no longer points into the page
  it("survives a click after the source document has been closed", () => {
    render(<SelectionSearchButton />);
    selectText("tei-a");
    document.querySelector('[data-doc-column-id="doc-tei-1"]')!.remove();

    expect(() => fireEvent.click(searchButton()!)).not.toThrow();
    expect(querySourceText()).toEqual([]);
  });
});

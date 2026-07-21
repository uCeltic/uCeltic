import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import SelectionSearchButton from "./SelectionSearchButton";
import { useDocumentStore } from "../../store/documentStore";
import { useSearchStore } from "../../store/searchStore";
import type { Document } from "../../types/document";
import type { TEIDoc } from "../../types/tei";

function makeTEIDoc(id: number): TEIDoc {
  return {
    id,
    title: `Doc ${id}`,
    language: "ga",
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
  useDocumentStore.setState({
    openDocuments: [teiDocA, teiDocB, txtDoc],
    visibleDocumentIds: ["doc-tei-1", "doc-tei-2", "doc-3"],
    activeDocumentId: "doc-tei-1",
  });
  useSearchStore.setState({ query: "typed in the bar", runSearch });
  renderColumns();
});

const searchButton = () => screen.queryByRole("button", { name: /selected/i });

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

  it("searches every visible TEI document with the selected text", () => {
    render(<SelectionSearchButton />);
    selectText("tei-a");

    fireEvent.click(searchButton()!);

    expect(runSearch).toHaveBeenCalledTimes(2);
    expect(runSearch).toHaveBeenCalledWith(1, "doc-tei-1", {
      query: "the hound of culann",
      origin: "selection",
    });
    expect(runSearch).toHaveBeenCalledWith(2, "doc-tei-2", {
      query: "the hound of culann",
      origin: "selection",
    });
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
});

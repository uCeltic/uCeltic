import { beforeEach, describe, expect, it } from "vitest";
import { readTEISelection } from "./selection";

// Two document columns as DocumentArea renders them: the TEI one marks its
// rendered content with data-tei-content, the .txt one does not.
function renderColumns() {
  document.body.innerHTML = `
    <article data-doc-column-id="doc-tei-1">
      <div data-tei-content><p id="tei-text">the hound of culann</p></div>
    </article>
    <article data-doc-column-id="doc-tei-2">
      <div data-tei-content><p id="tei-text-2">a second passage</p></div>
    </article>
    <article data-doc-column-id="doc-2">
      <pre id="txt-text">plain uploaded text</pre>
    </article>
  `;
}

// Select the whole text of one element through the real Selection API.
function selectContentsOf(id: string): Selection {
  const el = document.getElementById(id)!;
  const range = document.createRange();
  range.selectNodeContents(el);
  const selection = window.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
  return selection;
}

beforeEach(renderColumns);

describe("readTEISelection", () => {
  it("reports the selected text and the TEI column it came from", () => {
    const result = readTEISelection(selectContentsOf("tei-text"));

    expect(result).toMatchObject({
      docId: "doc-tei-1",
      text: "the hound of culann",
    });
  });

  //Test: clicking anything (the search button included) collapses the native
  //selection, and browsers hand out a LIVE range that collapses with it. So what
  //is returned must be detached from the selection, or the text the search ran
  //on is lost the moment the search is fired. (jsdom's ranges do not go live, so
  //this asserts the independence itself rather than collapsing to observe it.)
  it("hands back a range snapshot, not the selection's live one", () => {
    const selection = selectContentsOf("tei-text");

    const result = readTEISelection(selection)!;

    expect(result.range).not.toBe(selection.getRangeAt(0));
    expect(result.range.toString()).toBe("the hound of culann");
  });

  it("ignores a selection in a non-TEI column", () => {
    expect(readTEISelection(selectContentsOf("txt-text"))).toBeNull();
  });

  it("ignores a collapsed selection", () => {
    const selection = selectContentsOf("tei-text");
    selection.collapseToStart();

    expect(readTEISelection(selection)).toBeNull();
  });

  it("ignores a whitespace-only selection", () => {
    document.getElementById("tei-text")!.textContent = "   ";

    expect(readTEISelection(selectContentsOf("tei-text"))).toBeNull();
  });

  it("returns null when there is no selection at all", () => {
    expect(readTEISelection(null)).toBeNull();
  });

  //Test: dragging past the edge of the text still selects that column's text
  it("still reports the column when the drag ends outside the rendered content", () => {
    const range = document.createRange();
    range.setStart(document.getElementById("tei-text")!.firstChild!, 0);
    // past the end of the content div — where a drag off the column's edge lands
    const column = document.querySelector('[data-doc-column-id="doc-tei-1"]')!;
    range.setEnd(column, column.childNodes.length);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);

    expect(readTEISelection(selection)).toMatchObject({ docId: "doc-tei-1" });
  });

  //Test: text dragged across two columns is not one document's text, so not a query
  it("ignores a selection spanning two TEI columns", () => {
    const range = document.createRange();
    range.setStart(document.getElementById("tei-text")!.firstChild!, 0);
    range.setEnd(document.getElementById("tei-text-2")!.firstChild!, 5);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);

    expect(readTEISelection(selection)).toBeNull();
  });
});

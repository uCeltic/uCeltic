import { beforeEach, describe, expect, it } from "vitest";
import { readTEISelection } from "./selection";

// Two document columns as DocumentArea renders them: the TEI one marks its
// rendered content with data-tei-content, the .txt one does not.
function renderColumns() {
  document.body.innerHTML = `
    <article data-doc-column-id="doc-tei-1">
      <div data-tei-content><p id="tei-text">the hound of culann</p></div>
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
});

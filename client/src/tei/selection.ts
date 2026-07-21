import type { DocumentId } from "../types/document";

// A live text selection the user made inside one TEI viewer column: what they
// selected, which column it came from, and the range it occupies (which is what
// anything positioning UI against the selection measures).
export interface TEISelection {
  docId: DocumentId;
  text: string;
  range: Range;
}

// The TEI column a node sits in, or null when the node is outside any TEI
// viewer's rendered content.
function teiColumnOf(node: Node): Element | null {
  const element =
    node.nodeType === Node.ELEMENT_NODE
      ? (node as Element)
      : node.parentElement;
  return (
    element?.closest("[data-tei-content]")?.closest("[data-doc-column-id]") ??
    null
  );
}

/**
 * Read the browser's current selection as a searchable TEI selection, or null
 * if it isn't one.
 *
 * A selection only counts when it is non-empty and lands inside a TEI column's
 * rendered content (`[data-tei-content]`). Everything else — a collapsed
 * caret, whitespace, a selection in a `.txt`/`.docx` column, or in the toolbar
 * or a result snippet — is not searchable, because search is TEI-only.
 */
export function readTEISelection(
  selection: Selection | null,
): TEISelection | null {
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return null;
  }

  const text = selection.toString().trim();
  if (!text) return null;

  const range = selection.getRangeAt(0);

  // Resolve from where the drag STARTED, not from the range's common ancestor:
  // a drag that runs past the column's edge lands its end outside the rendered
  // content, which would push the common ancestor above it and lose the column.
  const startColumn = teiColumnOf(range.startContainer);
  if (!startColumn) return null;

  // ...but a drag that made it into a *different* TEI column is not one
  // document's text, so it is not a query.
  const endColumn = teiColumnOf(range.endContainer);
  if (endColumn && endColumn !== startColumn) return null;

  const docId = startColumn.getAttribute("data-doc-column-id");
  if (!docId) return null;

  // A selection's range is live: collapsing the selection — which any click,
  // the search button included, does — collapses it too. Hand back a snapshot,
  // so the text stays available to search with and to mark afterwards.
  return { docId, text, range: range.cloneRange() };
}

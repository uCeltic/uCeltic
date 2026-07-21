import type { DocumentId } from "../types/document";

// A live text selection the user made inside one TEI viewer column: what they
// selected, which column it came from, and the range it occupies (which is what
// anything positioning UI against the selection measures).
export interface TEISelection {
  docId: DocumentId;
  text: string;
  range: Range;
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
  const node = range.commonAncestorContainer;
  const element =
    node.nodeType === Node.ELEMENT_NODE
      ? (node as Element)
      : node.parentElement;

  const column = element
    ?.closest("[data-tei-content]")
    ?.closest("[data-doc-column-id]");
  const docId = column?.getAttribute("data-doc-column-id");
  if (!docId) return null;

  return { docId, text, range };
}

import { useEffect, useReducer, useState } from "react";
import { getSearchableDocuments, useDocumentStore } from "../../store/documentStore";
import { useSearchStore } from "../../store/searchStore";
import { readTEISelection, type TEISelection } from "../../tei/selection";
import { toggleOnBtn } from "./buttonStyles";

// Gap between the bottom of the selected text and the button floating under it.
const OFFSET_PX = 6;

/**
 * The select-to-search trigger: one floating button, rendered next to whatever
 * text the user has selected inside a TEI viewer, that searches every visible
 * TEI document for that text.
 *
 * Per ADR-0008 this never reads or writes the search bar's `query` — it passes
 * the selected text straight to `runSearch`. The pending selection is tracked
 * once globally (not per column), so selecting elsewhere simply replaces it,
 * and a selection the browser collapses (any click off the button) takes the
 * button down with it — no dismiss handling of our own.
 *
 * The document the selection came from is never searched, so with nothing else
 * visible to search the button does not appear at all rather than appearing and
 * doing nothing.
 */
export default function SelectionSearchButton() {
  const [pending, setPending] = useState<TEISelection | null>(null);
  const runSearch = useSearchStore((s) => s.runSearch);
  const clearDocumentResults = useSearchStore((s) => s.clearDocumentResults);
  const openDocuments = useDocumentStore((s) => s.openDocuments);
  const visibleDocumentIds = useDocumentStore((s) => s.visibleDocumentIds);
  const [, reposition] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    const onSelectionChange = () =>
      setPending(readTEISelection(window.getSelection()));
    document.addEventListener("selectionchange", onSelectionChange);
    return () =>
      document.removeEventListener("selectionchange", onSelectionChange);
  }, []);

  // The button is positioned in viewport coordinates against text that scrolls
  // inside its own column, so re-measure whenever anything moves. Capture phase:
  // an inner scroller's scroll event does not bubble to the window.
  useEffect(() => {
    if (!pending) return;
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [pending]);

  // Subscribed rather than read on click: closing or hiding the last other TEI
  // column while text is selected has to take the button down with it.
  const targets = pending
    ? getSearchableDocuments(
        { openDocuments, visibleDocumentIds },
        { excludeDocId: pending.docId },
      )
    : [];

  if (!pending || targets.length === 0) return null;

  const rect = pending.range.getBoundingClientRect();

  function handleSearch() {
    if (!pending) return;
    for (const doc of targets) {
      runSearch(doc.content.id, doc.id, {
        query: pending.text,
        origin: "selection",
        excludedDocId: pending.docId,
      });
    }
    // The source document is skipped, not searched — so it has to be emptied
    // explicitly, or it keeps showing an earlier search's hits alongside the
    // results this search just produced.
    clearDocumentResults(pending.docId);
    setPending(null);
  }

  return (
    <button
      type="button"
      aria-label="Search selected text"
      className={`fixed z-50 shadow-lg ${toggleOnBtn}`}
      style={{ top: rect.bottom + OFFSET_PX, left: rect.left }}
      // Pressing a button clears the native selection before the click lands;
      // suppressing that default keeps the text selected long enough to search it.
      onMouseDown={(e) => e.preventDefault()}
      onClick={handleSearch}
    >
      Search
    </button>
  );
}

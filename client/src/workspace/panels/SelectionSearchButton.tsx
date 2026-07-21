import { useEffect, useState } from "react";
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
 */
export default function SelectionSearchButton() {
  const [pending, setPending] = useState<TEISelection | null>(null);
  const runSearch = useSearchStore((s) => s.runSearch);

  useEffect(() => {
    const onSelectionChange = () =>
      setPending(readTEISelection(window.getSelection()));
    document.addEventListener("selectionchange", onSelectionChange);
    return () =>
      document.removeEventListener("selectionchange", onSelectionChange);
  }, []);

  if (!pending) return null;

  const rect = pending.range.getBoundingClientRect();

  function handleSearch() {
    if (!pending) return;
    for (const doc of getSearchableDocuments(useDocumentStore.getState())) {
      runSearch(doc.content.id, doc.id, {
        query: pending.text,
        origin: "selection",
      });
    }
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

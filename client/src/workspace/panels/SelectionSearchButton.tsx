import { useEffect, useReducer, useState } from "react";
import { getSearchableDocuments, useDocumentStore } from "../../store/documentStore";
import { selectAnySearching, useSearchStore } from "../../store/searchStore";
import { setQuerySourceHighlight } from "../../tei/highlight";
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
 * doing nothing. Nor does it appear while a search is already in flight.
 */
export default function SelectionSearchButton() {
  const [pending, setPending] = useState<TEISelection | null>(null);
  const runSearch = useSearchStore((s) => s.runSearch);
  const clearDocumentResults = useSearchStore((s) => s.clearDocumentResults);
  const openDocuments = useDocumentStore((s) => s.openDocuments);
  const visibleDocumentIds = useDocumentStore((s) => s.visibleDocumentIds);
  const [, reposition] = useReducer((n: number) => n + 1, 0);
  // The same condition the tool bar disables its own Search button on.
  const anySearching = useSearchStore(selectAnySearching);

  // A search in flight owns the columns it is filling, so the button that would
  // fire a second one over the top of it stands down for the duration: the
  // pending selection is dropped the moment a search starts, and selections are
  // not listened for until it is over. Whatever was selected meanwhile is stale
  // by then, so listening resumes empty-handed — the next selection brings the
  // button back.
  //
  // The drop happens during render, not in an effect: React's documented
  // "adjusting state when a value changes" pattern re-renders before the DOM
  // commits, instead of briefly painting a button the search has already
  // invalidated.
  if (anySearching && pending) setPending(null);

  useEffect(() => {
    if (anySearching) return;
    const onSelectionChange = () =>
      setPending(readTEISelection(window.getSelection()));
    document.addEventListener("selectionchange", onSelectionChange);
    return () =>
      document.removeEventListener("selectionchange", onSelectionChange);
  }, [anySearching]);

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
        { excludedDocId: pending.docId },
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
    // Skipped, not searched — so it is emptied rather than left as it was.
    clearDocumentResults(pending.docId);
    // Hand the text over from the native selection to a mark of our own, so the
    // results stay traceable to what produced them. The native highlight is
    // dropped rather than left to expire on the user's next click: this button
    // suppresses the collapse a click normally causes (see onMouseDown below),
    // so without this the two would sit on the same text with the native one
    // painted on top, and the mark would only surface later, out of context.
    // `pending.range` is a snapshot, so clearing the selection cannot move it.
    setQuerySourceHighlight(pending.range);
    window.getSelection()?.removeAllRanges();
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

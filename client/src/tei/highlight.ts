import type { TEIDoc } from "../types/tei";
import type { SearchResult } from "../types/search";
import {
  buildAnchorsById,
  buildWordToAnchor,
  buildRangesForWordSpan,
} from "./wordRange";

// One visible TEI column's highlight inputs. We only need the anchor/word data
// from the TEI doc, so we depend on just those two fields.
export interface HighlightColumn {
  docId: string;
  teiDoc: Pick<TEIDoc, "anchors" | "word_array">;
  results: SearchResult[];
  activeIndex: number;
}

// Fetch a named global Highlight, creating it on first use.
function getHighlight(name: string): Highlight | undefined {
  const registry = window.CSS?.highlights;
  if (!registry) return undefined;
  let hl = registry.get(name);
  if (!hl) {
    hl = new Highlight();
    registry.set(name, hl);
  }
  return hl;
}

/**
 * Repaint the "search-match-active" highlight for every visible TEI column at
 * once — each column's CURRENT result (results[activeIndex]) and nothing else.
 *
 * One global Highlight holds the current-result range from all columns, so this
 * clears first and then repaints from the supplied columns: dropping a column's
 * results (e.g. on search start) or navigating one column never disturbs
 * another column's highlight.
 */
export function rebuildHighlights(columns: HighlightColumn[]): void {
  const activeHL = getHighlight("search-match-active");
  activeHL?.clear();
  if (!activeHL) return;

  for (const col of columns) {
    const active = col.results[col.activeIndex];
    if (!active) continue;

    const columnEl = document.querySelector(
      `[data-doc-column-id="${col.docId}"]`,
    );
    if (!columnEl) continue;

    const anchorsById = buildAnchorsById(col.teiDoc.anchors);
    const wordToAnchor = buildWordToAnchor(col.teiDoc.word_array);
    const ranges = buildRangesForWordSpan(
      columnEl,
      anchorsById,
      wordToAnchor,
      active.word_start,
      active.word_end,
    );
    for (const r of ranges) activeHL.add(r);
  }
}

/**
 * Mark the text a selection-triggered search took its query from, or clear the
 * mark when passed null.
 *
 * A native text selection does not survive being acted on — it is the browser's
 * to collapse, and it says "you are selecting this", not "these results came
 * from this". So the search hands the text over to a mark of our own, which
 * outlives the selection and stays put while the user reads the results.
 *
 * Exactly one range is marked at a time: a second selection search replaces the
 * first, and a typed search (which came from no text on screen) clears it.
 *
 * A range with no text left to mark is dropped rather than painted. Closing the
 * source document is the way that happens: removing a node collapses the live
 * ranges inside it onto the parent it was removed from (DOM spec), so a stale
 * range arrives here empty rather than throwing. Refusing it keeps the registry
 * honest about what is actually on screen.
 */
export function setQuerySourceHighlight(range: Range | null): void {
  const sourceHL = getHighlight("query-source");
  sourceHL?.clear();
  if (!sourceHL || !range || range.collapsed) return;
  sourceHL.add(range);
}
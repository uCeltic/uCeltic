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
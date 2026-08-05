import type { TEIDoc } from "../types/tei";
import type { SearchResult } from "../types/search";
import { rangesForWordSpan } from "./wordRange";

// One visible TEI column's highlight inputs. The anchors carry both which words
// they hold and where those words sit in their text, so that is all we need.
export interface HighlightColumn {
  docId: string;
  teiDoc: Pick<TEIDoc, "anchors">;
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

    const ranges = rangesForWordSpan(
      columnEl,
      col.teiDoc.anchors,
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
// One visible TEI column's Tag Filter state: which entity the workspace is
// following (the same id in every column — the manuscripts group their names
// the same way) and which of THIS column's occurrences it is sitting on.
export interface EntityHighlightColumn {
  docId: string;
  entityId: string | null;
  activeIndex: number;
}

/**
 * Every occurrence of one entity in one column, in reading order.
 *
 * Occurrences are found by the id the markup groups them under, not by text:
 * `Find`, `Finn`, `Ḟinn` and `Fhionn` all carry the same one, so all four
 * spellings answer to one selection and no other person's name does.
 *
 * Two attributes are searched because the corpus has said it two ways.
 * `data-tei-ref` is a pointer into a document's own `standOff` authority list
 * (`ref="#fionn"`), which is how the superseded witnesses grouped names;
 * `data-tei-nym-ref` is the bare group id the re-cut witnesses use
 * instead (`nymRef="F64"`), and it is the only one the shipped corpus carries
 * today (#162). A `standOff` is never rendered, so nothing inside one can be
 * found here either way.
 *
 * A name inside a `note` is not one of them. The note is the editor's English
 * commentary, and the menu's count leaves out any name it holds (the backend's
 * SKIP_TAGS, #163) — so counting one here would make a column's `1 / 21` a
 * claim about 22 things, and would let navigation land on a span that is only
 * on screen while the reader hovers the footnote marker.
 */
export function entityOccurrences(docId: string, entityId: string): Element[] {
  const columnEl = document.querySelector(`[data-doc-column-id="${docId}"]`);
  if (!columnEl) return [];
  const id = CSS.escape(entityId);
  return [
    ...columnEl.querySelectorAll(
      `[data-tei-ref="#${id}"], [data-tei-nym-ref="${id}"]`,
    ),
  ].filter((el) => !el.closest('[data-tei-tag="note"]'));
}

/**
 * Repaint the Tag Filter's two highlight tiers for every visible column at once
 * — the current occurrence, and that entity's other occurrences in the same
 * column. The third tier, dimming every *other* named entity, is plain CSS on
 * `data-tei-entity` and needs nothing here.
 *
 * Same shape and same reason as `rebuildHighlights` above: one global Highlight
 * per tier holds every column's ranges, so this clears and repaints from all
 * the supplied columns rather than editing one column's share in place.
 *
 * The names are deliberately not the search ones. Both features can be on
 * screen at once, and clearing is by name — sharing a name would make each
 * repaint wipe the other feature's highlight.
 */
export function rebuildEntityHighlights(columns: EntityHighlightColumn[]): void {
  const activeHL = getHighlight("tag-entity-active");
  const otherHL = getHighlight("tag-entity-other");
  activeHL?.clear();
  otherHL?.clear();
  if (!activeHL || !otherHL) return;

  for (const col of columns) {
    if (!col.entityId) continue;
    const occurrences = entityOccurrences(col.docId, col.entityId);

    occurrences.forEach((el, i) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      (i === col.activeIndex ? activeHL : otherHL).add(range);
    });
  }
}

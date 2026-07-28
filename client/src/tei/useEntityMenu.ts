import { useMemo } from "react";
import {
  getVisibleTEIDocuments,
  useDocumentStore,
} from "../store/documentStore";
import { buildEntityMenu, type EntityMenuEntry } from "./authority";

export interface EntityMenu {
  /** The authority entries on offer, most-referenced first. */
  entries: EntityMenuEntry[];
  /**
   * Where each TEI column sits in every entry's `counts` / `declaredBy` array.
   * Columns holding a non-TEI document have no entry here — they have no
   * authority list, so there is nothing for them to say about an entity.
   */
  columnIndexById: Map<string, number>;
}

/**
 * The Tag Filter's menu, derived from the documents currently on screen.
 *
 * One derivation, two readers: the toolbar menu that offers the entries and the
 * per-column navigation cards that count them. Deriving it twice would let the
 * number in the menu (`12 · 111 · 72`) and the number on a column's card
 * (`1 / 12`) drift apart, which is the one inconsistency this feature cannot
 * afford — they are the same claim, printed twice.
 *
 * `getVisibleTEIDocuments` is the seam #152 will narrow: choosing a work will
 * change which documents this is built from, not what it does with them.
 */
export function useEntityMenu(): EntityMenu {
  const openDocuments = useDocumentStore((s) => s.openDocuments);
  const visibleDocumentIds = useDocumentStore((s) => s.visibleDocumentIds);

  return useMemo(() => {
    const docs = getVisibleTEIDocuments({ openDocuments, visibleDocumentIds });
    return {
      entries: buildEntityMenu(docs.map((doc) => doc.content.parsed_json)),
      columnIndexById: new Map(docs.map((doc, i) => [doc.id, i])),
    };
  }, [openDocuments, visibleDocumentIds]);
}

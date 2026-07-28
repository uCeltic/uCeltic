import { useMemo } from "react";
import {
  getVisibleTEIDocuments,
  useDocumentStore,
  type SearchableDocument,
} from "../store/documentStore";
import { useWorkspaceStore } from "../store/workspaceStore";
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
 * `getVisibleTEIDocuments` is the seam #152 narrows: choosing a work changes
 * which documents this is built from, not what it does with them.
 */
export function useEntityMenu(): EntityMenu {
  const openDocuments = useDocumentStore((s) => s.openDocuments);
  const visibleDocumentIds = useDocumentStore((s) => s.visibleDocumentIds);
  const selectedWorkId = useWorkspaceStore((s) => s.selectedWorkId);

  return useMemo(() => {
    const docs = documentsInWork(
      getVisibleTEIDocuments({ openDocuments, visibleDocumentIds }),
      selectedWorkId,
    );
    return {
      entries: buildEntityMenu(docs.map((doc) => doc.content.parsed_json)),
      columnIndexById: new Map(docs.map((doc, i) => [doc.id, i])),
    };
  }, [openDocuments, visibleDocumentIds, selectedWorkId]);
}

/**
 * The subset of `docs` belonging to the chosen work — all of them when no work
 * is chosen.
 *
 * The link between the two toolbar dropdowns runs one way (#152): a work
 * selection narrows what the Tag Filter is a menu of, and the counts it prints
 * narrow with it, because a count is per column of THIS menu. A document with
 * no work is simply not in any work's set; it stays offered while no work is
 * chosen, which is the only state in which it can be reasoned about.
 */
function documentsInWork(
  docs: SearchableDocument[],
  workId: number | null,
): SearchableDocument[] {
  if (workId === null) return docs;
  return docs.filter((doc) => doc.content.work?.id === workId);
}

import { useEffect, useMemo } from "react";
import {
  getVisibleTEIDocuments,
  useDocumentStore,
  type SearchableDocument,
} from "../store/documentStore";
import { useNameRegistryStore } from "../store/nameRegistryStore";
import { useWorkspaceStore } from "../store/workspaceStore";
import { buildEntityMenu, type EntityMenuEntry } from "./entityMenu";

export interface EntityMenu {
  /** The entities on offer, most-referenced first. */
  entries: EntityMenuEntry[];
  /**
   * Where each TEI column sits in every entry's `counts` array. Columns holding
   * a non-TEI document have no entry here — they carry no marked-up entities,
   * so there is nothing for them to say about one.
   */
  columnIndexById: Map<string, number>;
}

/**
 * The Tag Filter's menu, derived from the documents currently on screen.
 *
 * One derivation, two readers: the toolbar menu that offers the entries and the
 * per-column navigation cards that count them. Deriving it twice would let the
 * number in the menu (`21 · 10 · 17 · 16`) and the number on a column's card
 * (`1 / 21`) drift apart, which is the one inconsistency this feature cannot
 * afford — they are the same claim, printed twice.
 *
 * `getVisibleTEIDocuments` is the seam #152 narrows: choosing a work changes
 * which documents this is built from, not what it does with them.
 *
 * The rows themselves are the join of the corpus-wide register with each of
 * those columns' own `name_index` (#163). The register is what the corpus does
 * not carry — a name for a group id — and the counts are what only the open
 * documents can say.
 */
export function useEntityMenu(): EntityMenu {
  const openDocuments = useDocumentStore((s) => s.openDocuments);
  const visibleDocumentIds = useDocumentStore((s) => s.visibleDocumentIds);
  const selectedWorkId = useWorkspaceStore((s) => s.selectedWorkId);
  const register = useNameRegistryStore((s) => s.entities);
  const loadRegister = useNameRegistryStore((s) => s.load);

  // The register is the same for every reader of this hook and for the whole
  // session, so the request is asked for here and de-duplicated in the store
  // rather than owned by whichever component happens to mount first.
  useEffect(() => loadRegister(), [loadRegister]);

  return useMemo(() => {
    const docs = documentsInWork(
      getVisibleTEIDocuments({ openDocuments, visibleDocumentIds }),
      selectedWorkId,
    );
    return {
      entries: buildEntityMenu(
        register,
        docs.map((doc) => doc.content.name_index),
      ),
      columnIndexById: new Map(docs.map((doc, i) => [doc.id, i])),
    };
  }, [openDocuments, visibleDocumentIds, selectedWorkId, register]);
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

import type { TEICatalogEntry, TEIWork } from "../types/tei";

/**
 * The catalogue, arranged the way the opener reads it: work → its manuscripts.
 *
 * The grouping is derived from the one flat `/api/tei/` response rather than
 * fetched as its own work list, which is what makes "a work with no documents
 * does not appear as an empty branch" true by construction — a group exists
 * only because a document named its work (#152).
 */

/** The branch documents that belong to no work are shown under. */
export const UNASSIGNED_WORK_LABEL = "Unassigned";

export interface WorkGroup {
  /**
   * Identifies the branch. Derived from the work id rather than its name,
   * because a work the corpus happens to call "Unassigned" must not fuse with
   * the branch of documents that have no work at all.
   */
  key: string;
  /** `null` for the unassigned branch. */
  work: TEIWork | null;
  /** What the branch is called on screen. */
  label: string;
  /** Its documents, in catalogue order. */
  documents: TEICatalogEntry[];
}

export function groupCatalogueByWork(
  entries: TEICatalogEntry[],
): WorkGroup[] {
  const byWorkId = new Map<number, WorkGroup>();
  const unassigned: TEICatalogEntry[] = [];

  for (const entry of entries) {
    if (!entry.work) {
      unassigned.push(entry);
      continue;
    }
    const group = byWorkId.get(entry.work.id);
    if (group) {
      group.documents.push(entry);
    } else {
      byWorkId.set(entry.work.id, {
        key: `work-${entry.work.id}`,
        work: entry.work,
        label: entry.work.name,
        documents: [entry],
      });
    }
  }

  // The catalogue arrives newest-first, which is an upload order, not a reading
  // order — a reference list of works belongs in name order.
  const groups = [...byWorkId.values()].sort((a, b) =>
    a.label.localeCompare(b.label),
  );

  // Last, and only when it has something in it: these are the corpus's odds and
  // ends (shakespear.xml, the serafin samples), still openable but not the
  // material anyone came for.
  if (unassigned.length > 0) {
    groups.push({
      key: "unassigned",
      work: null,
      label: UNASSIGNED_WORK_LABEL,
      documents: unassigned,
    });
  }

  return groups;
}

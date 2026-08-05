/**
 * What one row of the Tag Filter's menu is, and how a row is made.
 *
 * A row is a join of two things, and neither one is a row on its own:
 *
 * - the **register** (`NameEntity`) says what a `@nymRef` group id is called.
 *   Nothing in any TEI file does — the four witnesses group 670 named entities
 *   under 91 bare ids and never say who `F64` is (#162) — so the name comes
 *   from outside the corpus, derived from its own spellings and overridable by
 *   hand (#163).
 * - each visible column's **`name_index`** says how often that column writes
 *   the name. `Find` is 21 occurrences in Franciscan A 4 and 10 in G 126, and
 *   the reader is shown both, because following one entity across four columns
 *   is the whole reason the columns sit side by side.
 *
 * The join happens here rather than on the server because which columns are in
 * play is a frontend fact: `getVisibleTEIDocuments` already answers it, and a
 * chosen Work already narrows it.
 */

import type { EntityKind, NameEntity, TEINameIndex } from "../types/tei";

// Re-exported so a reader of the menu reaches the kind through the menu, the
// way `EntityMenuEntry` does — it is defined next to `NameEntity` because that
// is what the backend decides it on.
export type { EntityKind };

export interface EntityMenuEntry {
  /** The group id every occurrence of this entity carries — its `@nymRef`
   *  value verbatim, which is also what the DOM carries and what a selection
   *  resolves against. Printed beside the headword: researchers cross-check
   *  against their own name lists, and this code is the only key those lists
   *  share with the app. */
  id: string;
  kind: EntityKind;
  /** The name the reader is shown. */
  headword: string;
  /** Occurrences in each visible column, in the order they are on screen. */
  counts: number[];
}

/**
 * The rows to offer for one register and one set of visible columns.
 *
 * Nothing is offered that cannot match anything: an entity none of these
 * columns names is dropped rather than shown with four zeroes, which is the
 * property the hard-coded element-name vocabulary failed twice over (#147). A
 * column that names it zero times still gets its slot, though — the counts are
 * positional, and a reader compares them across columns.
 *
 * Ordering is most-referenced first, over the visible columns only, so the
 * people a passage is actually about surface at the top of a 91-row menu. Ties
 * go to the headword so that two equally-referenced entities keep a stable
 * order rather than swapping as columns come and go.
 *
 * Bad data degrades. Lismore writes `nymRef="64"` once where it writes `F64`
 * sixteen times, and that typo keeps a row of its own: two near-identical rows
 * are the signal to fix the source file, where a correction table in the app
 * would hide the defect and never be removed.
 */
export function buildEntityMenu(
  register: NameEntity[],
  columns: TEINameIndex[],
): EntityMenuEntry[] {
  return register
    .map((entity) => ({
      id: entity.code,
      kind: entity.kind,
      headword: entity.headword,
      counts: columns.map((index) => index?.[entity.code]?.count ?? 0),
    }))
    .filter((entry) => entry.counts.some((count) => count > 0))
    .sort(
      (a, b) =>
        total(b.counts) - total(a.counts) ||
        a.headword.localeCompare(b.headword),
    );
}

function total(counts: number[]): number {
  return counts.reduce((sum, count) => sum + count, 0);
}

/**
 * What one row of the Tag Filter's menu is, independent of where the rows come
 * from.
 *
 * They came from the document itself until #162. Each Acallam witness carried a
 * `standOff` naming 33 people and 10 places with every spelling of each, and
 * every named entity in the body pointed back at one with `ref="#fionn"`, so
 * "Find, Finn, Ḟinn and Fhionn are one man" was answered by the corpus rather
 * than by us. The re-cut ll. 2390–2594 corpus has no `standOff` at all: its 670
 * named entities are `name` / `addName` elements carrying a bare group id in
 * `@nymRef` (`nymRef="F64"`), and nothing in any file says what `F64` stands
 * for. The reader that used to build these rows was deleted rather than left
 * pointed at markup the corpus no longer contains — it would have resolved to
 * nothing and offered nothing, which is the empty state the menu now reaches
 * honestly, by having no source.
 *
 * The registry that maps a group id to a headword is the next slice. These
 * types stay because the highlighting, navigation and per-column counting they
 * feed are unchanged by where the rows are read from — only the source moves.
 */

export type EntityKind = "person" | "place";

export interface EntityMenuEntry {
  /** The group id every occurrence of this entity carries. */
  id: string;
  kind: EntityKind;
  /** The canonical form — what the reader is shown. */
  headword: string;
  /** Occurrences in each source document, in the order they were given. */
  counts: number[];
  /**
   * Whether each source document knows this entity at all — which is not the
   * same as naming it. A document that could name Áine and never does has
   * something to say ("none here"); one this entity is foreign to has nothing,
   * and shows no navigation card.
   */
  declaredBy: boolean[];
}

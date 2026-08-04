/**
 * The TEI elements the reader renders as named entities — the components in
 * `elements/names.tsx`, and the only elements whose group id reaches the DOM as
 * `data-tei-ref` / `data-tei-nym-ref`.
 *
 * It lives in a module of its own because that is the one place both halves of
 * the Tag Filter can share it: the menu counts occurrences over this set in
 * `parsed_json`, `highlight.ts` paints the matching spans in the DOM. Count one
 * population and highlight another and a column's `1 / 12` stops being a claim
 * about what is on screen.
 *
 * Nothing counts them at the moment — the menu is empty until the registry
 * slice lands (#162) — but the highlight half is live, and the set is what the
 * two will have to agree on again.
 */
export const ENTITY_TAGS = [
  "persName",
  "placeName",
  "geogName",
  "orgName",
  "rs",
  "name",
  "addName",
] as const;

export type EntityTag = (typeof ENTITY_TAGS)[number];

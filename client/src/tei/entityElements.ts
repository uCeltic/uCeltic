/**
 * The TEI elements the reader renders as named entities — the components in
 * `elements/names.tsx`, and the only elements whose `@ref` reaches the DOM as
 * `data-tei-ref`.
 *
 * It lives in a module of its own because that is the one place both halves of
 * the Tag Filter can share it: `authority.ts` counts occurrences over this set
 * in `parsed_json`, `highlight.ts` paints the matching spans in the DOM. Count
 * one population and highlight another and a column's `1 / 12` stops being a
 * claim about what is on screen.
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

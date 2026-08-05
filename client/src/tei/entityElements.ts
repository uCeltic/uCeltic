/**
 * The TEI elements the reader renders as named entities — the components in
 * `elements/names.tsx`, and the only elements whose group id reaches the DOM as
 * `data-tei-ref` / `data-tei-nym-ref`.
 *
 * It lives in a module of its own because it is one half of a set that spans
 * two languages. The other half is `NAME_TAGS` in
 * `backend/apps/tei/services/name_index.py`, which decides the occurrence count
 * a Tag Filter row prints; this one decides which spans `highlight.ts` can find
 * in the DOM. Count one population and highlight another and a column's
 * `1 / 21` stops being a claim about what is on screen.
 *
 * Both edges are pinned rather than trusted: `entityElements.test.tsx` holds
 * this list to the components in `elements/names.tsx`, and the backend's
 * `test_name_index.NameTagsMatchTheRendererTest` reads this file and holds
 * `NAME_TAGS` to it.
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

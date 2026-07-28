// The closed set of TEI named-entity tag types the reader renders — the six elements
// in tei/elements/names.tsx. It is what the Tag Filter offers (CONTEXT.md → Tag Filter);
// add an element there and it belongs here too, or the filter stops covering the text.
//
// One deliberate exception, recorded rather than left to look like an oversight:
// names.tsx also renders `addName` (#146) and this list does not offer it. #147
// replaces this element-name vocabulary with categories drawn from `name/@type`,
// which is how the research corpus actually tags, and folds `addName` in there.
export const TEI_ENTITY_TAGS = [
  { tag: "persName", label: "Person" },
  { tag: "placeName", label: "Place" },
  { tag: "geogName", label: "Geographic Feature" },
  { tag: "orgName", label: "Organisation" },
  { tag: "rs", label: "Referring String" },
  { tag: "name", label: "Name" },
] as const;

export type TEIEntityTag = (typeof TEI_ENTITY_TAGS)[number]["tag"];

export function entityTagLabel(tag: TEIEntityTag): string {
  return TEI_ENTITY_TAGS.find((t) => t.tag === tag)?.label ?? tag;
}

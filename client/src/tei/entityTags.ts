// The closed set of TEI named-entity tag types the reader renders — the six elements
// in tei/elements/names.tsx. It is what the Tag Filter offers (CONTEXT.md → Tag Filter);
// add an element there and it belongs here too, or the filter stops covering the text.
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

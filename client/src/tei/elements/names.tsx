import type { TEIElementProps } from "../elementMap";

// Every component here is a named entity, and every one carries
// `data-tei-entity` to say so. The Tag Filter dims the entities it is not
// following (#147), which needs a marker only these elements set —
// `data-tei-tag` is on most of the reader's spans, not just these.
//
// `data-tei-ref` is the pointer into the document's own authority list
// (`ref="#fionn"`), and it is what the Tag Filter finds occurrences by.

// The components below are the whole of `ENTITY_TAGS` (../entityElements.ts),
// and `entityElements.test.tsx` fails if the two ever disagree.

const nameBase = "underline decoration-dotted cursor-default";

export function PersName({ node, children, anchorId }: TEIElementProps) {
  return (
    <span
      className={`${nameBase} text-emerald-700 decoration-emerald-500`}
      data-tei-entity=""
      data-tei-tag="persName"
      data-tei-anchor-id={anchorId}
      data-tei-ref={node.attrs?.ref}
    >
      {children}
    </span>
  );
}

export function PlaceName({ node, children, anchorId }: TEIElementProps) {
  return (
    <span
      className={`${nameBase} text-teal-700 decoration-teal-500`}
      data-tei-entity=""
      data-tei-tag="placeName"
      data-tei-anchor-id={anchorId}
      data-tei-ref={node.attrs?.ref}
    >
      {children}
    </span>
  );
}

export function GeogName({ node, children, anchorId }: TEIElementProps) {
  return (
    <span
      className={`${nameBase} text-teal-700 decoration-teal-500`}
      data-tei-entity=""
      data-tei-tag="geogName"
      data-tei-anchor-id={anchorId}
      data-tei-ref={node.attrs?.ref}
    >
      {children}
    </span>
  );
}

export function OrgName({ node, children, anchorId }: TEIElementProps) {
  return (
    <span
      className={`${nameBase} text-orange-700 decoration-orange-400`}
      data-tei-entity=""
      data-tei-tag="orgName"
      data-tei-anchor-id={anchorId}
      data-tei-ref={node.attrs?.ref}
    >
      {children}
    </span>
  );
}

export function Rs({ node, children, anchorId }: TEIElementProps) {
  return (
    <span
      className={`${nameBase} text-gray-700 decoration-gray-400`}
      data-tei-entity=""
      data-tei-tag="rs"
      data-tei-anchor-id={anchorId}
      data-tei-ref={node.attrs?.ref}
      data-tei-type={node.attrs?.type}
    >
      {children}
    </span>
  );
}

export function Name({ node, children, anchorId }: TEIElementProps) {
  return (
    <span
      className={`${nameBase} text-gray-700 decoration-gray-400`}
      data-tei-entity=""
      data-tei-tag="name"
      data-tei-anchor-id={anchorId}
      data-tei-ref={node.attrs?.ref}
    >
      {children}
    </span>
  );
}

// `addName` is an added name (epithet, byname) — a name, so it reads as one.
// It does not occur in this corpus; it is here so a file that does use it
// renders, and it is filterable like any other entity if it ever carries a
// `ref` into an authority list.
export function AddName({ node, children, anchorId }: TEIElementProps) {
  return (
    <span
      className={`${nameBase} text-gray-700 decoration-gray-400`}
      data-tei-entity=""
      data-tei-tag="addName"
      data-tei-anchor-id={anchorId}
      data-tei-ref={node.attrs?.ref}
      data-tei-nym-ref={node.attrs?.nymRef}
    >
      {children}
    </span>
  );
}

import type { TEIElementProps } from "../elementMap";

// Every component here is a named entity, and every one carries
// `data-tei-entity` to say so. The Tag Filter dims the entities it is not
// following (#147), which needs a marker only these elements set —
// `data-tei-tag` is on most of the reader's spans, not just these.
//
// Two attributes carry "which entity is this", because two corpora answer it
// differently. `data-tei-ref` is a pointer into the document's own authority
// list (`ref="#fionn"`), which is how the superseded Acallam witnesses said it.
// `data-tei-nym-ref` is the bare group id the re-cut witnesses say it
// with instead (`nymRef="F64"`) — not a pointer, and deliberately not written
// out as one, because nothing in those files declares what `F64` names (#162).
// Both are emitted as they are found; making sense of either is the Tag
// Filter's job, not this module's.
//
// None of them decorates the text (#153). A name is not marked on the page at
// all until something asks for it to be: the attributes are here so that
// highlighting a chosen person, or opting entities back into colour, is a CSS
// rule against `[data-tei-entity]` rather than a change to these components.

// The components below are the whole of `ENTITY_TAGS` (../entityElements.ts),
// and `entityElements.test.tsx` fails if the two ever disagree.

export function PersName({ node, children, anchorId }: TEIElementProps) {
  return (
    <span
      data-tei-entity=""
      data-tei-tag="persName"
      data-tei-anchor-id={anchorId}
      data-tei-ref={node.attrs?.ref}
      data-tei-nym-ref={node.attrs?.nymRef}
    >
      {children}
    </span>
  );
}

export function PlaceName({ node, children, anchorId }: TEIElementProps) {
  return (
    <span
      data-tei-entity=""
      data-tei-tag="placeName"
      data-tei-anchor-id={anchorId}
      data-tei-ref={node.attrs?.ref}
      data-tei-nym-ref={node.attrs?.nymRef}
    >
      {children}
    </span>
  );
}

export function GeogName({ node, children, anchorId }: TEIElementProps) {
  return (
    <span
      data-tei-entity=""
      data-tei-tag="geogName"
      data-tei-anchor-id={anchorId}
      data-tei-ref={node.attrs?.ref}
      data-tei-nym-ref={node.attrs?.nymRef}
    >
      {children}
    </span>
  );
}

export function OrgName({ node, children, anchorId }: TEIElementProps) {
  return (
    <span
      data-tei-entity=""
      data-tei-tag="orgName"
      data-tei-anchor-id={anchorId}
      data-tei-ref={node.attrs?.ref}
      data-tei-nym-ref={node.attrs?.nymRef}
    >
      {children}
    </span>
  );
}

export function Rs({ node, children, anchorId }: TEIElementProps) {
  return (
    <span
      data-tei-entity=""
      data-tei-tag="rs"
      data-tei-anchor-id={anchorId}
      data-tei-ref={node.attrs?.ref}
      data-tei-nym-ref={node.attrs?.nymRef}
      data-tei-type={node.attrs?.type}
    >
      {children}
    </span>
  );
}

// `name` is what the re-cut Acallam witnesses mark almost every entity with —
// 668 of the corpus's 670, people and places alike, the kind stated in `@type`
// rather than by the element: 485 person, 182 place, and one that carries no
// `@type` at all.
export function Name({ node, children, anchorId }: TEIElementProps) {
  return (
    <span
      data-tei-entity=""
      data-tei-tag="name"
      data-tei-anchor-id={anchorId}
      data-tei-ref={node.attrs?.ref}
      data-tei-nym-ref={node.attrs?.nymRef}
    >
      {children}
    </span>
  );
}

// `addName` is an added name (epithet, byname) — a name, so it is marked up as
// one. The current corpus uses it twice, for an epithet it distinguishes from
// the name proper (`Tāilgend`), grouped by `@nymRef` like any other entity.
export function AddName({ node, children, anchorId }: TEIElementProps) {
  return (
    <span
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

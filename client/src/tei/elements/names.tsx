import type { TEIElementProps } from "../elementMap";

const nameBase = "underline decoration-dotted cursor-default";

export function PersName({ node, children, anchorId }: TEIElementProps) {
  return (
    <span
      className={`${nameBase} text-emerald-700 decoration-emerald-500`}
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
      data-tei-tag="name"
      data-tei-anchor-id={anchorId}
      data-tei-ref={node.attrs?.ref}
    >
      {children}
    </span>
  );
}

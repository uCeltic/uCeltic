import type { TEIElementProps } from "./elementMap";

export default function PassThrough({ node, children, anchorId }: TEIElementProps) {
    return (
      <span data-tei-tag={node.tag} data-tei-anchor-id={anchorId}>
        {children}
      </span>
    );
  }
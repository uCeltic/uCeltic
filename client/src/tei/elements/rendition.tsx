import type { TEIElementProps } from "../elementMap";
import { rendClasses } from "./rend";

export function Hi({ node, children, anchorId }: TEIElementProps) {
  const rend = node.attrs?.rend;
  const classes = rendClasses(rend);
  return (
    <span
      className={classes.length ? classes.join(" ") : undefined}
      data-tei-tag="hi"
      data-tei-anchor-id={anchorId}
      data-tei-rend={rend}
    >
      {children}
    </span>
  );
}

// A character the transcription singles out (`@type="kk"`, `@rend="italic"`).
// Mapped rather than left to PassThrough so the attributes reach the DOM, but
// rendered with no visual change of its own — `c` sits *inside* words, and a
// style here would decorate a fragment of one.
export function C({ node, children, anchorId }: TEIElementProps) {
  return (
    <span
      data-tei-tag="c"
      data-tei-anchor-id={anchorId}
      data-tei-type={node.attrs?.type}
      data-tei-rend={node.attrs?.rend}
    >
      {children}
    </span>
  );
}

import type { TEIElementProps } from "../elementMap";

// How the manuscript renders a stretch of text, as recorded in `@rend`. The keys
// are the values the corpus actually uses — `ital` is the research team's own
// spelling of `italic`, and `decor` marks a decorated initial. Anything else
// renders as plain text: an unrecognised rendition is still readable text, and
// guessing at it would misrepresent the manuscript.
const HI_REND_CLASSES: Record<string, string> = {
  decor: "text-3xl leading-none font-semibold text-red-800",
  italic: "italic",
  ital: "italic",
  superscript: "align-super text-xs",
  large: "text-lg",
};

export function Hi({ node, children, anchorId }: TEIElementProps) {
  const rend = node.attrs?.rend;
  return (
    <span
      className={(rend && HI_REND_CLASSES[rend]) || undefined}
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

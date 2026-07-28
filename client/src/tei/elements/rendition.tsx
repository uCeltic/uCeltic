import type { TEIElementProps } from "../elementMap";

// `hi` marks a stretch the manuscript renders differently, and `@rend` says how.
// Nothing here acts on it (#153): the reading pane shows the text, and `@rend`
// reaches the DOM as `data-tei-rend` for anything that later wants to opt in.
//
// It reaches it whole. The class table this used to consult matched `@rend` as
// the space-separated token list it is — the corpus carries `italic` (438),
// `ital` (31) and compounds like `italic center` (78) — and a lookup that
// recognised some tokens and dropped the rest is exactly what an opt-in rule
// should get to decide for itself.
export function Hi({ node, children, anchorId }: TEIElementProps) {
  return (
    <span data-tei-tag="hi" data-tei-anchor-id={anchorId} data-tei-rend={node.attrs?.rend}>
      {children}
    </span>
  );
}

// A character the transcription singles out (`@type="kk"`, `@rend="italic"`).
// Mapped rather than left to PassThrough so the attributes reach the DOM.
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

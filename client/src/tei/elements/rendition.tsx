import type { TEIElementProps } from "../elementMap";

// `hi` marks a stretch the manuscript renders differently, and `@rend` says how.
// `@rend` reaches the DOM whole as `data-tei-rend` whatever it says (#153).
//
// One value is acted on: `decor`, which the printed edition sets bold (#165,
// ADR-0018). Every one of the corpus's 154 `hi` carries it, and it is not only a
// decorated initial — 119 wrap a single letter, the rest whole words or clauses
// (`Cōicer` ×7, and two spans in FranA4 that bold a full line).
//
// This is a declared mapping, not the class table ADR-0016 deleted. That table
// recognised five tokens and silently dropped the rest, so an unseen
// `rend="italic"` came out mis-set; here it is left alone. The match is on the
// token, because `@rend` is the whitespace-separated token list TEI says it is —
// `decor italic` is a `decor`, and `decoratedCapital` is not.
const DECOR = "decor";

function isDecor(rend: string | undefined): boolean {
  return rend?.split(/\s+/).includes(DECOR) ?? false;
}

export function Hi({ node, children, anchorId }: TEIElementProps) {
  const rend = node.attrs?.rend;
  return (
    <span
      className={isDecor(rend) ? "font-bold" : ""}
      data-tei-tag="hi"
      data-tei-anchor-id={anchorId}
      data-tei-rend={rend}
    >
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

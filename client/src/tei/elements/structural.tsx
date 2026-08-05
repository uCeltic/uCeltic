import type { TEIElementProps } from "../elementMap";

// #153 — layout and spacing only. What distinguishes one of these from the next
// is where it sits on the page, not what colour or weight it is set in.

export function Div({ children, anchorId }: TEIElementProps) {
  return <div data-tei-anchor-id={anchorId}>{children}</div>;
}

export function P({ children, anchorId }: TEIElementProps) {
  return <p className="mb-3 leading-relaxed" data-tei-anchor-id={anchorId}>{children}</p>;
}

export function Head({ children, anchorId }: TEIElementProps) {
  return <h3 className="mt-4 mb-2" data-tei-anchor-id={anchorId}>{children}</h3>;
}

export function L({ node, children, anchorId }: TEIElementProps) {
  return (
    <span className="block" data-tei-anchor-id={anchorId} data-tei-n={node.attrs?.n}>
      {children}
    </span>
  );
}

// The indent is the one thing here that carries information: these manuscripts
// are written continuously, so verse-versus-prose is the annotator's analysis
// rather than the page's own layout. The grey left rule that used to sit beside
// it said nothing the indent had not already said.
//
// The number hangs in the margin, the way a printed edition sets a numbered
// quatrain (#165, ADR-0018). The `pl-4` the indent was already worth is the
// gutter it hangs in, so the number sits left of the verse's own left edge
// without the indent changing.
//
// Having an `@n` is what makes a group numbered — not `@type="quatrain"`. All
// 202 `lg` in the corpus are quatrains, so a `@type` gate would be a branch no
// document exercises, which is the trap ADR-0016's own postscript warns about.
//
// The number lives in a child span, never in the `lg`'s own text children:
// highlighting counts a word's offsets against the text nodes whose parent IS
// the anchor (wordRange.ts), so a bare `4` there would shift every offset in
// the group — the same reason `supplied`'s ⟨⟩ are nested.
export function Lg({ node, children, anchorId }: TEIElementProps) {
  const n = node.attrs?.n;
  return (
    <div className="relative my-3 pl-4" data-tei-anchor-id={anchorId} data-tei-n={n}>
      {n && (
        <span className="absolute left-0 top-0 select-none" data-tei-lg-n={n}>
          {n}
        </span>
      )}
      {children}
    </div>
  );
}

export function Ab({ children, anchorId }: TEIElementProps) {
  return <p className="mb-3 leading-relaxed" data-tei-anchor-id={anchorId}>{children}</p>;
}

export function Opener({ children, anchorId }: TEIElementProps) {
  return <div className="mb-2" data-tei-anchor-id={anchorId}>{children}</div>;
}

export function Closer({ children, anchorId }: TEIElementProps) {
  return <div className="mt-2" data-tei-anchor-id={anchorId}>{children}</div>;
}

export function Dateline({ children, anchorId }: TEIElementProps) {
  return <div className="mb-2" data-tei-anchor-id={anchorId}>{children}</div>;
}

export function Salute({ children, anchorId }: TEIElementProps) {
  return <span className="block" data-tei-anchor-id={anchorId}>{children}</span>;
}

export function Signed({ children, anchorId }: TEIElementProps) {
  return <span className="block" data-tei-anchor-id={anchorId}>{children}</span>;
}

export function Trailer({ children, anchorId }: TEIElementProps) {
  return <p className="mb-3" data-tei-anchor-id={anchorId}>{children}</p>;
}

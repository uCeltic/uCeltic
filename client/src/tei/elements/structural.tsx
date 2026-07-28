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
export function Lg({ children, anchorId }: TEIElementProps) {
  return <div className="my-3 pl-4" data-tei-anchor-id={anchorId}>{children}</div>;
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

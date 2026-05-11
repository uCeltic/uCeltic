import type { TEIElementProps } from "../elementMap";

export function Div({ children, anchorId }: TEIElementProps) {
  return <div data-tei-anchor-id={anchorId}>{children}</div>;
}

export function P({ children, anchorId }: TEIElementProps) {
  return <p className="mb-3 leading-relaxed" data-tei-anchor-id={anchorId}>{children}</p>;
}

export function Head({ children, anchorId }: TEIElementProps) {
  return <h3 className="mt-4 mb-2 font-semibold text-gray-900" data-tei-anchor-id={anchorId}>{children}</h3>;
}

export function L({ node, children, anchorId }: TEIElementProps) {
  return (
    <span className="block" data-tei-anchor-id={anchorId} data-tei-n={node.attrs?.n}>
      {children}
    </span>
  );
}

export function Lg({ children, anchorId }: TEIElementProps) {
  return <div className="my-3 border-l-2 border-gray-200 pl-4" data-tei-anchor-id={anchorId}>{children}</div>;
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
  return <div className="mb-2 text-sm text-gray-500" data-tei-anchor-id={anchorId}>{children}</div>;
}

export function Salute({ children, anchorId }: TEIElementProps) {
  return <span className="block" data-tei-anchor-id={anchorId}>{children}</span>;
}

export function Signed({ children, anchorId }: TEIElementProps) {
  return <span className="block italic" data-tei-anchor-id={anchorId}>{children}</span>;
}

export function Trailer({ children, anchorId }: TEIElementProps) {
  return <p className="mb-3 italic text-gray-600" data-tei-anchor-id={anchorId}>{children}</p>;
}

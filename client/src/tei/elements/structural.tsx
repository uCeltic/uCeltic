import type { TEIElementProps } from "../elementMap";

export function Div({ children }: TEIElementProps) {
  return <div>{children}</div>;
}

export function P({ children }: TEIElementProps) {
  return <p className="mb-3 leading-relaxed">{children}</p>;
}

export function Head({ children }: TEIElementProps) {
  return <h3 className="mt-4 mb-2 font-semibold text-gray-900">{children}</h3>;
}

export function L({ node, children }: TEIElementProps) {
  return (
    <span className="block" data-tei-n={node.attrs?.n}>
      {children}
    </span>
  );
}

export function Lg({ children }: TEIElementProps) {
  return <div className="my-3 border-l-2 border-gray-200 pl-4">{children}</div>;
}

export function Ab({ children }: TEIElementProps) {
  return <p className="mb-3 leading-relaxed">{children}</p>;
}

export function Opener({ children }: TEIElementProps) {
  return <div className="mb-2">{children}</div>;
}

export function Closer({ children }: TEIElementProps) {
  return <div className="mt-2">{children}</div>;
}

export function Dateline({ children }: TEIElementProps) {
  return <div className="mb-2 text-sm text-gray-500">{children}</div>;
}

export function Salute({ children }: TEIElementProps) {
  return <span className="block">{children}</span>;
}

export function Signed({ children }: TEIElementProps) {
  return <span className="block italic">{children}</span>;
}

export function Trailer({ children }: TEIElementProps) {
  return <p className="mb-3 italic text-gray-600">{children}</p>;
}

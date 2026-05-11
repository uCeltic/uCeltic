import type { TEIElementProps } from "../elementMap";

export function Choice({ children, anchorId }: TEIElementProps) {
  return <span data-tei-tag="choice" data-tei-anchor-id={anchorId}>{children}</span>;
}

export function Abbr({ node, children, anchorId }: TEIElementProps) {
  return (
    <abbr className="hidden" title={node.attrs?.type} data-tei-tag="abbr" data-tei-anchor-id={anchorId}>
      {children}
    </abbr>
  );
}

export function Expan({ children, anchorId }: TEIElementProps) {
  return <span data-tei-tag="expan" data-tei-anchor-id={anchorId}>{children}</span>;
}

export function Ex({ children, anchorId }: TEIElementProps) {
  return (
    <span className="italic text-gray-500" data-tei-tag="ex" data-tei-anchor-id={anchorId}>
      {children}
    </span>
  );
}

export function Sic({ children, anchorId }: TEIElementProps) {
  return (
    <span
      className="underline decoration-red-400 decoration-wavy"
      data-tei-tag="sic"
      data-tei-anchor-id={anchorId}
      title="sic"
    >
      {children}
    </span>
  );
}

export function Corr({ children, anchorId }: TEIElementProps) {
  return <span data-tei-tag="corr" data-tei-anchor-id={anchorId}>{children}</span>;
}

export function App({ children, anchorId }: TEIElementProps) {
  return <span data-tei-tag="app" data-tei-anchor-id={anchorId}>{children}</span>;
}

export function Lem({ children, anchorId }: TEIElementProps) {
  return <span data-tei-tag="lem" data-tei-anchor-id={anchorId}>{children}</span>;
}

export function Rdg({ node, children, anchorId }: TEIElementProps) {
  return (
    <span className="hidden" data-tei-tag="rdg" data-tei-anchor-id={anchorId} data-tei-wit={node.attrs?.wit}>
      {children}
    </span>
  );
}

export function Note({ children, anchorId }: TEIElementProps) {
  return (
    <span className="group relative inline-block" data-tei-tag="note" data-tei-anchor-id={anchorId}>
      <sup className="cursor-help select-none text-xs text-blue-500">*</sup>
      <span
        className="pointer-events-none absolute bottom-full left-0 z-10 hidden w-48 rounded
          bg-gray-800 p-2 text-xs leading-4 text-white shadow-lg group-hover:block"
      >
        {children}
      </span>
    </span>
  );
}

export function HandShift() {
  return null;
}

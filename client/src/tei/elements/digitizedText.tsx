import type { TEIElementProps } from "../elementMap";

//define how the tei tags are rendered in the html page

export function Pb({ node, anchorId }: TEIElementProps) {
  const n = node.attrs?.n;
  return (
    <div
      className="my-4 flex items-center gap-2 text-xs text-gray-400 select-none"
      data-tei-tag="pb"
      data-tei-anchor-id={anchorId}
      data-tei-n={n}
    >
      <hr className="flex-1 border-gray-200" />
      {n && <span>p.&nbsp;{n}</span>}
      <hr className="flex-1 border-gray-200" />
    </div>
  );
}

export function Lb() {
  return <br />;
}

export function Rubric({ children, anchorId }: TEIElementProps) {
  return <span className="font-medium text-red-700" data-tei-anchor-id={anchorId}>{children}</span>;
}

export function Supplied({ node, children, anchorId }: TEIElementProps) {
  return (
    <span
      className="text-gray-500"
      data-tei-tag="supplied"
      data-tei-anchor-id={anchorId}
      title={`supplied${node.attrs?.reason ? ": " + node.attrs.reason : ""}`}
    >
      ⟨{children}⟩
    </span>
  );
}

export function Surplus({ children, anchorId }: TEIElementProps) {
  return (
    <del className="opacity-40" data-tei-tag="surplus" data-tei-anchor-id={anchorId}>
      {children}
    </del>
  );
}

export function Gap({ node, anchorId }: TEIElementProps) {
  const extent = node.attrs?.extent;
  const label = extent ? `…${extent}…` : "…";
  return (
    <span className="font-mono text-gray-400" data-tei-tag="gap" data-tei-anchor-id={anchorId}>
      [{label}]
    </span>
  );
}

export function LacunaStart({ anchorId }: TEIElementProps) {
  return <span className="font-mono text-amber-600" data-tei-tag="lacunaStart" data-tei-anchor-id={anchorId}>[*</span>;
}

export function LacunaEnd({ anchorId }: TEIElementProps) {
  return <span className="font-mono text-amber-600" data-tei-tag="lacunaEnd" data-tei-anchor-id={anchorId}>*]</span>;
}

export function Damage({ children, anchorId }: TEIElementProps) {
  return (
    <span className="underline decoration-amber-400 decoration-wavy" data-tei-tag="damage" data-tei-anchor-id={anchorId}>
      {children}
    </span>
  );
}

export function Unclear({ children, anchorId }: TEIElementProps) {
  return (
    <span className="opacity-60" data-tei-tag="unclear" data-tei-anchor-id={anchorId} title="unclear">
      {children}
    </span>
  );
}

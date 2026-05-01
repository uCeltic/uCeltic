import type { TEIElementProps } from "../elementMap";

export function Pb({ node }: TEIElementProps) {
  const n = node.attrs?.n;
  return (
    <div
      className="my-4 flex items-center gap-2 text-xs text-gray-400 select-none"
      data-tei-tag="pb"
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

export function Rubric({ children }: TEIElementProps) {
  return <span className="font-medium text-red-700">{children}</span>;
}

export function Supplied({ node, children }: TEIElementProps) {
  return (
    <span
      className="text-gray-500"
      data-tei-tag="supplied"
      title={`supplied${node.attrs?.reason ? ": " + node.attrs.reason : ""}`}
    >
      ⟨{children}⟩
    </span>
  );
}

export function Surplus({ children }: TEIElementProps) {
  return (
    <del className="opacity-40" data-tei-tag="surplus">
      {children}
    </del>
  );
}

export function Gap({ node }: TEIElementProps) {
  const extent = node.attrs?.extent;
  const label = extent ? `…${extent}…` : "…";
  return (
    <span className="font-mono text-gray-400" data-tei-tag="gap">
      [{label}]
    </span>
  );
}

export function LacunaStart() {
  return <span className="font-mono text-amber-600" data-tei-tag="lacunaStart">[*</span>;
}

export function LacunaEnd() {
  return <span className="font-mono text-amber-600" data-tei-tag="lacunaEnd">*]</span>;
}

export function Damage({ children }: TEIElementProps) {
  return (
    <span className="underline decoration-amber-400 decoration-wavy" data-tei-tag="damage">
      {children}
    </span>
  );
}

export function Unclear({ children }: TEIElementProps) {
  return (
    <span className="opacity-60" data-tei-tag="unclear" title="unclear">
      {children}
    </span>
  );
}

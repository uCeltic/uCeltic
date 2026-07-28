import type { TEIElementProps } from "../elementMap";
import { rendClasses } from "./rend";

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
      {/* The brackets are the editor's mark, not the manuscript's text, so they
          are kept out of this anchor's direct text children. Highlighting reads
          a word's character offsets against exactly those children (wordRange
          .ts), and the backend counted only what the manuscript has. Inlining
          these back into the span shifts every offset inside a `supplied` by
          one — `supplied` cuts a word in half 35 times in the built-in corpus
          alone. */}
      <span>⟨</span>{children}<span>⟩</span>
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

export function Cb({ node, anchorId }: TEIElementProps) {
  // `xml:id` arrives as plain `id` — the backend strips namespaces off attribute
  // names (parse.py). It carries the folio-and-column locator the reader wants
  // (`fol.27vb`), so it is shown and exposed as `data-tei-id`, and deliberately
  // NOT spread onto the DOM node: an `id` of that name would land in the
  // document's own id space and collide.
  //
  // Prefer it as the label: it names the folio *and* the column (`fol.27vb`),
  // where `@n` alone is a bare `1` or `2`. A bare digit dropped into a verse
  // line reads as manuscript text, so when that is all there is, `pb`'s shape
  // is followed and the number is prefixed.
  const n = node.attrs?.n;
  const xmlId = node.attrs?.id;
  const label = xmlId ?? (n && `col. ${n}`);
  return (
    <span
      className="mx-1 inline-flex items-baseline gap-1 align-baseline text-[0.7rem] text-gray-400 select-none"
      data-tei-tag="cb"
      data-tei-anchor-id={anchorId}
      data-tei-n={n}
      data-tei-id={xmlId}
      data-tei-ed-ref={node.attrs?.edRef}
      title={`column break${label ? ": " + label : ""}`}
    >
      {/* Lighter than the `pb` rule: a column boundary interrupts the reading
          line, it does not end the page. */}
      <span aria-hidden="true" className="text-gray-300">‖</span>
      {label && <span>{label}</span>}
    </span>
  );
}

export function Del({ node, children, anchorId }: TEIElementProps) {
  // The one element here that used to actively misinform: struck-out text fell
  // through to PassThrough and read as part of the text (#146).
  //
  // The strike is unconditional — a `del` is deleted whatever `@rend` says, and
  // the corpus's own `strikethrough` only restates that. Any *other* rendition
  // the editor recorded is layered on top: `@rend` means the same thing here as
  // it does on `hi`.
  const rend = node.attrs?.rend;
  return (
    <del
      className={["line-through decoration-gray-500 opacity-70", ...rendClasses(rend)].join(" ")}
      data-tei-tag="del"
      data-tei-anchor-id={anchorId}
      data-tei-rend={rend}
      title={`deleted${rend ? ": " + rend : ""}`}
    >
      {children}
    </del>
  );
}

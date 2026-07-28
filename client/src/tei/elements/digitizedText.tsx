import type { TEIElementProps } from "../elementMap";

//define how the tei tags are rendered in the html page
//
// #153 — none of these decorate the manuscript's text. What they do add is the
// handful of editorial characters a print edition would also carry (`⟨⟩`, `[…]`,
// `[* *]`, `‖`) and the `data-tei-*` attributes the DOM is here to hold.

export function Pb({ node, anchorId }: TEIElementProps) {
  // `@n` goes out verbatim. It is a page number in one manuscript and a
  // folio-column-line locator (`124ra1`) in the next, so any fixed prefix is
  // wrong for someone — and where the prefix is already in the data, a second
  // one read `p. p.35`.
  const n = node.attrs?.n;
  return (
    <div
      className="my-4 select-none"
      data-tei-tag="pb"
      data-tei-anchor-id={anchorId}
      data-tei-n={n}
    >
      {n && <span>{n}</span>}
    </div>
  );
}

export function Lb() {
  return <br />;
}

// `data-tei-tag` so a rubric is still findable in the DOM now that nothing
// paints it — that is the whole premise of dropping the styling.
export function Rubric({ children, anchorId }: TEIElementProps) {
  return <span data-tei-tag="rubric" data-tei-anchor-id={anchorId}>{children}</span>;
}

export function Supplied({ node, children, anchorId }: TEIElementProps) {
  return (
    <span
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

// A `<del>`, so the browser's own strike-through says "the editor holds this to
// be superfluous" without a class of ours.
export function Surplus({ children, anchorId }: TEIElementProps) {
  return (
    <del data-tei-tag="surplus" data-tei-anchor-id={anchorId}>
      {children}
    </del>
  );
}

export function Gap({ node, anchorId }: TEIElementProps) {
  const extent = node.attrs?.extent;
  const label = extent ? `…${extent}…` : "…";
  return (
    <span data-tei-tag="gap" data-tei-anchor-id={anchorId}>
      [{label}]
    </span>
  );
}

export function LacunaStart({ anchorId }: TEIElementProps) {
  return <span data-tei-tag="lacunaStart" data-tei-anchor-id={anchorId}>[*</span>;
}

export function LacunaEnd({ anchorId }: TEIElementProps) {
  return <span data-tei-tag="lacunaEnd" data-tei-anchor-id={anchorId}>*]</span>;
}

export function Damage({ children, anchorId }: TEIElementProps) {
  return (
    <span data-tei-tag="damage" data-tei-anchor-id={anchorId} title="damaged">
      {children}
    </span>
  );
}

export function Unclear({ children, anchorId }: TEIElementProps) {
  return (
    <span data-tei-tag="unclear" data-tei-anchor-id={anchorId} title="unclear">
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
  // Preferred as the label because it names the folio *and* the column, where
  // `@n` alone may be a bare `1`. When `@n` is all there is it goes out raw,
  // like `pb`'s: the research manuscripts put the prefix in the data already, so
  // adding `col. ` produced `col. p.35b`.
  const n = node.attrs?.n;
  const xmlId = node.attrs?.id;
  const label = xmlId ?? n;
  return (
    <span
      className="mx-1 inline-flex items-baseline gap-1 align-baseline select-none"
      data-tei-tag="cb"
      data-tei-anchor-id={anchorId}
      data-tei-n={n}
      data-tei-id={xmlId}
      data-tei-ed-ref={node.attrs?.edRef}
      title={`column break${label ? ": " + label : ""}`}
    >
      <span aria-hidden="true">‖</span>
      {label && <span>{label}</span>}
    </span>
  );
}

export function Del({ node, children, anchorId }: TEIElementProps) {
  // The one element here that used to actively misinform: struck-out text fell
  // through to PassThrough and read as part of the text (#146).
  //
  // It is a `<del>`, and the browser strikes a `<del>` through on its own — the
  // deletion is the document's, so it survives the styling coming off. `@rend`
  // still reaches the DOM; nothing acts on it.
  const rend = node.attrs?.rend;
  return (
    <del
      data-tei-tag="del"
      data-tei-anchor-id={anchorId}
      data-tei-rend={rend}
      title={`deleted${rend ? ": " + rend : ""}`}
    >
      {children}
    </del>
  );
}

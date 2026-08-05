import type { TEIElementProps } from "../elementMap";

//define how the tei tags are rendered in the html page
//
// #153 — none of these decorate the manuscript's text. What they do add is the
// handful of editorial characters a print edition would also carry (`⟨⟩`, `[…]`,
// `[* *]`) and the `data-tei-*` attributes the DOM is here to hold.
//
// #165 (ADR-0018) — `pb` and `cb` are editorial locators, and the printed
// edition sets them the way `MANUSCRIPT_LOCATOR` and `PRINT_LOCATOR` do below.

// Bold inside square brackets: the manuscript's own folio or column
// (`[fol.124ra]`, `[p.36b]`). Inline, because every one of these sits
// mid-sentence — `í ó sin <pb/> amach go`, and several inside an `<l>`.
const MANUSCRIPT_LOCATOR = "mx-1 font-bold select-none";

// A tinted box and no brackets: a page of Stokes's printed edition, a different
// coordinate system from the manuscript's. The box rather than the brackets is
// what tells the two apart on the page.
const PRINT_EDITION_LOCATOR = "mx-1 rounded bg-stone-200 px-1 select-none";

export function Pb({ node, anchorId, followedByCb }: TEIElementProps) {
  // Two coordinate systems, told apart by which attribute the break carries.
  //
  // `@n` (with `@edRef`) locates the MANUSCRIPT's page. It goes out verbatim: it
  // is `p.35` in one manuscript and `fol.124` in the next, so any fixed prefix
  // is wrong for someone — and where the prefix is already in the data, a second
  // one read `p. p.35`. The brackets are not a prefix; they are the editor's
  // mark, and they wrap whatever the value says.
  //
  // `xml:id` locates a page of Stokes's PRINTED EDITION. It is shown verbatim
  // too, underscore and all — `Stokes_p.69`, with nothing added and no substring
  // parsed out. Parsing here is the same class of risk as the prefix was.
  //
  // `xml:id` arrives as plain `id`, because the backend strips namespaces off
  // attribute names (parse.py), and it is deliberately NOT spread onto the DOM
  // node: an `id` of that name would land in the document's own id space.
  const n = node.attrs?.n;
  const xmlId = node.attrs?.id;

  // A page break whose next sibling element is a column break is not shown. In
  // all 9 corpus cases the `cb`'s `@n` extends the `pb`'s (`fol.124` →
  // `fol.124ra`, `p.35` → `p.35b`), so showing both reads `[fol.124][fol.124ra]`
  // and the column locator already says everything the page locator said. It
  // stays in the DOM under `hidden`, because ADR-0016's surviving premise is
  // that the markup must be present — `abbr` and `rdg` are hidden the same way.
  const className = followedByCb
    ? "hidden"
    : xmlId
      ? PRINT_EDITION_LOCATOR
      : MANUSCRIPT_LOCATOR;

  // The tooltip names the coordinate system, not the tag. "Page break" is what
  // `pb` is; it is not what the reader is being handed, and on the `xml:id`
  // branch it would call a page of a modern printed book a break in the
  // manuscript (CONTEXT.md → Print-Edition Locator, _Avoid_).
  const title = xmlId
    ? `printed edition, page ${xmlId}`
    : n
      ? `manuscript page ${n}`
      : "page break";

  return (
    <span
      className={className}
      data-tei-tag="pb"
      data-tei-anchor-id={anchorId}
      data-tei-n={n}
      data-tei-id={xmlId}
      data-tei-ed-ref={node.attrs?.edRef}
      title={title}
    >
      {/* Nested, never this anchor's own text children: highlighting counts a
          word's offsets against the text nodes whose parent IS the anchor
          (wordRange.ts), the way `supplied`'s ⟨⟩ are kept out. */}
      {xmlId ? (
        <span data-tei-print-edition-page="">{xmlId}</span>
      ) : (
        n && <span>[{n}]</span>
      )}
    </span>
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
    <span data-tei-tag="damage" data-tei-anchor-id={anchorId}>
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
  // Every `cb` in the corpus locates the MANUSCRIPT's column, so this is always
  // the bracketed locator — there is no print-edition column break to tell it
  // apart from, the way `pb` has one.
  //
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
  //
  // The `‖` ADR-0016 kept is gone (#165). It was there because a lone digit
  // inside a verse line reads as manuscript text and nothing else marked the
  // break; the brackets and the weight are that mark now, and `‖[p.35b]` says
  // the same thing twice.
  const n = node.attrs?.n;
  const xmlId = node.attrs?.id;
  const label = xmlId ?? n;
  return (
    <span
      className={MANUSCRIPT_LOCATOR}
      data-tei-tag="cb"
      data-tei-anchor-id={anchorId}
      data-tei-n={n}
      data-tei-id={xmlId}
      data-tei-ed-ref={node.attrs?.edRef}
      title={label ? `manuscript column ${label}` : "column break"}
    >
      {/* Nested for the same reason `pb`'s and `supplied`'s marks are. */}
      {label && <span>[{label}]</span>}
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

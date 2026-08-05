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

// The letters the editor supplied when expanding an abbreviation — italic, the
// way a printed diplomatic edition of this text sets them (#165, ADR-0018).
//
// This corpus uses `<expan>` non-standardly: it wraps the supplied letters
// inline inside a word (`rīa<expan>n</expan>`) rather than containing an
// `abbr` + `ex` pair, and there is no `abbr`, `ex` or `choice` in any of the
// four files. So the italic lands on exactly the letters the manuscript did not
// write, which is what the convention is for. 2767 of them: the effect is
// conspicuous, and that is the edition being faithful rather than a bug.
export function Expan({ children, anchorId }: TEIElementProps) {
  return <span className="italic" data-tei-tag="expan" data-tei-anchor-id={anchorId}>{children}</span>;
}

// The letters the editor supplied when expanding an abbreviation. They used to
// be set in grey italics; the `data-tei-tag` is what marks them now (#153).
export function Ex({ children, anchorId }: TEIElementProps) {
  return (
    <span data-tei-tag="ex" data-tei-anchor-id={anchorId}>
      {children}
    </span>
  );
}

export function Sic({ children, anchorId }: TEIElementProps) {
  return (
    <span data-tei-tag="sic" data-tei-anchor-id={anchorId} title="sic">
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

// `Note` lives in `./note` — the marker opens a panel that is portalled out of
// the column, which gave it behaviour of its own to keep somewhere (#166).

export function HandShift() {
  return null;
}

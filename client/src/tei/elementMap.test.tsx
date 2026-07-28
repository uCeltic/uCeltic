/**
 * #146 — the five elements that used to fall through to `PassThrough`, and
 * #153, which took the presentational styling back off them and stopped `pb`
 * and `cb` prefixing a locator the data already carries.
 *
 * They are rendered through the real `TEIRenderer`, not called directly, because
 * half of what the fix has to get right lives in the wiring: an element only
 * stops being a bare `<span>` once `elementMap` names it, and each one has to
 * keep carrying the `data-tei-anchor-id` that highlighting looks it up by.
 *
 * That no mapped element decorates the text is a policy over the whole map, so
 * it is asserted there rather than here — see `presentation.test.tsx`.
 */
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import TEIRenderer from "./TEIRenderer";
import type { TEIElementNode, TEINode } from "../types/tei";

// A whole word, the shape `parse_tei` emits for one.
function text(s: string): TEINode {
  return { type: "text", segments: [{ kind: "word", text: s, idx: 0 }] };
}

function el(tag: string, attrs: Record<string, string>, ...children: TEINode[]): TEIElementNode {
  return { tag, attrs, children };
}

// Wrap in the minimal document the renderer expects, so anchor ids are assigned
// exactly as they are in a real file.
function renderTEI(...body: TEINode[]) {
  return render(<TEIRenderer node={el("TEI", {}, el("text", {}, el("body", {}, el("p", {}, ...body))))} />);
}

function tagged(container: HTMLElement, tag: string): HTMLElement {
  const found = container.querySelector<HTMLElement>(`[data-tei-tag="${tag}"]`);
  if (!found) throw new Error(`no element rendered with data-tei-tag="${tag}"`);
  return found;
}

describe("del", () => {
  // #153 — the strike-through is the browser's, not a class of ours. A `<del>`
  // is struck through by the user agent's own stylesheet, so the deletion
  // survives the presentational styling coming off every other element.
  it("strikes deleted text through, as a <del>", () => {
    const { container } = renderTEI(el("del", { rend: "strikethrough" }, text("scriptum")));
    const del = tagged(container, "del");

    expect(del.tagName).toBe("DEL");
    expect(del).toHaveTextContent("scriptum");
  });

  it("still marks the text as deleted when @rend says nothing", () => {
    const { container } = renderTEI(el("del", {}, text("scriptum")));
    expect(tagged(container, "del").tagName).toBe("DEL");
  });

  it("records @rend on the DOM without acting on it", () => {
    const { container } = renderTEI(el("del", { rend: "italic" }, text("scriptum")));
    expect(tagged(container, "del").dataset.teiRend).toBe("italic");
  });

  it("adds no characters of its own — a word's offsets are counted against them", () => {
    const { container } = renderTEI(el("del", { rend: "strikethrough" }, text("scriptum")));
    expect(tagged(container, "del").textContent).toBe("scriptum");
  });
});

describe("hi", () => {
  // #153 — `hi` puts `@rend` on the DOM and renders the text plainly. The class
  // table it used to consult is gone, so the value reaches the page whole rather
  // than as whichever tokens a lookup recognised.
  it("puts @rend on the DOM whatever it says, and renders the text plainly", () => {
    for (const rend of ["decor", "italic", "ital", "superscript", "large", "italic center"]) {
      const { container, unmount } = renderTEI(el("hi", { rend }, text("uerbum")));
      const hi = tagged(container, "hi");

      expect(hi.dataset.teiRend).toBe(rend);
      expect(hi).toHaveTextContent("uerbum");
      unmount();
    }
  });

  it("renders an unknown or absent @rend as plain text, not as a bare fallback", () => {
    const { container } = renderTEI(el("hi", { rend: "turnover" }, text("uerbum")));
    const hi = tagged(container, "hi");

    expect(hi.dataset.teiRend).toBe("turnover");
    expect(hi.textContent).toBe("uerbum");
  });

  it("adds no characters of its own", () => {
    const { container } = renderTEI(el("hi", { rend: "decor" }, text("A")));
    expect(tagged(container, "hi").textContent).toBe("A");
  });
});

describe("cb", () => {
  it("makes the column break visible and shows its locator", () => {
    const { container } = renderTEI(
      text("prima"),
      // `xml:id` reaches the frontend as `id` — the backend strips namespaces
      // from attribute names (parse.py).
      el("cb", { n: "2", id: "fol.27vb", edRef: "#Laud" }),
      text("secunda"),
    );
    const cb = tagged(container, "cb");

    expect(cb.dataset.teiN).toBe("2");
    expect(cb.dataset.teiId).toBe("fol.27vb");
    expect(cb).toHaveTextContent("fol.27vb");
  });

  it("never leaks @xml:id into the document's own id space", () => {
    const { container } = renderTEI(el("cb", { n: "2", id: "fol.27vb" }));
    expect(container.querySelector("#fol\\.27vb")).toBeNull();
    expect(tagged(container, "cb").id).toBe("");
  });

  it("falls back to @n verbatim, prefixing nothing", () => {
    // #153 — the research manuscripts put the prefix in the data (`n="p.35b"`),
    // so `col. ` on top of it read `col. p.35b`. The built-in corpus's `cb`
    // carries a bare `1`. No fixed prefix is right for both, so none is added
    // and `‖` is left to mark the break.
    const { container } = renderTEI(el("cb", { n: "p.35b" }));
    const cb = tagged(container, "cb");

    expect(cb.textContent).toContain("p.35b");
    expect(cb.textContent).not.toContain("col.");
  });

  it("stays inline so it does not break the paragraph it sits inside", () => {
    const { container } = renderTEI(text("prima"), el("cb", { n: "2" }), text("secunda"));
    const p = container.querySelector("p");

    expect(p?.querySelector('[data-tei-tag="cb"]')).not.toBeNull();
    expect(tagged(container, "cb").tagName).toBe("SPAN");
  });
});

describe("pb", () => {
  // #153 — `@n` is a page number in one manuscript and a folio-column-line
  // locator in the next (`124ra1`), and where the transcriber wrote the prefix
  // into the data the pane read `p. p.35`. It goes out as it came in.
  it.each(["p.35", "127.20", "124ra1"])("shows @n=%s verbatim", (n) => {
    const { container } = renderTEI(el("pb", { n }));
    const pb = tagged(container, "pb");

    expect(pb.textContent).toBe(n);
    expect(pb.dataset.teiN).toBe(n);
  });

  it("shows nothing at all when there is no @n to show", () => {
    const { container } = renderTEI(el("pb", {}));
    expect(tagged(container, "pb").textContent).toBe("");
  });
});

describe("addName", () => {
  it("is marked up as a name", () => {
    const { container } = renderTEI(el("addName", { nymRef: "E15" }, text("Mac Cumaill")));
    const addName = tagged(container, "addName");

    // The markup, not a style: `data-tei-entity` is what the Tag Filter finds
    // names by (#147), and what an opt-in highlight would key off (#153).
    expect(addName.dataset.teiEntity).toBe("");
    expect(addName.dataset.teiNymRef).toBe("E15");
    expect(addName).toHaveTextContent("Mac Cumaill");
  });

  it("adds no characters of its own", () => {
    const { container } = renderTEI(el("addName", { nymRef: "E15" }, text("Mac Cumaill")));
    expect(tagged(container, "addName").textContent).toBe("Mac Cumaill");
  });
});

describe("c", () => {
  it("passes the character through unchanged, but mapped rather than fallen back to", () => {
    const { container } = renderTEI(el("c", { type: "kk" }, text("ᚈ")));
    const c = tagged(container, "c");

    expect(c.textContent).toBe("ᚈ");
    expect(c.dataset.teiType).toBe("kk");
    expect(c.className).toBe("");
  });
});

describe("anchor ids", () => {
  it("are unchanged by the new components — every element still carries its own", () => {
    const { container } = renderTEI(
      el("del", { rend: "strikethrough" }, text("a")),
      el("hi", { rend: "decor" }, text("b")),
      el("cb", { n: "2", id: "fol.27vb" }),
      el("addName", { nymRef: "E15" }, text("c")),
      el("c", { type: "kk" }, text("d")),
    );

    // TEI(0) → text(1) → body(2) → p(3) → the five children in document order.
    const ids = ["del", "hi", "cb", "addName", "c"].map(
      (tag) => tagged(container, tag).dataset.teiAnchorId,
    );
    expect(ids).toEqual(["4", "5", "6", "7", "8"]);
  });
});

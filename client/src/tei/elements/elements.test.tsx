/**
 * #146 — the five elements that used to fall through to `PassThrough`.
 *
 * They are rendered through the real `TEIRenderer`, not called directly, because
 * half of what the fix has to get right lives in the wiring: an element only
 * stops being a bare `<span>` once `elementMap` names it, and each one has to
 * keep carrying the `data-tei-anchor-id` that highlighting looks it up by.
 */
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import TEIRenderer from "../TEIRenderer";
import type { TEIElementNode, TEINode } from "../../types/tei";

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
  it("strikes deleted text through", () => {
    const { container } = renderTEI(el("del", { rend: "strikethrough" }, text("scriptum")));
    const del = tagged(container, "del");

    expect(del.tagName).toBe("DEL");
    expect(del.className).toContain("line-through");
    expect(del).toHaveTextContent("scriptum");
  });

  it("still marks the text as deleted when @rend says nothing", () => {
    const { container } = renderTEI(el("del", {}, text("scriptum")));
    expect(tagged(container, "del").className).toContain("line-through");
  });

  it("adds no characters of its own — a word's offsets are counted against them", () => {
    const { container } = renderTEI(el("del", { rend: "strikethrough" }, text("scriptum")));
    expect(tagged(container, "del").textContent).toBe("scriptum");
  });
});

describe("hi", () => {
  it("renders @rend=decor as a visually distinct initial", () => {
    const { container } = renderTEI(el("hi", { rend: "decor" }, text("A")));
    const hi = tagged(container, "hi");

    expect(hi.dataset.teiRend).toBe("decor");
    expect(hi.className).toContain("text-3xl");
    expect(hi).toHaveTextContent("A");
  });

  it("renders italic rends as italic — both spellings the corpus uses", () => {
    for (const rend of ["italic", "ital"]) {
      const { container, unmount } = renderTEI(el("hi", { rend }, text("uerbum")));
      expect(tagged(container, "hi").className).toContain("italic");
      unmount();
    }
  });

  it("renders superscript and large rends distinctly", () => {
    const sup = renderTEI(el("hi", { rend: "superscript" }, text("x")));
    expect(tagged(sup.container, "hi").className).toContain("align-super");
    sup.unmount();

    const large = renderTEI(el("hi", { rend: "large" }, text("x")));
    expect(tagged(large.container, "hi").className).toContain("text-lg");
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

  it("falls back to @n when there is no @xml:id", () => {
    const { container } = renderTEI(el("cb", { n: "1" }));
    expect(tagged(container, "cb")).toHaveTextContent("1");
  });

  it("stays inline so it does not break the paragraph it sits inside", () => {
    const { container } = renderTEI(text("prima"), el("cb", { n: "2" }), text("secunda"));
    const p = container.querySelector("p");

    expect(p?.querySelector('[data-tei-tag="cb"]')).not.toBeNull();
    expect(tagged(container, "cb").tagName).toBe("SPAN");
  });
});

describe("addName", () => {
  it("is marked up as a name", () => {
    const { container } = renderTEI(el("addName", { nymRef: "E15" }, text("Mac Cumaill")));
    const addName = tagged(container, "addName");

    expect(addName.className).toContain("underline");
    expect(addName.className).toContain("decoration-dotted");
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

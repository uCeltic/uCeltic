/**
 * #146 — the five elements that used to fall through to `PassThrough`; #153,
 * which took the presentational styling back off them and stopped `pb` and `cb`
 * prefixing a locator the data already carries; and #165, which sets the four
 * conventions the printed edition of this text already uses.
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

// The whitespace between two elements in a pretty-printed file — a text node
// that says nothing about the manuscript.
function sep(s: string): TEINode {
  return { type: "text", segments: [{ kind: "sep", text: s }] };
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

describe("expan", () => {
  // #165 — the central convention of an Irish diplomatic edition. This corpus
  // uses `<expan>` non-standardly: it wraps the letters the editor supplied,
  // inline inside a word (`rīa<expan>n</expan>`), with no `abbr`/`ex`/`choice`
  // anywhere. Those letters are what a printed edition sets in italic.
  it("sets the letters the editor supplied in italic", () => {
    const { container } = renderTEI(el("expan", {}, text("n")));
    const expan = tagged(container, "expan");

    expect(expan.className).toContain("italic");
    expect(expan.textContent).toBe("n");
  });

  it("adds no characters of its own — a word's offsets are counted against them", () => {
    const { container } = renderTEI(text("rīa"), el("expan", {}, text("n")));
    expect(container.querySelector("p")?.textContent).toBe("rīan");
  });
});

describe("hi", () => {
  // #165 — every one of the corpus's 154 `hi` is `rend="decor"`, and a printed
  // edition sets those bold. `@rend` is the whitespace-separated token list TEI
  // says it is, so the match is on the token: one declared mapping, not the
  // class table ADR-0016 deleted.
  it("sets a decor span bold", () => {
    for (const rend of ["decor", "decor italic"]) {
      const { container, unmount } = renderTEI(el("hi", { rend }, text("C")));
      const hi = tagged(container, "hi");

      expect(hi.className, rend).toContain("font-bold");
      expect(hi.dataset.teiRend).toBe(rend);
      unmount();
    }
  });

  it("leaves any other @rend untouched, rather than guessing at it", () => {
    // An unseen value is left alone on purpose: mis-setting `italic` as bold is
    // the failure mode the deleted class table had. `decoratedCapital` is a
    // different token from `decor`, so it is one of these too.
    for (const rend of ["italic", "ital", "superscript", "large", "decoratedCapital"]) {
      const { container, unmount } = renderTEI(el("hi", { rend }, text("uerbum")));
      const hi = tagged(container, "hi");

      expect(hi.className, rend).toBe("");
      expect(hi.dataset.teiRend).toBe(rend);
      expect(hi).toHaveTextContent("uerbum");
      unmount();
    }
  });

  it("composes with expan — ĪA<expan>R</expan> is bold with the R bold-italic", () => {
    // Four of the corpus's `decor` spans contain an `expan`. The two rules are
    // independent, so they have to stack rather than one winning.
    const { container } = renderTEI(
      el("hi", { rend: "decor" }, text("ĪA"), el("expan", {}, text("R"))),
    );
    const hi = tagged(container, "hi");

    expect(hi.className).toContain("font-bold");
    expect(tagged(container, "expan").className).toContain("italic");
    expect(hi.textContent).toBe("ĪAR");
  });

  it("adds no characters of its own", () => {
    const { container } = renderTEI(el("hi", { rend: "decor" }, text("A")));
    expect(tagged(container, "hi").textContent).toBe("A");
  });
});

describe("lg", () => {
  // #165 — 202 `lg`, every one of them a quatrain carrying `@n`. A printed
  // edition hangs that number in the margin. The condition is having an `@n`,
  // not `@type="quatrain"`: gating on a type every element in the corpus shares
  // is a branch no document exercises.
  it("hangs @n outside the verse block, left of the verse's own left edge", () => {
    const { container } = renderTEI(el("lg", { type: "quatrain", n: "4" }, el("l", {}, text("uerbum"))));
    const lg = container.querySelector<HTMLElement>("[data-tei-n='4']")!;
    const number = lg.querySelector<HTMLElement>("[data-tei-lg-n]")!;

    expect(lg.dataset.teiN).toBe("4");
    expect(lg.className).toContain("relative");
    expect(lg.className).toContain("pl-4");
    expect(number.textContent).toBe("4");
    // Absolutely placed at the block's own left edge, which the `pl-4` puts
    // outside the verse. `select-none` keeps it out of a copied selection.
    expect(number.className).toContain("absolute");
    expect(number.className).toContain("left-0");
    expect(number.className).toContain("select-none");
  });

  it("numbers a group whatever its @type says, and an unnumbered group not at all", () => {
    const { container: numbered } = renderTEI(el("lg", { n: "7" }, el("l", {}, text("uerbum"))));
    expect(numbered.querySelector("[data-tei-lg-n]")?.textContent).toBe("7");

    const { container: bare } = renderTEI(el("lg", { type: "quatrain" }, el("l", {}, text("uerbum"))));
    expect(bare.querySelector("[data-tei-lg-n]")).toBeNull();
  });

  it("keeps the number out of the group's own text children, so offsets do not shift", () => {
    // Highlighting counts a word's characters against the text nodes whose
    // parent IS the anchor (wordRange.ts). A bare `4` there would shift every
    // offset in the group by one — the same trap `supplied`'s ⟨⟩ avoid.
    const { container } = renderTEI(el("lg", { n: "4" }, el("l", {}, text("uerbum"))));
    const lg = container.querySelector<HTMLElement>("[data-tei-n='4']")!;

    const ownText = [...lg.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE);
    expect(ownText.map((n) => n.textContent).join("")).toBe("");
  });
});

describe("cb", () => {
  // #165 — `cb` and a `pb edRef` are locators into the MANUSCRIPT's own folio
  // and column. A printed edition sets those bold in square brackets.
  it("makes the column break visible and shows its locator bracketed and bold", () => {
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
    expect(cb.textContent).toBe("[fol.27vb]");
    expect(cb.className).toContain("font-bold");
  });

  it("never leaks @xml:id into the document's own id space", () => {
    const { container } = renderTEI(el("cb", { n: "2", id: "fol.27vb" }));
    expect(container.querySelector("#fol\\.27vb")).toBeNull();
    expect(tagged(container, "cb").id).toBe("");
  });

  it("falls back to @n verbatim, prefixing nothing and parsing nothing out", () => {
    // #153 — the research manuscripts put the prefix in the data (`n="p.35b"`),
    // so `col. ` on top of it read `col. p.35b`. The brackets are not a prefix:
    // they are the editor's mark, and they wrap the value whatever it says.
    const { container } = renderTEI(el("cb", { n: "p.35b" }));
    const cb = tagged(container, "cb");

    expect(cb.textContent).toBe("[p.35b]");
    expect(cb.textContent).not.toContain("col.");
  });

  it("stays inline so it does not break the paragraph it sits inside", () => {
    const { container } = renderTEI(text("prima"), el("cb", { n: "2" }), text("secunda"));
    const p = container.querySelector("p");

    expect(p?.querySelector('[data-tei-tag="cb"]')).not.toBeNull();
    expect(tagged(container, "cb").tagName).toBe("SPAN");
  });

  it("keeps the brackets out of its own text children", () => {
    const { container } = renderTEI(el("cb", { n: "p.35b" }));
    const cb = tagged(container, "cb");

    const ownText = [...cb.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE);
    expect(ownText.map((n) => n.textContent).join("")).toBe("");
  });
});

describe("pb", () => {
  // #153 — `@n` is a page number in one manuscript and a folio-column-line
  // locator in the next (`124ra1`), and where the transcriber wrote the prefix
  // into the data the pane read `p. p.35`. It goes out as it came in; #165 adds
  // the editor's brackets around it, which are a mark rather than a prefix.
  it.each(["p.35", "127.20", "124ra1", "fol.124"])("shows @n=%s verbatim, bracketed", (n) => {
    const { container } = renderTEI(el("pb", { edRef: "G126", n }));
    const pb = tagged(container, "pb");

    expect(pb.textContent).toBe(`[${n}]`);
    expect(pb.dataset.teiN).toBe(n);
    expect(pb.className).toContain("font-bold");
  });

  it("sits inline, the way it sits in the document", () => {
    // Every `pb` in the corpus is mid-sentence (`í ó sin <pb/> amach go`) and
    // several are inside an `<l>`. A block-level page break cut both in half.
    const { container } = renderTEI(text("prima"), el("pb", { edRef: "G126", n: "p.128" }), text("secunda"));

    expect(tagged(container, "pb").tagName).toBe("SPAN");
    expect(container.querySelector("p")?.querySelector('[data-tei-tag="pb"]')).not.toBeNull();
  });

  it("shows a print-edition page verbatim in a tinted box, with no brackets", () => {
    // The second coordinate system: `xml:id` is a page of Stokes's printed
    // edition, not of the manuscript. Shown underscore and all — no prefix is
    // added and no substring is parsed out, which is the class of change that
    // produced `p. p.35`. The box, not brackets, is what tells the two apart.
    const { container } = renderTEI(el("pb", { id: "Stokes_p.69" }));
    const pb = tagged(container, "pb");

    expect(pb.textContent).toBe("Stokes_p.69");
    expect(pb.dataset.teiId).toBe("Stokes_p.69");
    expect(pb.querySelector("[data-tei-print-page]")).not.toBeNull();
    // The box is the tint and the padding; the brackets and the weight belong
    // to the other coordinate system, so neither is here.
    expect(pb.className).toMatch(/\bbg-\w+-\d{2,3}\b/);
    expect(pb.className).not.toContain("font-bold");
  });

  it("never leaks @xml:id into the document's own id space", () => {
    const { container } = renderTEI(el("pb", { id: "Stokes_p.69" }));
    expect(container.querySelector("#Stokes_p\\.69")).toBeNull();
    expect(tagged(container, "pb").id).toBe("");
  });

  it("shows nothing at all when there is no locator to show", () => {
    const { container } = renderTEI(el("pb", {}));
    expect(tagged(container, "pb").textContent).toBe("");
  });

  it("keeps the brackets out of its own text children", () => {
    const { container } = renderTEI(el("pb", { edRef: "G126", n: "p.128" }));
    const pb = tagged(container, "pb");

    const ownText = [...pb.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE);
    expect(ownText.map((n) => n.textContent).join("")).toBe("");
  });
});

describe("a page break the next column break already covers", () => {
  // #165 — 9 of the corpus's 18 `pb edRef` are immediately followed by a `cb`
  // whose `@n` extends theirs (`fol.124` → `fol.124ra`, `p.35` → `p.35b`), so
  // showing both reads `[fol.124][fol.124ra]`. The condition is adjacency, not
  // one value containing the other.
  it.each([
    ["directly adjacent", [] as TEINode[]],
    ["separated by the whitespace a pretty-printed file leaves", [sep("\n  ")]],
  ])("is not visible when %s, but is still in the DOM with its attributes intact", (_, between) => {
    const { container } = renderTEI(
      el("pb", { edRef: "Laud610", n: "fol.124" }),
      ...between,
      el("cb", { edRef: "Laud610", n: "fol.124ra" }),
      text("uerbum"),
    );
    const pb = tagged(container, "pb");

    expect(pb.className).toContain("hidden");
    expect(pb.dataset.teiN).toBe("fol.124");
    expect(pb.dataset.teiEdRef).toBe("Laud610");
    expect(pb.dataset.teiAnchorId).toBe("4");
    expect(tagged(container, "cb").textContent).toBe("[fol.124ra]");
  });

  it("still renders when nothing follows it, or when what follows is not a cb", () => {
    // G126 has no `cb` at all, and its 9 page breaks are the case that must not
    // regress.
    for (const after of [[], [el("lb", {})], [text("amach")]] as TEINode[][]) {
      const { container, unmount } = renderTEI(el("pb", { edRef: "G126", n: "p.128" }), ...after);

      expect(tagged(container, "pb").className).not.toContain("hidden");
      unmount();
    }
  });

  it("still renders when real text stands between it and the cb", () => {
    // That text is on the page the `pb` names and before the column the `cb`
    // names, so the column locator is no longer saying everything the page
    // locator said. Whitespace between them is not text of that kind.
    const { container } = renderTEI(
      el("pb", { edRef: "Laud610", n: "fol.124" }),
      text("uerbum"),
      el("cb", { edRef: "Laud610", n: "fol.124ra" }),
    );

    expect(tagged(container, "pb").className).not.toContain("hidden");
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

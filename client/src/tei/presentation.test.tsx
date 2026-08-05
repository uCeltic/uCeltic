/**
 * #165 — the reading pane sets the manuscript the way a printed diplomatic
 * edition of it does (ADR-0018), and this is the list of what that comes to.
 *
 * ADR-0016's premise survives: the markup's job is to be *there* in the DOM, and
 * every `data-tei-*` attribute still reaches the page. What it no longer says is
 * that nothing may be styled. The question it declined to answer element by
 * element — whose typography? — has a decidable answer now: the convention the
 * printed edition of this text already uses. So this suite inverted with it.
 *
 * It still walks `elementMap` itself rather than a hand-kept list of elements,
 * so an element added later is covered the day it is mapped. What changed is the
 * verdict: a mapped element may carry a style ADR-0018 names, and nothing else.
 * Adding one stays a decision — you argue with `ALLOWED` and the ADR behind it,
 * rather than reaching for a class.
 */
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { elementMap } from "./elementMap";
import type { TEIElementNode } from "../types/tei";

// Every attribute any mapped element reads, so each one renders the richest
// shape it has — `@rend` in particular selects `hi`'s one mapping.
const ATTRS = {
  rend: "decor italic",
  n: "p.35",
  ref: "#fionn",
  nymRef: "E15",
  type: "kk",
  wit: "#A",
  reason: "damage",
  edRef: "#Laud",
  extent: "2 words",
};

// `pb` renders one of two coordinate systems depending on whether it carries an
// `xml:id`, and they are styled differently, so both are walked. Anything else
// renders the same either way.
const VARIANTS: [string, Record<string, string>][] = [
  ["manuscript locator", ATTRS],
  ["print-edition locator", { ...ATTRS, id: "Stokes_p.69" }],
];

// Every way a Tailwind class can change how the text itself looks. Margins,
// padding, `display` and line-height are absent on purpose: layout and spacing
// were never the question.
const STYLES: [string, RegExp][] = [
  ["colour", /^(?:text|decoration|border|bg)-[a-z]+-\d{2,3}$/],
  ["arbitrary colour or size", /^(?:text|font|bg|decoration)-\[/],
  ["font size", /^text-(?:xs|sm|base|lg|[2-9]?xl)$/],
  ["font family", /^font-(?:sans|serif|mono)$/],
  ["font weight", /^font-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/],
  ["font style", /^(?:italic|not-italic)$/],
  ["text decoration", /^(?:underline|overline|line-through|no-underline)$|^decoration-/],
  ["letter case or spacing", /^(?:uppercase|lowercase|capitalize)$|^tracking-/],
  ["raised or lowered text", /^align-(?:super|sub)$/],
  ["opacity", /^opacity-\d+$/],
  ["rule", /^border(?:-[xytrbl])?-\d+$/],
];

/**
 * The whole of what ADR-0018 names, keyed by the element allowed to say it.
 * A tag absent from here may style nothing at all.
 *
 * The value is the exact class, not a pattern: "bold" is a decision about this
 * element, so `font-bold` passing here must not also wave `font-black` through.
 */
const ALLOWED: Record<string, string[]> = {
  // Convention 1 — the expanded abbreviation is set in italic. The central
  // convention of an Irish diplomatic edition, and 2767 of them.
  expan: ["italic"],
  // Convention 2 — `hi rend="decor"` is set bold. The corpus's only `@rend`.
  hi: ["font-bold"],
  // Convention 4 — the manuscript's folio/column locator is bold in brackets;
  // the print edition's page is a tinted box instead. `pb` renders whichever of
  // the two the break carries, so it is allowed both.
  cb: ["font-bold"],
  pb: ["font-bold", "bg-stone-200"],
  // Not a convention of the edition at all: `note`'s superscript marker is not
  // the manuscript's text, it is the affordance saying "there is a note here,
  // open it", and the panel it opens is floating chrome. Carried over from
  // ADR-0016, which made the same exemption for the same reason.
  //
  // Only the marker's classes are ever walked here: the panel is portalled to
  // the body and mounted only while it is open (#166), so it is outside the
  // container this suite renders into. Its own styling is pinned by
  // `notePanel.test.tsx` instead, and the exemption covers both.
  note: ["text-sm", "text-blue-500"],
};

/** What `el` is doing to the text that ADR-0018 does not name for `tag`. */
function unnamedStyles(tag: string, el: Element): string[] {
  const allowed = ALLOWED[tag] ?? [];
  return [...el.classList]
    .filter((cls) => !allowed.includes(cls))
    .flatMap((cls) => STYLES.filter(([, re]) => re.test(cls)).map(([kind]) => `${kind} (${cls})`));
}

/** One mapped element, rendered the way `TEIRenderer` renders it. */
function renderTag(tag: string, attrs: Record<string, string> = ATTRS) {
  const Component = elementMap[tag];
  const node: TEIElementNode = { tag, attrs, children: [] };
  return render(
    <Component node={node} anchorId={1}>
      uerbum
    </Component>,
  );
}

describe("a mapped TEI element sets the text only where ADR-0018 says the print edition does", () => {
  const tags = Object.keys(elementMap);

  for (const [variant, attrs] of VARIANTS) {
    it.each(tags)(`%s (${variant})`, (tag) => {
      const { container } = renderTag(tag, attrs);

      for (const el of container.querySelectorAll("*")) {
        expect(unnamedStyles(tag, el), `<${el.tagName.toLowerCase()}> in ${tag}`).toEqual([]);
      }
    });
  }

  it("names nothing for an element that is not mapped, so ALLOWED cannot drift", () => {
    // A style survives its element being unmapped only if someone leaves it
    // here, and then the entry reads as a licence nothing holds.
    expect(Object.keys(ALLOWED).filter((tag) => !(tag in elementMap))).toEqual([]);
  });
});

describe("the four conventions, each on the element that carries it", () => {
  it("sets an expanded abbreviation in italic", () => {
    expect(renderTag("expan").container.firstElementChild?.className).toContain("italic");
  });

  it("sets a decor span bold, and leaves any other @rend alone", () => {
    expect(renderTag("hi").container.firstElementChild?.className).toContain("font-bold");
    expect(renderTag("hi", { ...ATTRS, rend: "italic" }).container.firstElementChild?.className)
      .toBe("");
  });

  it("hangs a numbered group's @n outside the verse, and keeps the indent", () => {
    const lg = renderTag("lg").container.firstElementChild!;

    expect(lg.className).toContain("pl-[2em]");
    expect(lg.className).toContain("my-3");
    expect(lg.querySelector("[data-tei-lg-n]")?.textContent).toBe(ATTRS.n);
  });

  it("brackets a manuscript locator and boxes a print-edition one", () => {
    for (const tag of ["pb", "cb"]) {
      const { container, unmount } = renderTag(tag);
      expect(container.textContent, tag).toBe(`[${ATTRS.n}]`);
      unmount();
    }

    const { container } = renderTag("pb", { ...ATTRS, id: "Stokes_p.69" });
    expect(container.textContent).toBe("Stokes_p.69");
  });
});

describe("what the elements still carry", () => {

  it("keeps @rend on the DOM whether or not anything is styled off it", () => {
    for (const tag of ["hi", "del", "c"]) {
      const { container, unmount } = renderTag(tag);
      expect(container.querySelector<HTMLElement>(`[data-tei-tag="${tag}"]`)?.dataset.teiRend).toBe(
        ATTRS.rend,
      );
      unmount();
    }
  });

  it("keeps abbr and rdg hidden, so an abbreviation and its expansion never both render", () => {
    // `hidden` is `display: none` — structure, not decoration. Strip it and the
    // reader sees the abbreviation *and* the expansion, one after the other.
    for (const tag of ["abbr", "rdg"]) {
      const { container, unmount } = renderTag(tag);
      expect(container.querySelector(`[data-tei-tag="${tag}"]`)?.className).toContain("hidden");
      unmount();
    }
  });

  it("keeps the editorial characters a print edition would also carry", () => {
    for (const [tag, mark] of [
      ["supplied", "⟨uerbum⟩"],
      ["gap", "[…2 words…]"],
      ["lacunaStart", "[*"],
      ["lacunaEnd", "*]"],
    ] as const) {
      const { container, unmount } = renderTag(tag);
      expect(container.textContent, tag).toBe(mark);
      unmount();
    }
  });
});

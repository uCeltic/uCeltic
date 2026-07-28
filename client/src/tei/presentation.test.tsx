/**
 * #153 — the reading pane shows the document, not a decorated version of it.
 *
 * The markup's job is to be *there* in the DOM: every `data-tei-*` attribute
 * still reaches the page, so opt-in highlighting (the Tag Filter, #147) is a CSS
 * rule rather than a re-write. What the markup must not do is colour, embolden,
 * resize, italicise or underline the manuscript's own text.
 *
 * This walks `elementMap` itself rather than a hand-kept list, so an element
 * added later is covered the day it is mapped, and the policy is enforced by the
 * suite instead of by memory.
 */
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { elementMap } from "./elementMap";
import type { TEIElementNode } from "../types/tei";

// Every attribute any mapped element reads, so each one renders the richest
// shape it has — `@rend` in particular used to select a class table.
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

// Every way a Tailwind class can change how the text itself looks. Margins,
// padding, `display` and line-height are absent on purpose: layout and spacing
// are what the elements are still allowed to say.
const BANNED: [string, RegExp][] = [
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

// `note` is the one exemption. Its superscript marker is not document text at
// all — it is the affordance that says "there is a note here, hover it", and the
// tooltip it opens is floating chrome. Everything else on this list decorates
// the manuscript's own characters.
const UI_CHROME = new Set(["note"]);

/** What `el` is doing to the text, named — `[]` when it is doing nothing. */
function offences(el: Element): string[] {
  return [...el.classList].flatMap((cls) =>
    BANNED.filter(([, re]) => re.test(cls)).map(([kind]) => `${kind} (${cls})`),
  );
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

describe("no mapped TEI element decorates the document's text", () => {
  const tags = Object.keys(elementMap).filter((tag) => !UI_CHROME.has(tag));

  it.each(tags)("%s", (tag) => {
    const { container } = renderTag(tag);

    for (const el of container.querySelectorAll("*")) {
      expect(offences(el), `<${el.tagName.toLowerCase()}> in ${tag}`).toEqual([]);
    }
  });
});

describe("what the elements still carry", () => {

  it("keeps @rend on the DOM even though nothing styles it any more", () => {
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
      // `‖` is now the whole of what marks a column break, so nothing about it
      // is incidental: with the locator gone from an unlabelled `cb`, this is
      // the only thing left on the page saying the column changed.
      ["cb", "‖p.35"],
    ] as const) {
      const { container, unmount } = renderTag(tag);
      expect(container.textContent, tag).toBe(mark);
      unmount();
    }
  });

  it("keeps the verse group's indent and vertical spacing, which say what the rule said", () => {
    const { container } = renderTag("lg");
    const lg = container.firstElementChild!;

    expect(lg.className).toContain("pl-4");
    expect(lg.className).toContain("my-3");
  });
});

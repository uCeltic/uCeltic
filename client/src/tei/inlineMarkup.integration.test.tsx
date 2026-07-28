/**
 * #145 — the contract between the two halves of the fix.
 *
 * The backend decides a word's character offsets; the frontend resolves them
 * into DOM ranges by walking the rendered text. Each half is unit-tested against
 * its own idea of the offsets, which is exactly the way a data-contract change
 * goes wrong: both sides pass, and highlighting still lands on the wrong text.
 *
 * So this renders a real backend fixture through the real renderer and checks
 * that the highlight covers the characters the word actually occupies. The
 * fixture is `parse_tei`'s own output for the markup shapes the research corpus
 * is full of — see `__fixtures__/inlineMarkup.xml` for the source and the
 * command that regenerates the JSON from it.
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import TEIRenderer from "./TEIRenderer";
import { buildWordToAnchors, rangesForWordSpan } from "./wordRange";
import type { TEIAnchor, TEINode, TEIWordEntry } from "../types/tei";
import fixture from "./__fixtures__/inlineMarkup.json";

const parsedJson = fixture.parsed_json as unknown as TEINode;
const anchors = fixture.anchors as unknown as TEIAnchor[];
const wordArray = fixture.word_array as unknown as TEIWordEntry[];

// Where a range sits in the column's text, as a [start, end) character interval.
function span(columnEl: Element, range: Range): [number, number] {
  const preceding = document.createRange();
  preceding.setStart(columnEl, 0);
  preceding.setEnd(range.startContainer, range.startOffset);
  const start = preceding.toString().length;
  return [start, start + range.toString().length];
}

/**
 * Every character the highlight paints for one word, in document order.
 *
 * The ranges overlap rather than tile — a line's own range stretches across the
 * inline elements sitting between its characters — so what the reader sees is
 * their union, not any one of them. Reading the union back off the page is also
 * the only way to catch the failure this file exists for: offsets that resolve
 * cleanly but against the wrong characters.
 */
function highlighted(columnEl: Element, word: string): string {
  const start = wordArray.findIndex((w) => w.w === word);
  const ranges = rangesForWordSpan(columnEl, anchors, start, start + 1);

  const covered = new Set<number>();
  for (const range of ranges) {
    const [from, to] = span(columnEl, range);
    for (let i = from; i < to; i++) covered.add(i);
  }

  const text = columnEl.textContent ?? "";
  return [...covered].sort((a, b) => a - b).map((i) => text[i]).join("");
}

describe("highlighting a word that inline markup splits", () => {
  let columnEl: HTMLElement;
  let unmount: () => void;

  beforeEach(() => {
    const result = render(<TEIRenderer node={parsedJson} />);
    unmount = result.unmount;
    columnEl = result.container;
  });

  afterEach(() => unmount());

  it("renders the reading pane without gluing words together", () => {
    // The whole point of preserving whitespace-only text nodes: `fīarfaig` and
    // `Eochaid` are separated by a space that lives in no element.
    expect(columnEl.textContent?.replace(/\s+/g, " ")).toContain(
      "IS annsin ro fīarfaig Eochaid",
    );
  });

  it("still renders a note that has left the search index", () => {
    expect(columnEl.textContent).toContain("Sic.");
  });

  it("assigns the anchor ids the backend assigned", () => {
    // Preserving whitespace-only text put new text nodes into the render tree.
    // assignAnchorIds must still walk the same node set the backend did, or
    // every offset in the document resolves against the wrong element.
    const rendered = [...columnEl.querySelectorAll("[data-tei-anchor-id]")].map(
      (el) => Number(el.getAttribute("data-tei-anchor-id")),
    );
    const byId = new Map(anchors.map((a) => [a.id, a.tag]));

    for (const id of rendered) expect(byId.has(id)).toBe(true);
    // The line the backend numbered "2" is the one the DOM shows `Lethderg` in.
    const line2 = anchors.find((a) => a.line_no === "2")!;
    expect(
      columnEl.querySelector(`[data-tei-anchor-id="${line2.id}"]`)?.textContent,
    ).toContain("Lethder⟨g⟩");
  });

  it.each([
    ["annsin", 3],
    ["Lethderg", 4],
    ["fīarfaig", 2],
    ["Eochaid", 2],
    ["talam", 2],
    ["scrib", 2],
    ["rand", 1],
    ["Find", 1],
    // #146's real risk. `torad` follows an empty `cb` that renders a visible
    // `fol.27vb` locator; the line's offsets are counted against the line's own
    // text, which the marker is not part of. Put it there and this lands nine
    // characters late.
    ["torad", 2],
  ])("covers every character of %s, which spans %i anchors", (word, anchorCount) => {
    const start = wordArray.findIndex((w) => w.w === word);
    expect(buildWordToAnchors(anchors).get(start)).toHaveLength(anchorCount);

    // Exactly the word — no more and no less. `Lethderg` ends in an editorially
    // supplied letter, and the brackets the page wraps it in are the editor's
    // mark rather than the manuscript's text, so they stay unhighlighted.
    expect(highlighted(columnEl, word)).toBe(word);
  });

  it("does not highlight a note's text as part of the word before it", () => {
    expect(highlighted(columnEl, "talam")).not.toContain("Sic");
  });

  it("shows the column break the backend recorded as an empty element (#146)", () => {
    const cb = anchors.find((a) => a.tag === "cb")!;
    const el = columnEl.querySelector(`[data-tei-anchor-id="${cb.id}"]`);

    expect(cb.word_char_offsets).toHaveLength(0);
    expect(el?.textContent).toContain("fol.27vb");
  });
});

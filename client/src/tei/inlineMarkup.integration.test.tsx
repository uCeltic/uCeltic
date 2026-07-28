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
import { buildAnchorsById, buildWordToAnchors, buildRangesForWordSpan } from "./wordRange";
import type { TEIAnchor, TEINode, TEIWordEntry } from "../types/tei";
import fixture from "./__fixtures__/inlineMarkup.json";

const parsedJson = fixture.parsed_json as unknown as TEINode;
const anchors = fixture.anchors as unknown as TEIAnchor[];
const wordArray = fixture.word_array as unknown as TEIWordEntry[];

// Concatenate what the highlight actually paints, in document order.
function highlighted(columnEl: Element, word: string): string {
  const start = wordArray.findIndex((w) => w.w === word);
  const ranges = buildRangesForWordSpan(
    columnEl,
    buildAnchorsById(anchors),
    buildWordToAnchors(anchors),
    start,
    start + 1,
  );
  return ranges
    .map((r) => r.toString())
    .sort((a, b) => b.length - a.length)
    .join("");
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

  it.each([
    ["annsin", 3],
    ["fīarfaig", 2],
    ["Eochaid", 2],
    ["talam", 2],
  ])("covers every character of %s, which spans %i anchors", (word, anchorCount) => {
    const start = wordArray.findIndex((w) => w.w === word);
    expect(buildWordToAnchors(anchors).get(start)).toHaveLength(anchorCount);

    // The line's own range stretches across the elements sitting inside it, so
    // the ranges overlap rather than tile — the longest one is the whole word.
    expect(highlighted(columnEl, word)).toContain(word);
  });

  it("does not highlight a note's text as part of the word before it", () => {
    expect(highlighted(columnEl, "talam")).not.toContain("Sic");
  });
});

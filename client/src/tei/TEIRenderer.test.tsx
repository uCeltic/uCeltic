/**
 * #151 — `standOff` holds the name authority list, not manuscript text.
 *
 * Opening one of the Acallam manuscripts used to show several hundred names
 * before the text began. It leaves the screen the same way `teiHeader` does:
 * skipped at render, still walked when anchor ids are assigned, because the
 * backend's `_flatten` allocates an id for it too and the two walks have to
 * agree or every later anchor shifts.
 */
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import TEIRenderer from "./TEIRenderer";
import type { TEINode } from "../types/tei";
import { text } from "./__fixtures__/nodes";

// The markup shape of the research corpus: a standOff sibling of teiHeader and
// text, holding one person with a canonical headword and one spelling variant.
const doc: TEINode = {
  tag: "TEI",
  children: [
    { tag: "teiHeader", children: [text("Acallam")] },
    {
      tag: "standOff",
      children: [
        {
          tag: "listPerson",
          children: [
            {
              tag: "person",
              attrs: { id: "fionn" },
              children: [
                {
                  tag: "persName",
                  attrs: { type: "canonical" },
                  children: [text("Find mac Cumaill")],
                },
                {
                  tag: "persName",
                  attrs: { type: "variant" },
                  children: [text("Fhionn")],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      tag: "text",
      children: [
        {
          tag: "body",
          children: [
            {
              tag: "l",
              attrs: { n: "1" },
              children: [
                {
                  tag: "persName",
                  attrs: { ref: "#fionn" },
                  children: [text("Find")],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

describe("standOff", () => {
  it("is not rendered", () => {
    const { container } = render(<TEIRenderer node={doc} />);

    expect(container.textContent).toBe("Find");
  });

  it("does not put its own authority entries on screen as named entities", () => {
    const { container } = render(<TEIRenderer node={doc} />);

    const names = container.querySelectorAll('[data-tei-tag="persName"]');
    expect(names).toHaveLength(1);
    expect(names[0].textContent).toBe("Find");
  });

  it("still consumes anchor ids, so the body's ids are the backend's", () => {
    const { container } = render(<TEIRenderer node={doc} />);

    // Pre-order over every element: TEI 0, teiHeader 1, standOff 2, listPerson
    // 3, person 4, persName 5, persName 6, text 7, body 8, l 9, persName 10.
    const body = container.querySelector('[data-tei-tag="persName"]');
    expect(body?.getAttribute("data-tei-anchor-id")).toBe("10");
  });
});

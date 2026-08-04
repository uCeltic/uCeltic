/**
 * #151, #162 — `standOff` holds what a document files *about* its text, not the
 * text.
 *
 * It was the name authority list when this skip was written, and opening one of
 * the Acallam manuscripts showed several hundred names before the text began.
 * Those witnesses are gone (#162) and the ones that replaced them carry no
 * `standOff` at all, but `serafin03.xml` files 20 Polish transcription notes
 * there and `serafin07.xml` two more — apparatus either way, and just as
 * unwelcome on the page.
 *
 * It leaves the screen the same way `teiHeader` does: skipped at render, still
 * walked when anchor ids are assigned, because the backend's `_flatten`
 * allocates an id for it too and the two walks have to agree or every later
 * anchor shifts.
 */
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import TEIRenderer from "./TEIRenderer";
import type { TEINode } from "../types/tei";
import { text } from "./__fixtures__/nodes";

// `serafin03.xml`'s shape: a standOff sibling of teiHeader and text, holding a
// listAnnotation of transcription notes that point back into the body.
const doc: TEINode = {
  tag: "TEI",
  children: [
    { tag: "teiHeader", children: [text("Serafin")] },
    {
      tag: "standOff",
      children: [
        {
          tag: "listAnnotation",
          children: [
            {
              tag: "note",
              attrs: { n: "a", type: "transcription", target: "#aa" },
              children: [text("districti skreślone")],
            },
            {
              tag: "note",
              attrs: { n: "b", type: "transcription", target: "#ab" },
              children: [text("na marginesie")],
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
                  tag: "name",
                  attrs: { type: "person", nymRef: "F64" },
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

  //Test: the apparatus is not editorial commentary on the page either — the
  //notes it holds take no note number and appear nowhere
  it("does not put the notes it holds on screen", () => {
    const { container } = render(<TEIRenderer node={doc} />);

    expect(container.querySelectorAll('[data-tei-tag="note"]')).toHaveLength(0);
    expect(container.textContent).not.toContain("skreślone");
  });

  it("still consumes anchor ids, so the body's ids are the backend's", () => {
    const { container } = render(<TEIRenderer node={doc} />);

    // Pre-order over every element: TEI 0, teiHeader 1, standOff 2,
    // listAnnotation 3, note 4, note 5, text 6, body 7, l 8, name 9.
    const body = container.querySelector('[data-tei-tag="name"]');
    expect(body?.getAttribute("data-tei-anchor-id")).toBe("9");
  });
});

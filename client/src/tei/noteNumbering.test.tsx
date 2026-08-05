/**
 * #154 — an editorial note is cited by its number, so every note needs one.
 *
 * The renderer already walks the tree in pre-order to hand out anchor ids, and a
 * note's place in that walk is its place in the document, so the same pass
 * allocates the numbers. Numbering runs continuously through the document: the
 * note opens as a hover popover rather than being printed in a page footer, so
 * there is nothing to reset it at a `pb`, and resetting would put several
 * "note 1" in one document and make a bare number ambiguous again.
 */
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import TEIRenderer from "./TEIRenderer";
import type { TEINode } from "../types/tei";
import { text } from "./__fixtures__/nodes";
import { Note } from "./elements/note";

function note(body: string): TEINode {
  return { tag: "note", children: [text(body)] };
}

function line(n: string, ...children: TEINode[]): TEINode {
  return { tag: "l", attrs: { n }, children };
}

/** The document body wrapped in the envelope every parsed file arrives in. */
function doc(...body: TEINode[]): TEINode {
  return {
    tag: "TEI",
    children: [
      { tag: "teiHeader", children: [text("Acallam")] },
      { tag: "text", children: [{ tag: "body", children: body }] },
    ],
  };
}

/** The text of every note marker on screen, in document order. */
function markers(container: HTMLElement): string[] {
  return [...container.querySelectorAll('[data-tei-tag="note"] sup')].map(
    (el) => el.textContent ?? "",
  );
}

describe("note markers", () => {
  it("number the notes instead of marking them all with an asterisk", () => {
    const { container } = render(
      <TEIRenderer
        node={doc(
          line("1", text("Find "), note("A patronymic.")),
          line("2", text("Oisín "), note("The poet's son.")),
        )}
      />,
    );

    expect(markers(container)).toEqual(["1", "2"]);
  });

  it("run continuously through the document rather than resetting at a page break", () => {
    const { container } = render(
      <TEIRenderer
        node={doc(
          line("1", note("first")),
          { tag: "pb", attrs: { n: "36r" }, children: [] },
          line("2", note("second")),
          { tag: "pb", attrs: { n: "36v" }, children: [] },
          line("3", note("third")),
        )}
      />,
    );

    expect(markers(container)).toEqual(["1", "2", "3"]);
  });

  it("follow reading order, not the order the notes nest at", () => {
    const { container } = render(
      <TEIRenderer
        node={doc(
          {
            tag: "lg",
            children: [
              line("1", text("a "), note("inner first")),
              line("2", text("b "), note("inner second")),
            ],
          },
          { tag: "p", children: [text("c "), note("after the group")] },
        )}
      />,
    );

    expect(markers(container)).toEqual(["1", "2", "3"]);
  });

  it("number from 1 in each document when two are open side by side", () => {
    const left = doc(line("1", note("left one")), line("2", note("left two")));
    const right = doc(line("1", note("right one")));

    const { container } = render(
      <div>
        <div data-doc-column-id="left">
          <TEIRenderer node={left} />
        </div>
        <div data-doc-column-id="right">
          <TEIRenderer node={right} />
        </div>
      </div>,
    );

    const column = (id: string) =>
      markers(container.querySelector<HTMLElement>(`[data-doc-column-id="${id}"]`)!);

    expect(column("left")).toEqual(["1", "2"]);
    expect(column("right")).toEqual(["1"]);
  });

  it("take no number for the notes in subtrees that are never painted", () => {
    // `teiHeader` carries editorial notes of its own — 8 of the 28 in one
    // research file — and they are catalogue metadata, off screen. If they took
    // numbers, the first note the reader can actually see would be note 9.
    const { container } = render(
      <TEIRenderer
        node={{
          tag: "TEI",
          children: [
            { tag: "teiHeader", children: [note("editorial statement"), note("source desc")] },
            {
              tag: "text",
              children: [{ tag: "body", children: [line("1", text("Find "), note("visible"))] }],
            },
          ],
        }}
      />,
    );

    expect(markers(container)).toEqual(["1"]);
  });

  it("keep something to hover on a note that was handed no number", () => {
    // Only reachable by rendering `Note` outside the renderer, which is what the
    // suite does elsewhere. It is the degradation that matters: an empty `sup`
    // is nothing to point at, so the note would vanish rather than read the way
    // it used to.
    const { container } = render(
      <Note node={{ tag: "note" }} anchorId={1}>
        A patronymic.
      </Note>,
    );

    expect(container.querySelector("sup")?.textContent).toBe("*");
  });

  it("stay a superscript one step larger than the text-xs they were", () => {
    const { container } = render(<TEIRenderer node={doc(line("1", note("n")))} />);

    const sup = container.querySelector('[data-tei-tag="note"] sup')!;
    expect(sup.tagName).toBe("SUP");
    expect(sup.className).toContain("text-sm");
    // A two-digit number at a larger size must not open the verse line up, so
    // the marker carries its own line height rather than the size's.
    expect(sup.className).toContain("leading-none");
  });
});

describe("the numbers do not disturb search highlighting", () => {
  /**
   * The characters an anchor's own offsets are resolved against: the text nodes
   * whose parent IS the anchor element, which is the filter `rangeFromCharOffsets`
   * walks with. Anything nested deeper — the marker inside the note — is another
   * anchor's business and counts for nothing here.
   */
  function ownText(el: Element): string {
    return [...el.childNodes]
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent)
      .join("");
  }

  it("keeps the marker out of the enclosing line's own characters", () => {
    const { container } = render(
      <TEIRenderer node={doc(line("1", text("Find mac Cumaill"), note("A patronymic.")))} />,
    );

    const l = container.querySelector('[data-tei-n="1"]')!;
    expect(ownText(l)).toBe("Find mac Cumaill");
  });

  it("keeps the marker out of the note's own characters", () => {
    const { container } = render(
      <TEIRenderer node={doc(line("1", text("Find "), note("A patronymic.")))} />,
    );

    const noteEl = container.querySelector('[data-tei-tag="note"]')!;
    expect(ownText(noteEl)).toBe("");
  });

  it("leaves the anchor ids the backend allocated untouched", () => {
    const { container } = render(
      <TEIRenderer node={doc(line("1", text("Find "), note("A patronymic.")))} />,
    );

    // Pre-order over every element: TEI 0, teiHeader 1, text 2, body 3, l 4,
    // note 5.
    expect(container.querySelector('[data-tei-n="1"]')?.getAttribute("data-tei-anchor-id")).toBe(
      "4",
    );
    expect(
      container.querySelector('[data-tei-tag="note"]')?.getAttribute("data-tei-anchor-id"),
    ).toBe("5");
  });
});

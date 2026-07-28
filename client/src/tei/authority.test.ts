/**
 * #147 — the Tag Filter's options come from the document's own authority list.
 *
 * Written against the markup the research corpus actually carries: a `standOff`
 * holding `<person xml:id="fionn">` with a canonical headword and its spelling
 * variants, and body entities pointing back at it with `ref="#fionn"`. Both
 * traps this module exists to absorb are asserted here — `xml:id` arrives from
 * the backend as plain `id`, and a body `ref` carries a leading `#`.
 */
import { describe, expect, it } from "vitest";
import {
  buildEntityMenu,
  countOccurrencesByEntity,
  readAuthorityList,
} from "./authority";
import type { TEIElementNode, TEINode } from "../types/tei";

function text(value: string): TEINode {
  return { type: "text", segments: [{ kind: "word", text: value, idx: 0 }] };
}

function name(tag: string, type: string, value: string): TEIElementNode {
  return { tag, attrs: { type }, children: [text(value)] };
}

function entity(tag: string, ref: string, value: string): TEIElementNode {
  return { tag, attrs: { ref }, children: [text(value)] };
}

// Two people and one place, the shape every Acallam manuscript uses.
function standOff(): TEIElementNode {
  return {
    tag: "standOff",
    children: [
      {
        tag: "listPerson",
        children: [
          {
            tag: "person",
            attrs: { id: "fionn" },
            children: [
              name("persName", "canonical", "Find mac Cumaill"),
              name("persName", "variant", "Find"),
              name("persName", "variant", "Finn"),
              name("persName", "variant", "Ḟinn"),
              name("persName", "variant", "Fhionn"),
            ],
          },
          {
            tag: "person",
            attrs: { id: "cailte" },
            children: [
              // The canonical headword is not first here — the corpus does not
              // promise an order, only the attribute.
              name("persName", "variant", "Chaílte"),
              name("persName", "canonical", "Caílte mac Rónáin"),
            ],
          },
        ],
      },
      {
        tag: "listPlace",
        children: [
          {
            tag: "place",
            attrs: { id: "eriu" },
            children: [
              name("placeName", "canonical", "Ériu"),
              name("placeName", "variant", "hÉrinn"),
            ],
          },
        ],
      },
    ],
  };
}

function doc(body: TEINode[], withAuthority = true): TEINode {
  return {
    tag: "TEI",
    children: [
      { tag: "teiHeader", children: [text("Acallam")] },
      ...(withAuthority ? [standOff()] : []),
      { tag: "text", children: [{ tag: "body", children: body }] },
    ],
  };
}

const acallam = doc([
  {
    tag: "l",
    children: [
      entity("persName", "#fionn", "Find"),
      entity("persName", "#fionn", "Ḟinn"),
      entity("placeName", "#eriu", "hÉrinn"),
    ],
  },
  { tag: "l", children: [entity("persName", "#cailte", "Chaílte")] },
]);

describe("readAuthorityList", () => {
  it("reads people and places with their ids", () => {
    const entries = readAuthorityList(acallam);

    expect(entries.map((e) => [e.kind, e.id])).toEqual([
      ["person", "fionn"],
      ["person", "cailte"],
      ["place", "eriu"],
    ]);
  });

  it("takes the headword from the canonical child, whatever its position", () => {
    const entries = readAuthorityList(acallam);

    expect(entries.map((e) => e.headword)).toEqual([
      "Find mac Cumaill",
      "Caílte mac Rónáin",
      "Ériu",
    ]);
  });

  it("keeps the spelling variants", () => {
    const [fionn] = readAuthorityList(acallam);

    expect(fionn.variants).toEqual(["Find", "Finn", "Ḟinn", "Fhionn"]);
  });

  it("returns nothing for a document with no authority list", () => {
    const plain = doc([{ tag: "l", children: [text("do chuaid")] }], false);

    expect(readAuthorityList(plain)).toEqual([]);
  });

  it("drops an entry that carries no id, since nothing can reference it", () => {
    const orphan: TEINode = {
      tag: "TEI",
      children: [
        {
          tag: "standOff",
          children: [
            {
              tag: "listPerson",
              children: [
                {
                  tag: "person",
                  children: [name("persName", "canonical", "Anonymous")],
                },
                {
                  tag: "person",
                  attrs: { id: "fionn" },
                  children: [name("persName", "canonical", "Find mac Cumaill")],
                },
              ],
            },
          ],
        },
      ],
    };

    expect(readAuthorityList(orphan).map((e) => e.id)).toEqual(["fionn"]);
  });
});

describe("countOccurrencesByEntity", () => {
  it("counts body references, stripping the leading #", () => {
    expect(countOccurrencesByEntity(acallam)).toEqual({
      fionn: 2,
      cailte: 1,
      eriu: 1,
    });
  });

  it("never counts the authority list's own entries", () => {
    // 5 persName children under #fionn in standOff, 2 references in the body.
    expect(countOccurrencesByEntity(acallam).fionn).toBe(2);
  });

  it("ignores references to ids the authority list does not declare", () => {
    const stray = doc([
      { tag: "l", children: [entity("persName", "#oisin", "Oisín")] },
    ]);

    expect(countOccurrencesByEntity(stray)).toEqual({});
  });
});

describe("buildEntityMenu", () => {
  // A second manuscript sharing the authority list — the same xml:ids across
  // files are what make one selected person resolve in every open column.
  const second = doc([
    {
      tag: "l",
      children: [
        entity("persName", "#cailte", "Chaílte"),
        entity("persName", "#cailte", "Caílti"),
        entity("persName", "#cailte", "Chaīlte"),
      ],
    },
  ]);

  it("unions the open documents' entries, deduplicated by id", () => {
    const menu = buildEntityMenu([acallam, second]);

    expect(menu.map((e) => e.id).sort()).toEqual(["cailte", "eriu", "fionn"]);
  });

  it("counts each document separately, in the order given", () => {
    const menu = buildEntityMenu([acallam, second]);

    const cailte = menu.find((e) => e.id === "cailte");
    expect(cailte?.counts).toEqual([1, 3]);
  });

  it("reports an entry missing from a column as 0 rather than hiding it", () => {
    const menu = buildEntityMenu([acallam, second]);

    expect(menu.find((e) => e.id === "eriu")?.counts).toEqual([1, 0]);
  });

  it("orders by total occurrences, so the people the corpus dwells on lead", () => {
    const menu = buildEntityMenu([acallam, second]);

    expect(menu.map((e) => e.id)).toEqual(["cailte", "fionn", "eriu"]);
  });

  it("offers nothing when no document is open", () => {
    expect(buildEntityMenu([])).toEqual([]);
  });

  it("offers nothing for documents with no authority list", () => {
    const plain = doc([{ tag: "l", children: [text("do chuaid")] }], false);

    expect(buildEntityMenu([plain])).toEqual([]);
  });
});

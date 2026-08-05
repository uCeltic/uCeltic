/**
 * #163 — the Tag Filter's rows, joined from the two things that make one.
 *
 * The register says what a `@nymRef` group id is called; each open document's
 * `name_index` says how often it writes that name. Neither alone is a row: an
 * id with no headword is not something a reader can be offered, and a headword
 * no visible column uses is an option that cannot match anything, which is
 * exactly the property this menu was rebuilt to have (#147).
 */
import { describe, expect, it } from "vitest";
import { buildEntityMenu } from "./entityMenu";
import type { NameEntity, TEINameIndex } from "../types/tei";

const find: NameEntity = { code: "F64", kind: "person", headword: "Find" };
const eriu: NameEntity = { code: "e6", kind: "place", headword: "Érend" };
const cailte: NameEntity = { code: "C6", kind: "person", headword: "Caílti" };

// The corpus's own typo: Lismore writes nymRef="64" once where it means F64.
const finTypo: NameEntity = { code: "64", kind: "person", headword: "Ḟinn" };

function index(counts: Record<string, number>): TEINameIndex {
  return Object.fromEntries(
    Object.entries(counts).map(([code, count]) => [
      code,
      { count, types: {}, variants: {}, anchors: [] },
    ]),
  );
}

describe("buildEntityMenu", () => {
  //Test: one row per entity the visible columns actually name
  it("counts each entity once per visible column, in column order", () => {
    const entries = buildEntityMenu(
      [find],
      [index({ F64: 21 }), index({ F64: 10 }), index({ F64: 17 })],
    );

    expect(entries).toEqual([
      { id: "F64", kind: "person", headword: "Find", counts: [21, 10, 17] },
    ]);
  });

  //Test: the id is the @nymRef code — it is what the DOM carries, so it is
  //what a selection has to resolve against
  it("keys a row by the group id its occurrences carry", () => {
    const [entry] = buildEntityMenu([find], [index({ F64: 1 })]);

    expect(entry.id).toBe("F64");
  });

  //Test: a column that never names this entity says 0, and still has a slot —
  //the counts line up with the columns on screen
  it("gives a column that does not name an entity a count of zero", () => {
    const entries = buildEntityMenu([find], [index({}), index({ F64: 3 })]);

    expect(entries[0].counts).toEqual([0, 3]);
  });

  //Test: nothing is offered that cannot match anything (#147)
  it("drops an entity no visible column names", () => {
    const entries = buildEntityMenu([find, eriu], [index({ F64: 2 })]);

    expect(entries.map((e) => e.id)).toEqual(["F64"]);
  });

  //Test: a column parsed before the registry existed contributes no counts
  //rather than breaking the menu
  it("reads a document with no name index as naming nobody", () => {
    const entries = buildEntityMenu([find], [null, index({ F64: 4 })]);

    expect(entries[0].counts).toEqual([0, 4]);
  });

  //Test: with no columns open there is nothing to be a menu of
  it("offers nothing when no column is visible", () => {
    expect(buildEntityMenu([find, eriu], [])).toEqual([]);
  });

  //Test: an empty register is the honest empty state — the corpus groups its
  //names but says what none of the groups are called
  it("offers nothing when the register is empty", () => {
    expect(buildEntityMenu([], [index({ F64: 21 })])).toEqual([]);
  });

  //Test: most-referenced first, so the people the passage is about are the
  //ones at the top of a 91-row menu
  it("orders rows by how often the visible columns name them", () => {
    const entries = buildEntityMenu(
      [cailte, find, eriu],
      [index({ F64: 21, e6: 39, C6: 15 }), index({ F64: 10, e6: 23, C6: 8 })],
    );

    expect(entries.map((e) => e.id)).toEqual(["e6", "F64", "C6"]);
  });

  //Test: the order narrows with the columns — a count is per column of THIS
  //menu, so the ordering it drives has to be too
  it("re-orders when the visible columns change", () => {
    const register = [find, eriu];

    expect(
      buildEntityMenu(register, [index({ F64: 21, e6: 39 })]).map((e) => e.id),
    ).toEqual(["e6", "F64"]);
    expect(
      buildEntityMenu(register, [index({ F64: 21, e6: 2 })]).map((e) => e.id),
    ).toEqual(["F64", "e6"]);
  });

  //Test: a tie is broken by name rather than left to the register's order, so
  //the menu does not reshuffle between two equally-referenced entities.
  //Collation is locale-aware, not by code point: É belongs with E, and half
  //the names in this corpus carry a diacritic.
  it("breaks a tie on the headword", () => {
    const entries = buildEntityMenu(
      [eriu, cailte, find],
      [index({ F64: 5, e6: 5, C6: 5 })],
    );

    expect(entries.map((e) => e.headword)).toEqual([
      "Caílti",
      "Érend",
      "Find",
    ]);
  });

  //Test: the mistyped id keeps its own row rather than being folded into F64
  //— two near-identical rows are the signal to fix the source file
  it("keeps a mistyped group id as its own row", () => {
    const entries = buildEntityMenu(
      [find, finTypo],
      [index({ F64: 16, "64": 1 })],
    );

    expect(entries.map((e) => [e.id, e.counts[0]])).toEqual([
      ["F64", 16],
      ["64", 1],
    ]);
  });
});

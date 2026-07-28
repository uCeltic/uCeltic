import { describe, expect, it } from "vitest";
import type { TEICatalogEntry } from "../types/tei";
import { groupCatalogueByWork, UNASSIGNED_WORK_LABEL } from "./workCatalog";

const acallam = { id: 1, name: "Acallam na Senórach", slug: "acallam-na-senorach" };
const tain = { id: 2, name: "Táin Bó Cúailnge", slug: "tain-bo-cuailnge" };

function entry(
  id: number,
  title: string,
  work: TEICatalogEntry["work"] = null,
): TEICatalogEntry {
  return { id, title, language: "ga", work, created_at: "" };
}

describe("groupCatalogueByWork", () => {
  it("groups the flat catalogue under each document's work", () => {
    const groups = groupCatalogueByWork([
      entry(1, "Laud Misc. 610", acallam),
      entry(2, "Book of Leinster", tain),
      entry(3, "Franciscan A 4", acallam),
    ]);

    expect(groups.map((g) => g.work?.name)).toEqual([
      "Acallam na Senórach",
      "Táin Bó Cúailnge",
    ]);
    expect(groups[0].documents.map((d) => d.title)).toEqual([
      "Laud Misc. 610",
      "Franciscan A 4",
    ]);
  });

  // A work only exists here because a document named it, so an empty branch is
  // unrepresentable rather than filtered out (#152).
  it("cannot produce a work with no documents", () => {
    const groups = groupCatalogueByWork([entry(1, "Laud Misc. 610", acallam)]);
    expect(groups).toHaveLength(1);
    expect(groups[0].documents).toHaveLength(1);
  });

  // shakespear.xml and the serafin samples belong to no work and must stay
  // reachable — the opener is the only way into them.
  it("keeps unassigned documents in a branch of their own, last", () => {
    const groups = groupCatalogueByWork([
      entry(1, "Shakespeare"),
      entry(2, "Laud Misc. 610", acallam),
    ]);

    expect(groups.map((g) => g.label)).toEqual([
      "Acallam na Senórach",
      UNASSIGNED_WORK_LABEL,
    ]);
    expect(groups[1].work).toBeNull();
    expect(groups[1].documents.map((d) => d.title)).toEqual(["Shakespeare"]);
  });

  it("omits the unassigned branch when every document has a work", () => {
    const groups = groupCatalogueByWork([entry(1, "Laud Misc. 610", acallam)]);
    expect(groups.every((g) => g.work !== null)).toBe(true);
  });

  // The catalogue arrives newest-first; the menu is a reference list, so works
  // read in name order regardless of when their documents were uploaded.
  it("orders works by name", () => {
    const groups = groupCatalogueByWork([
      entry(1, "Book of Leinster", tain),
      entry(2, "Laud Misc. 610", acallam),
    ]);
    expect(groups.map((g) => g.work?.slug)).toEqual([
      "acallam-na-senorach",
      "tain-bo-cuailnge",
    ]);
  });

  it("returns nothing for an empty catalogue", () => {
    expect(groupCatalogueByWork([])).toEqual([]);
  });
});

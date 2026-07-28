import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
    entityOccurrences,
    rebuildEntityHighlights,
    rebuildHighlights,
    setQuerySourceHighlight,
} from "./highlight";
import type { TEIAnchor, TEIWordEntry } from "../types/tei";
import type { SearchResult } from "../types/search";

// Two columns, one anchor span of two words each.
const anchorsA: TEIAnchor[] = [
    { id: 1, tag: "seg", word_char_offsets: [[0, 0, 5], [1, 6, 11]] }, // "hello world"
];
const wordArrayA: TEIWordEntry[] = [
    { w: "hello", a: 1, sep: " " },
    { w: "world", a: 1, sep: "" },
];
const anchorsB: TEIAnchor[] = [
    { id: 2, tag: "seg", word_char_offsets: [[0, 0, 3], [1, 4, 7]] }, // "foo bar"
];
const wordArrayB: TEIWordEntry[] = [
    { w: "foo", a: 2, sep: " " },
    { w: "bar", a: 2, sep: "" },
];
const teiDocA = { anchors: anchorsA, word_array: wordArrayA };
const teiDocB = { anchors: anchorsB, word_array: wordArrayB };

// a SearchResult covering the half-open word span [start, end)
const span = (word_start: number, word_end: number): SearchResult => ({
    score: 0.1,
    snippet: "",
    word_start,
    word_end,
    anchor_id: null,
    anchor_tag: null,
    line_no: null,
});

function makeColumn(docId: string, html: string) {
    const el = document.createElement("article");
    el.setAttribute("data-doc-column-id", docId);
    el.innerHTML = html;
    document.body.appendChild(el);
}

describe("rebuildHighlights", () => {
    beforeEach(() => {
        makeColumn("doc-a", '<span data-tei-anchor-id="1">hello world</span>');
        makeColumn("doc-b", '<span data-tei-anchor-id="2">foo bar</span>');
    });

    afterEach(() => {
        document.body.innerHTML = "";
        CSS.highlights.get("search-match")?.clear();
        CSS.highlights.get("search-match-active")?.clear();
    });

    it("paints only each column's current result into search-match-active", () => {
        rebuildHighlights([
            { docId: "doc-a", teiDoc: teiDocA, results: [span(0, 1), span(1, 2)], activeIndex: 0 },
            { docId: "doc-b", teiDoc: teiDocB, results: [span(0, 1)], activeIndex: 0 },
        ]);

        const match = [...(CSS.highlights.get("search-match") ?? [])].map((r) => r.toString()).sort();
        const active = [...(CSS.highlights.get("search-match-active") ?? [])].map((r) => r.toString()).sort();

        // each column's CURRENT result is highlighted — both columns at once
        expect(active).toEqual(["foo", "hello"]);
        // the all-matches highlight is no longer painted
        expect(match).toEqual([]);
    });
});

describe("setQuerySourceHighlight", () => {
    beforeEach(() => {
        makeColumn("doc-a", '<span id="src-a">hello world</span>');
        makeColumn("doc-b", '<span id="src-b">foo bar</span>');
    });

    afterEach(() => {
        document.body.innerHTML = "";
        CSS.highlights.get("query-source")?.clear();
    });

    // the text of whatever the query-source highlight is currently painted over
    const painted = () =>
        [...(CSS.highlights.get("query-source") ?? [])].map((r) => r.toString());

    function rangeOver(id: string): Range {
        const range = document.createRange();
        range.selectNodeContents(document.getElementById(id)!);
        return range;
    }

    it("paints the range the search took its query from", () => {
        setQuerySourceHighlight(rangeOver("src-a"));

        expect(painted()).toEqual(["hello world"]);
    });

    //Test: a second selection search elsewhere marks its own source, not both
    it("replaces the previous range rather than adding to it", () => {
        setQuerySourceHighlight(rangeOver("src-a"));

        setQuerySourceHighlight(rangeOver("src-b"));

        expect(painted()).toEqual(["foo bar"]);
    });

    //Test: a typed search has no source text to point at
    it("clears the highlight when passed null", () => {
        setQuerySourceHighlight(rangeOver("src-a"));

        setQuerySourceHighlight(null);

        expect(painted()).toEqual([]);
    });

    //Test: the source document can be closed while its text is still selected —
    //removing its nodes collapses the range onto their old parent, and a range
    //with no text left in it must fail quietly rather than paint nothing visible
    it("ignores a range whose text has left the document", () => {
        const range = rangeOver("src-a");
        document.querySelector('[data-doc-column-id="doc-a"]')!.remove();

        expect(() => setQuerySourceHighlight(range)).not.toThrow();
        expect(painted()).toEqual([]);
    });

    it("still clears when the previously painted document has been closed", () => {
        setQuerySourceHighlight(rangeOver("src-a"));
        document.querySelector('[data-doc-column-id="doc-a"]')!.remove();

        expect(() => setQuerySourceHighlight(null)).not.toThrow();
        expect(painted()).toEqual([]);
    });
});
/**
 * #147 — following one person through every open manuscript at once.
 *
 * Two tiers live in the CSS Highlight registry: the occurrence the column is
 * sitting on, and that entity's other occurrences in the same column. The third
 * tier (every *other* named entity, dimmed) is plain CSS on `data-tei-entity`
 * and needs no registry entry.
 */
describe("rebuildEntityHighlights", () => {
    beforeEach(() => {
        // G 126 and Franciscan A 4 share the authority list, so `#fionn`
        // resolves in both columns at once — with different occurrences.
        makeColumn(
            "doc-a",
            // an ordinary anchored line, so a search highlight can be painted
            // into the same column as the entity highlights
            '<span data-tei-anchor-id="1">hello world</span>' +
            '<span data-tei-entity data-tei-ref="#fionn">Find</span>' +
            '<span data-tei-entity data-tei-ref="#cailte">Caílte</span>' +
            '<span data-tei-entity data-tei-ref="#fionn">Ḟinn</span>',
        );
        makeColumn(
            "doc-b",
            '<span data-tei-entity data-tei-ref="#fionn">Fhionn</span>',
        );
    });

    afterEach(() => {
        document.body.innerHTML = "";
        CSS.highlights.get("tag-entity-active")?.clear();
        CSS.highlights.get("tag-entity-other")?.clear();
        CSS.highlights.get("search-match-active")?.clear();
    });

    const painted = (name: string) =>
        [...(CSS.highlights.get(name) ?? [])].map((r) => r.toString()).sort();

    it("paints each column's current occurrence and its siblings apart", () => {
        rebuildEntityHighlights([
            { docId: "doc-a", entityId: "fionn", activeIndex: 0 },
            { docId: "doc-b", entityId: "fionn", activeIndex: 0 },
        ]);

        expect(painted("tag-entity-active")).toEqual(["Fhionn", "Find"]);
        expect(painted("tag-entity-other")).toEqual(["Ḟinn"]);
    });

    //Test: every spelling of one person highlights, and nothing else does —
    //the grouping the authority list provides, not string matching
    it("highlights every spelling variant of the entity and no other entity", () => {
        rebuildEntityHighlights([
            { docId: "doc-a", entityId: "fionn", activeIndex: 1 },
        ]);

        expect(painted("tag-entity-active")).toEqual(["Ḟinn"]);
        expect(painted("tag-entity-other")).toEqual(["Find"]);
        expect([...painted("tag-entity-active"), ...painted("tag-entity-other")])
            .not.toContain("Caílte");
    });

    it("navigating one column leaves the other column's highlight alone", () => {
        rebuildEntityHighlights([
            { docId: "doc-a", entityId: "fionn", activeIndex: 1 },
            { docId: "doc-b", entityId: "fionn", activeIndex: 0 },
        ]);

        expect(painted("tag-entity-active")).toEqual(["Fhionn", "Ḟinn"]);
    });

    it("clears both tiers when no entity is selected", () => {
        rebuildEntityHighlights([
            { docId: "doc-a", entityId: "fionn", activeIndex: 0 },
        ]);

        rebuildEntityHighlights([
            { docId: "doc-a", entityId: null, activeIndex: 0 },
        ]);

        expect(painted("tag-entity-active")).toEqual([]);
        expect(painted("tag-entity-other")).toEqual([]);
    });

    //Test: the two features are on screen at once, and neither may wipe the
    //other — rebuildHighlights clears by name, so the names must not collide
    it("leaves the search highlight standing", () => {
        rebuildHighlights([
            { docId: "doc-a", teiDoc: teiDocA, results: [span(0, 1)], activeIndex: 0 },
        ]);

        rebuildEntityHighlights([
            { docId: "doc-a", entityId: "fionn", activeIndex: 0 },
        ]);

        expect(painted("search-match-active")).toEqual(["hello"]);
        expect(painted("tag-entity-active")).toEqual(["Find"]);
    });

    it("degrades to nothing for a column with no occurrences", () => {
        rebuildEntityHighlights([
            { docId: "doc-b", entityId: "cailte", activeIndex: 0 },
        ]);

        expect(painted("tag-entity-active")).toEqual([]);
        expect(painted("tag-entity-other")).toEqual([]);
    });
});

describe("entityOccurrences", () => {
    beforeEach(() => {
        makeColumn(
            "doc-a",
            '<span data-tei-entity data-tei-ref="#fionn">Find</span>' +
            '<span data-tei-entity data-tei-ref="#fionn">Ḟinn</span>',
        );
    });

    afterEach(() => {
        document.body.innerHTML = "";
    });

    it("returns the entity's occurrences in reading order", () => {
        expect(entityOccurrences("doc-a", "fionn").map((el) => el.textContent))
            .toEqual(["Find", "Ḟinn"]);
    });

    it("returns nothing for a column that is not on screen", () => {
        expect(entityOccurrences("doc-missing", "fionn")).toEqual([]);
    });
});

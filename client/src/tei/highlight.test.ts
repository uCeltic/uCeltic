import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { rebuildHighlights, setQuerySourceHighlight } from "./highlight";
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
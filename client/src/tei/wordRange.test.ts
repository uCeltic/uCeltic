import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
    buildAnchorsById,
    buildWordToAnchors,
    buildRangesForWordSpan,
} from "./wordRange";
import type { TEIAnchor } from "../types/tei";

// Two anchors. word_char_offsets are [word_idx, char_start, char_end]
// against each anchor element's own text.
const anchors: TEIAnchor[] = [
    { id: 1, tag: "seg", word_char_offsets: [[0, 0, 5], [1, 6, 11]] }, // "hello world"
    { id: 2, tag: "seg", word_char_offsets: [[2, 0, 3], [3, 4, 7]] }, // "foo bar"
];

describe("buildRangesForWordSpan", () => {
    let columnEl: HTMLElement;

    beforeEach(() => {
        columnEl = document.createElement("div");
        columnEl.innerHTML =
            '<span data-tei-anchor-id="1">hello world</span>' +
            '<span data-tei-anchor-id="2">foo bar</span>';
        document.body.appendChild(columnEl);
    });

    afterEach(() => {
        columnEl.remove();
    });

    //Test: builds one DOM range per anchor when a word span crosses anchors
    it("builds one DOM range per anchor when a word span crosses anchors", () => {
        const ranges = buildRangesForWordSpan(
            columnEl,
            buildAnchorsById(anchors),
            buildWordToAnchors(anchors),
            1,
            3,
        );

        expect(ranges).toHaveLength(2);
        expect(ranges.map((r) => r.toString())).toEqual(["world", "foo"]);
    });

    //Test: returns no ranges for an empty word span
    it("returns no ranges for an empty word span", () => {
        const ranges = buildRangesForWordSpan(
            columnEl,
            buildAnchorsById(anchors),
            buildWordToAnchors(anchors),
            2,
            2,
        );

        expect(ranges).toHaveLength(0);
    });
});

/**
 * #145: editorial TEI marks up inside words, so one word routinely occupies
 * several elements. `tal<expan>am</expan>` is a single word `talam` whose
 * characters live in two anchors — 27-48% of words in the research corpus are
 * like this, so highlighting them is the common case, not an edge case.
 */
describe("buildRangesForWordSpan across a word split by inline markup", () => {
    let columnEl: HTMLElement;

    // <l>tal<expan>am</expan> ro</l>. The line's own text is "tal" + " ro",
    // so its coordinates run 0..5 and skip straight over the expan.
    const splitAnchors: TEIAnchor[] = [
        { id: 1, tag: "l", word_char_offsets: [[0, 0, 3], [1, 4, 6]] },
        { id: 2, tag: "expan", word_char_offsets: [[0, 0, 2]] },
    ];

    beforeEach(() => {
        columnEl = document.createElement("div");
        columnEl.innerHTML =
            '<span data-tei-anchor-id="1">tal' +
            '<span data-tei-anchor-id="2">am</span> ro</span>';
        document.body.appendChild(columnEl);
    });

    afterEach(() => {
        columnEl.remove();
    });

    it("covers every fragment of a word that spans two anchors", () => {
        const ranges = buildRangesForWordSpan(
            columnEl,
            buildAnchorsById(splitAnchors),
            buildWordToAnchors(splitAnchors),
            0,
            1,
        );

        expect(ranges.map((r) => r.toString())).toEqual(["tal", "am"]);
    });

    it("does not drag the following word into the highlight", () => {
        const ranges = buildRangesForWordSpan(
            columnEl,
            buildAnchorsById(splitAnchors),
            buildWordToAnchors(splitAnchors),
            1,
            2,
        );

        expect(ranges.map((r) => r.toString())).toEqual(["ro"]);
    });
});

/**
 * `annsin`, `fīarfaig` and `Lethderg` each assemble from four anchors in the
 * research files, and the widest word found spans seven. Two anchors is not
 * the worst case, so the four-anchor case gets its own test.
 */
describe("buildRangesForWordSpan across a word split four ways", () => {
    let columnEl: HTMLElement;

    // <l>a<expan>n</expan>n<expan>si</expan>n</l> -> the word "annsin".
    // The line's own text is "a" + "n" + "n", coordinates 0..2.
    const fourWay: TEIAnchor[] = [
        { id: 1, tag: "l", word_char_offsets: [[0, 0, 3]] },
        { id: 2, tag: "expan", word_char_offsets: [[0, 0, 1]] },
        { id: 3, tag: "expan", word_char_offsets: [[0, 0, 2]] },
    ];

    beforeEach(() => {
        columnEl = document.createElement("div");
        columnEl.innerHTML =
            '<span data-tei-anchor-id="1">a' +
            '<span data-tei-anchor-id="2">n</span>n' +
            '<span data-tei-anchor-id="3">si</span>n</span>';
        document.body.appendChild(columnEl);
    });

    afterEach(() => {
        columnEl.remove();
    });

    it("covers all four fragments", () => {
        const ranges = buildRangesForWordSpan(
            columnEl,
            buildAnchorsById(fourWay),
            buildWordToAnchors(fourWay),
            0,
            1,
        );

        // The line contributes one range spanning its own three characters,
        // which in the DOM stretches across the expans sitting between them.
        expect(ranges.map((r) => r.toString()).join("|")).toBe("annsin|n|si");
    });
});

describe("buildWordToAnchors", () => {
    it("lists every anchor a word touches, in document order", () => {
        const map = buildWordToAnchors([
            { id: 1, tag: "l", word_char_offsets: [[0, 0, 3], [1, 4, 6]] },
            { id: 2, tag: "expan", word_char_offsets: [[0, 0, 2]] },
        ]);

        expect(map.get(0)).toEqual([1, 2]);
        expect(map.get(1)).toEqual([1]);
    });

    it("has no entry for a word no anchor claims", () => {
        const map = buildWordToAnchors(anchors);

        expect(map.get(99)).toBeUndefined();
    });
});

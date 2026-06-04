import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
    buildAnchorsById,
    buildWordToAnchor,
    buildRangesForWordSpan,
} from "./wordRange";
import type { TEIAnchor, TEIWordEntry } from "../types/tei";

// Two anchors. word_char_offsets are [word_idx, char_start, char_end]
// against each anchor element's own text.
const anchors: TEIAnchor[] = [
    { id: 1, tag: "seg", word_char_offsets: [[0, 0, 5], [1, 6, 11]] }, // "hello world"
    { id: 2, tag: "seg", word_char_offsets: [[2, 0, 3], [3, 4, 7]] }, // "foo bar"
];
const wordArray: TEIWordEntry[] = [
    { w: "hello", a: 1, sep: " " },
    { w: "world", a: 1, sep: " " },
    { w: "foo", a: 2, sep: " " },
    { w: "bar", a: 2, sep: "" },
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
            buildWordToAnchor(wordArray),
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
            buildWordToAnchor(wordArray),
            2,
            2,
        );

        expect(ranges).toHaveLength(0);
    });
});
/**
 * The list and the components have to stay one thing.
 *
 * `ENTITY_TAGS` is what the Tag Filter counts in `parsed_json`; `data-tei-entity`
 * and the group-id attributes (`data-tei-ref`, `data-tei-nym-ref`) are what the
 * reader paints in the DOM. If a name element is added to `names.tsx` and not to
 * the list, the menu will under-count it while the highlight still finds it — a
 * drift no other test would notice.
 *
 * The reverse drift is asserted here too: every listed element must emit BOTH
 * group-id attributes, or a file that groups its names the way this element
 * does becomes unfindable while still rendering (#162).
 */
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { ENTITY_TAGS } from "./entityElements";
import { elementMap } from "./elementMap";
import type { TEIElementNode } from "../types/tei";

describe("ENTITY_TAGS", () => {
    it("every listed tag renders as a named entity carrying its group id", () => {
        for (const tag of ENTITY_TAGS) {
            const Component = elementMap[tag];
            expect(Component, `${tag} has no component`).toBeDefined();

            // Both spellings of the group id, because the corpus has used
            // both and `entityOccurrences` looks for either. A component that
            // emitted only one would drop half the ways a file can say who a
            // name belongs to, silently.
            const node: TEIElementNode = {
                tag,
                attrs: { ref: "#fionn", nymRef: "F64" },
            };
            const { container } = render(
                <Component node={node} anchorId={0}>Find</Component>,
            );

            const el = container.querySelector("[data-tei-entity]");
            expect(el, `${tag} renders no data-tei-entity`).not.toBeNull();
            expect(el?.getAttribute("data-tei-ref"), tag).toBe("#fionn");
            expect(el?.getAttribute("data-tei-nym-ref"), tag).toBe("F64");
        }
    });

    it("no other element in the map claims to be a named entity", () => {
        const listed = new Set<string>(ENTITY_TAGS);

        for (const [tag, Component] of Object.entries(elementMap)) {
            if (listed.has(tag)) continue;
            const { container } = render(
                <Component node={{ tag }} anchorId={0}>text</Component>,
            );

            expect(
                container.querySelector("[data-tei-entity]"),
                `${tag} is marked as a named entity but is not in ENTITY_TAGS`,
            ).toBeNull();
        }
    });
});

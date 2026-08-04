/**
 * #162 — the Tag Filter on the re-cut corpus.
 *
 * The control used to offer the people and places each manuscript declared in a
 * `standOff` authority list. That corpus is gone, and its reader with it: the
 * witnesses that replaced it group their named entities by a bare `@nymRef`
 * group id (`nymRef="F64"`) that no file explains, so there is no headword in
 * any document to put in a menu. Until the registry slice supplies one, the
 * honest state of this control is empty — and empty is what these tests hold it
 * to, on the markup the corpus actually carries rather than on nothing at all.
 *
 * What the menu is *not* allowed to fall back to is the thing it was before
 * both: a hard-coded list of TEI element names, which offered options no
 * document could match (#147). An empty menu is a true statement; that one was
 * not.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import TagFilterButton from "./TagFilterButton";
import { useWorkspaceStore } from "../../store/workspaceStore";
import { useDocumentStore } from "../../store/documentStore";
import type { Document } from "../../types/document";
import type { TEIDoc, TEIElementNode, TEINode, TEIWork } from "../../types/tei";

function text(value: string): TEINode {
    return { type: "text", segments: [{ kind: "word", text: value, idx: 0 }] };
}

function named(tag: string, attrs: Record<string, string>, value: string): TEIElementNode {
    return { tag, attrs, children: [text(value)] };
}

function teiDoc(id: string, body: TEINode[], work: TEIWork | null = null): Document {
    return {
        id,
        title: id,
        format: "tei",
        content: {
            id: 1,
            title: id,
            language: "ga",
            work,
            created_at: "",
            meta: { title: id, author: "", language: "ga", pbCount: 0 },
            anchors: [],
            word_array: [],
            parsed_json: {
                tag: "TEI",
                children: [{ tag: "text", children: [{ tag: "body", children: body }] }],
            },
        } as TEIDoc,
    };
}

// The current corpus's shape: `name` / `addName` carrying a group id and no
// `standOff` anywhere to say what the id names.
const lis204 = teiDoc("lis204", [
    named("name", { type: "person", nymRef: "F64" }, "Ḟinn"),
    named("name", { type: "person", nymRef: "C6" }, "Caílti"),
    named("name", { type: "place", nymRef: "e6" }, "Ēirinn"),
]);
const laud610 = teiDoc("laud610", [
    named("name", { type: "person", nymRef: "F64" }, "Find"),
    named("addName", { nymRef: "P1" }, "Tāilgend"),
]);

function openDocs(...docs: Document[]) {
    useDocumentStore.setState({
        openDocuments: docs,
        visibleDocumentIds: docs.map((d) => d.id),
    });
}

beforeEach(() => {
    useWorkspaceStore.setState({
        selectedEntityId: null,
        entityIndexByDocument: {},
        selectedWorkId: null,
    });
    openDocs(lis204, laud610);
});

// the dropdown only exists once the trigger is clicked open
function open() {
    render(<TagFilterButton />);
    fireEvent.click(screen.getByRole("button", { name: /all tags/i }));
}

describe("TagFilterButton", () => {
    //Test: a corpus that groups by @nymRef offers nothing, because nothing in
    //it says what a group id stands for
    it("offers no options for documents that group by nymRef alone", () => {
        open();

        expect(screen.queryByRole("menuitemradio")).not.toBeInTheDocument();
    });

    //Test: and it says so about itself, not about the manuscripts — they are
    //full of named entities; what is missing is the grouping
    it("says the filter has nothing to offer, not that the text has no names", () => {
        open();

        expect(screen.getByText(/no named entities to filter by/i)).toBeInTheDocument();
        expect(screen.queryByText(/in the open documents/i)).not.toBeInTheDocument();
    });

    //Test: empty is empty — no kind headings offering a group with nothing in it
    it("shows no Person or Place heading when there is nothing under them", () => {
        open();

        expect(screen.queryByText(/Person \(/)).not.toBeInTheDocument();
        expect(screen.queryByText(/Place \(/)).not.toBeInTheDocument();
    });

    //Test: the element-name vocabulary stays gone — none of these was ever a
    //filter option that could match anything in this corpus (#147)
    it("no longer offers TEI element names as options", () => {
        open();

        for (const gone of ["Geographic Feature", "Organisation", "Referring String"]) {
            expect(screen.queryByText(gone)).not.toBeInTheDocument();
        }
    });

    //Test: nothing selected filters nothing, so the trigger reads "All Tags"
    it("labels the trigger All Tags", () => {
        render(<TagFilterButton />);

        expect(screen.getByRole("button")).toHaveTextContent("All Tags");
    });

    //Test: a selection left in the store by an earlier corpus resolves to no
    //entry, and the trigger falls back rather than rendering `undefined`
    it("keeps reading All Tags when the selected id matches no entry", () => {
        render(<TagFilterButton />);

        act(() => useWorkspaceStore.getState().setSelectedEntityId("fionn"));

        expect(screen.getByRole("button")).toHaveTextContent("All Tags");
    });

    //Test: with nothing open there is nothing to offer, and no crash
    it("offers nothing when no document is open", () => {
        openDocs();
        open();

        expect(screen.queryByRole("menuitemradio")).not.toBeInTheDocument();
    });
});

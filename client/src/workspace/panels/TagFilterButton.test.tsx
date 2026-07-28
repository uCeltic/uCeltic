/**
 * #147 — the Tag Filter offers the people and places the open manuscripts
 * declare about themselves, never a hard-coded vocabulary.
 *
 * The fixtures carry the corpus's real shapes: `<person xml:id="fionn">` with a
 * canonical headword and its variants in `standOff`, and `<persName ref="#fionn">`
 * in the body.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
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

const authority: TEIElementNode = {
    tag: "standOff",
    children: [
        {
            tag: "listPerson",
            children: [
                {
                    tag: "person",
                    attrs: { id: "fionn" },
                    children: [
                        named("persName", { type: "canonical" }, "Find mac Cumaill"),
                        named("persName", { type: "variant" }, "Ḟinn"),
                    ],
                },
                {
                    tag: "person",
                    attrs: { id: "cailte" },
                    children: [
                        named("persName", { type: "canonical" }, "Caílte mac Rónáin"),
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
                    children: [named("placeName", { type: "canonical" }, "Ériu")],
                },
            ],
        },
    ],
};

function teiDoc(
    id: string,
    body: TEINode[],
    withAuthority = true,
    work: TEIWork | null = null,
): Document {
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
                children: [
                    ...(withAuthority ? [authority] : []),
                    { tag: "text", children: [{ tag: "body", children: body }] },
                ],
            },
        } as TEIDoc,
    };
}

// G 126: Fionn twice, Ériu once. Franciscan A 4: Fionn once, Caílte once.
const g126 = teiDoc("g126", [
    named("persName", { ref: "#fionn" }, "Find"),
    named("persName", { ref: "#fionn" }, "Ḟinn"),
    named("placeName", { ref: "#eriu" }, "hÉrinn"),
]);
const franciscan = teiDoc("franciscan", [
    named("persName", { ref: "#fionn" }, "Fionn"),
    named("persName", { ref: "#cailte" }, "Chaílte"),
]);
const plain = teiDoc("shakespear", [named("persName", {}, "Hamlet")], false);

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
    openDocs(g126, franciscan);
});

// the dropdown only exists once the trigger is clicked open
function open() {
    render(<TagFilterButton />);
    fireEvent.click(screen.getByRole("button", { name: /all tags/i }));
}

describe("TagFilterButton", () => {
    //Test: the options are the open documents' own authority entries, grouped
    //by kind — never an element-name vocabulary
    it("offers the people and places the open documents declare", () => {
        open();

        expect(screen.getByText(/Person \(2\)/)).toBeInTheDocument();
        expect(screen.getByText(/Place \(1\)/)).toBeInTheDocument();
        for (const headword of ["Find mac Cumaill", "Caílte mac Rónáin", "Ériu"]) {
            expect(screen.getByRole("menuitemradio", { name: new RegExp(headword) }))
                .toBeInTheDocument();
        }
    });

    //Test: the element-name vocabulary is gone — none of these was ever a
    //filter option that could match anything in this corpus
    it("no longer offers TEI element names as options", () => {
        open();

        for (const gone of ["Geographic Feature", "Organisation", "Referring String"]) {
            expect(screen.queryByText(gone)).not.toBeInTheDocument();
        }
    });

    //Test: one number per visible column, in visible order, so "which
    //manuscript dwells on Fionn?" is answerable at a glance
    it("shows each entry's occurrence count per column, in visible order", () => {
        open();

        const fionn = screen.getByRole("menuitemradio", { name: /Find mac Cumaill/ });
        expect(within(fionn).getByText("2 · 1")).toBeInTheDocument();
    });

    //Test: an entry missing from one column reads as 0 rather than vanishing
    it("reports an entry absent from a column as 0", () => {
        open();

        const eriu = screen.getByRole("menuitemradio", { name: /Ériu/ });
        expect(within(eriu).getByText("1 · 0")).toBeInTheDocument();
    });

    //Test: single-select — the navigation below is over one entity's occurrences
    it("selects one entity at a time", () => {
        open();

        fireEvent.click(screen.getByRole("menuitemradio", { name: /Find mac Cumaill/ }));
        expect(useWorkspaceStore.getState().selectedEntityId).toBe("fionn");

        fireEvent.click(screen.getByRole("menuitemradio", { name: /Ériu/ }));
        expect(useWorkspaceStore.getState().selectedEntityId).toBe("eriu");
    });

    //Test: clicking the selected entry again stops following that person
    it("clears the selection when the selected entry is clicked again", () => {
        open();

        fireEvent.click(screen.getByRole("menuitemradio", { name: /Find mac Cumaill/ }));
        fireEvent.click(screen.getByRole("menuitemradio", { name: /Find mac Cumaill/ }));

        expect(useWorkspaceStore.getState().selectedEntityId).toBeNull();
    });

    //Test: the trigger reports who is being followed
    it("labels the trigger with the selected headword", () => {
        render(<TagFilterButton />);
        expect(screen.getByRole("button")).toHaveTextContent("All Tags");

        act(() => useWorkspaceStore.getState().setSelectedEntityId("cailte"));
        expect(screen.getByRole("button")).toHaveTextContent("Caílte mac Rónáin");
    });

    //Test: a document with no authority list contributes nothing — no fallback
    //to element-name matching, which is the behaviour this issue removes
    it("offers nothing for a document with no authority list", () => {
        openDocs(plain);
        open();

        expect(screen.queryByRole("menuitemradio")).not.toBeInTheDocument();
        expect(screen.getByText(/no named entities/i)).toBeInTheDocument();
    });

    //Test: with nothing open there is nothing to offer
    it("offers nothing when no document is open", () => {
        openDocs();
        open();

        expect(screen.queryByRole("menuitemradio")).not.toBeInTheDocument();
    });
});

/**
 * #152 — the two toolbar dropdowns are linked one way: choosing a work narrows
 * this menu to that work's entries; choosing an entity never touches the work.
 */
describe("TagFilterButton narrowed by the selected work", () => {
    const acallam: TEIWork = { id: 1, name: "Acallam na Senórach", slug: "acallam" };
    const tain: TEIWork = { id: 2, name: "Táin Bó Cúailnge", slug: "tain" };

    // Same bodies as above, but each column now belongs to a work.
    const acallamDoc = teiDoc(
        "g126-acallam",
        [named("persName", { ref: "#fionn" }, "Find")],
        true,
        acallam,
    );
    const tainDoc = teiDoc(
        "leinster-tain",
        [named("persName", { ref: "#cailte" }, "Chaílte")],
        true,
        tain,
    );

    it("offers only the entries of the columns belonging to the selected work", () => {
        openDocs(acallamDoc, tainDoc);
        useWorkspaceStore.setState({ selectedWorkId: acallam.id });
        open();

        // Fionn is named in the Acallam column; Caílte only in the Táin one, so
        // he is declared but never referenced within the narrowed set.
        const fionn = screen.getByRole("menuitemradio", { name: /Find mac Cumaill/ });
        expect(fionn).toHaveTextContent(/^Find mac Cumaill1$/);
    });

    it("counts one column per document in the work, not per open column", () => {
        openDocs(acallamDoc, tainDoc);
        useWorkspaceStore.setState({ selectedWorkId: acallam.id });
        open();

        // one number, not two — the Táin column is not part of this menu
        expect(
            screen.getByRole("menuitemradio", { name: /Find mac Cumaill/ }),
        ).toHaveTextContent(/^Find mac Cumaill1$/);
    });

    it("falls back to every open column when no work is selected", () => {
        openDocs(acallamDoc, tainDoc);
        open();

        expect(
            screen.getByRole("menuitemradio", { name: /Find mac Cumaill/ }),
        ).toHaveTextContent(/^Find mac Cumaill1 · 0$/);
    });

    // A document with no work is invisible to a work selection, but the menu
    // must not vanish for it when no work is chosen.
    it("offers nothing when the selected work has no open column", () => {
        openDocs(tainDoc);
        useWorkspaceStore.setState({ selectedWorkId: acallam.id });
        open();

        expect(screen.queryByRole("menuitemradio")).not.toBeInTheDocument();
    });
});

/**
 * #152, #162 — which columns the Tag Filter is a menu *of*.
 *
 * The hook answers two things: the entries on offer, and where each column sits
 * in every entry's per-column arrays. Only the second is answerable on the
 * current corpus (#162), and it is the half that has to survive the swap — a
 * work selection narrowing the menu is the one-way link between the two toolbar
 * dropdowns (#152), and it was covered until now only through the counts the
 * menu printed. With no counts to read, it is asserted here directly, so the
 * registry slice inherits it rather than rediscovers it.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useEntityMenu } from "./useEntityMenu";
import { useDocumentStore } from "../store/documentStore";
import { useWorkspaceStore } from "../store/workspaceStore";
import type { Document } from "../types/document";
import type { TEIDoc, TEIWork } from "../types/tei";

const acallam: TEIWork = { id: 1, name: "Acallam na Senórach", slug: "acallam" };
const tain: TEIWork = { id: 2, name: "Táin Bó Cúailnge", slug: "tain" };

function teiDoc(id: string, work: TEIWork | null): Document {
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
                children: [{ tag: "text", children: [{ tag: "body", children: [] }] }],
            },
        } as TEIDoc,
    };
}

const laud610 = teiDoc("laud610", acallam);
const lis204 = teiDoc("lis204", acallam);
const leinster = teiDoc("leinster", tain);
const unassigned = teiDoc("shakespear", null);
// A local .txt column: no marked-up entities, so nothing for it to say about one.
const plain: Document = { id: "notes", title: "notes", format: "txt", content: "hello" };

function openDocs(...docs: Document[]) {
    useDocumentStore.setState({
        openDocuments: docs,
        visibleDocumentIds: docs.map((d) => d.id),
    });
}

beforeEach(() => {
    useWorkspaceStore.setState({ selectedWorkId: null, selectedEntityId: null });
});

describe("useEntityMenu", () => {
    //Test: the menu is empty on a corpus whose entities are grouped by an
    //unexplained @nymRef — no entry is invented for an id with no headword
    it("offers no entries on the current corpus", () => {
        openDocs(laud610, lis204);

        const { result } = renderHook(() => useEntityMenu());

        expect(result.current.entries).toEqual([]);
    });

    //Test: every visible TEI column gets an index, in visible order
    it("indexes the visible TEI columns in the order they are on screen", () => {
        openDocs(laud610, lis204);

        const { result } = renderHook(() => useEntityMenu());

        expect([...result.current.columnIndexById]).toEqual([
            ["laud610", 0],
            ["lis204", 1],
        ]);
    });

    //Test: a non-TEI column is not a column of this menu at all
    it("leaves out a column holding a non-TEI document", () => {
        openDocs(laud610, plain);

        const { result } = renderHook(() => useEntityMenu());

        expect(result.current.columnIndexById.has("notes")).toBe(false);
    });

    //Test: choosing a work narrows what the menu is *of*, and the indices
    //close up behind the columns it drops — a count is per column of THIS menu
    it("narrows to the selected work's columns and renumbers them", () => {
        openDocs(leinster, laud610, lis204);
        useWorkspaceStore.setState({ selectedWorkId: acallam.id });

        const { result } = renderHook(() => useEntityMenu());

        expect([...result.current.columnIndexById]).toEqual([
            ["laud610", 0],
            ["lis204", 1],
        ]);
    });

    //Test: a document belonging to no work is offered while no work is chosen,
    //and is simply not in any work's set once one is
    it("keeps an unassigned document until a work is selected", () => {
        openDocs(unassigned);

        const { result, rerender } = renderHook(() => useEntityMenu());
        expect(result.current.columnIndexById.has("shakespear")).toBe(true);

        useWorkspaceStore.setState({ selectedWorkId: acallam.id });
        rerender();

        expect(result.current.columnIndexById.has("shakespear")).toBe(false);
    });
});

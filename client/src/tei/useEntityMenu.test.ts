/**
 * #152, #163 — which columns the Tag Filter is a menu *of*, and what it offers
 * for them.
 *
 * The hook answers two things and has to answer them together: the entries on
 * offer, and where each column sits in every entry's `counts`. Both readers of
 * the menu — the toolbar dropdown and the per-column navigation cards — read
 * this one derivation, so the number in the menu and the number on a card can
 * never disagree.
 *
 * A work selection narrowing the menu is the one-way link between the two
 * toolbar dropdowns (#152), and it narrows both halves: the columns counted,
 * and therefore the entities worth offering at all.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useEntityMenu } from "./useEntityMenu";
import { useDocumentStore } from "../store/documentStore";
import { useNameRegistryStore } from "../store/nameRegistryStore";
import { useWorkspaceStore } from "../store/workspaceStore";
import type { Document } from "../types/document";
import type { NameEntity, TEIDoc, TEINameIndex, TEIWork } from "../types/tei";

const acallam: TEIWork = { id: 1, name: "Acallam na Senórach", slug: "acallam" };
const tain: TEIWork = { id: 2, name: "Táin Bó Cúailnge", slug: "tain" };

const REGISTER: NameEntity[] = [
    { code: "F64", kind: "person", headword: "Find" },
    { code: "e6", kind: "place", headword: "Érend" },
];

function index(counts: Record<string, number>): TEINameIndex {
    return Object.fromEntries(
        Object.entries(counts).map(([code, count]) => [
            code,
            { count, types: {}, variants: {}, anchors: [] },
        ]),
    );
}

function teiDoc(
    id: string,
    work: TEIWork | null,
    nameIndex: TEINameIndex = null,
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
            name_index: nameIndex,
            parsed_json: {
                tag: "TEI",
                children: [{ tag: "text", children: [{ tag: "body", children: [] }] }],
            },
        } as TEIDoc,
    };
}

const laud610 = teiDoc("laud610", acallam, index({ F64: 17, e6: 28 }));
const lis204 = teiDoc("lis204", acallam, index({ F64: 16 }));
const leinster = teiDoc("leinster", tain, index({ F64: 99 }));
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
    useNameRegistryStore.setState({ entities: REGISTER, load: () => {} });
});

describe("useEntityMenu", () => {
    //Test: the register names the group, the open columns count it — a row is
    //the join, and its counts line up with the columns on screen
    it("joins the register to each visible column's own counts", () => {
        openDocs(laud610, lis204);

        const { result } = renderHook(() => useEntityMenu());

        expect(result.current.entries).toEqual([
            { id: "F64", kind: "person", headword: "Find", counts: [17, 16] },
            { id: "e6", kind: "place", headword: "Érend", counts: [28, 0] },
        ]);
    });

    //Test: without a register there is no name to put in a menu, however much
    //grouping the documents carry — the empty state #162 left behind
    it("offers nothing while the register is empty", () => {
        useNameRegistryStore.setState({ entities: [] });
        openDocs(laud610, lis204);

        const { result } = renderHook(() => useEntityMenu());

        expect(result.current.entries).toEqual([]);
    });

    //Test: the register is asked for once, by the hook rather than by whichever
    //component happens to mount first
    it("asks for the register when it is used", () => {
        let asked = 0;
        useNameRegistryStore.setState({ entities: [], load: () => { asked += 1; } });
        openDocs(laud610);

        renderHook(() => useEntityMenu());

        expect(asked).toBe(1);
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

    //Test: and the counts narrow with them — the Táin column's 99 occurrences
    //of Find are not part of what this menu is counting
    it("counts only the columns the chosen work left in the menu", () => {
        openDocs(leinster, laud610, lis204);
        useWorkspaceStore.setState({ selectedWorkId: acallam.id });

        const { result } = renderHook(() => useEntityMenu());

        expect(result.current.entries[0].counts).toEqual([17, 16]);
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

/**
 * #152 — one control replaces "All Works" (a hard-coded, fictional list) and
 * "Open TEI" (a flat list of every document): works, then their manuscripts.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import WorkPicker from "./WorkPicker";
import { useDocumentStore, MAX_OPEN_DOCUMENTS } from "../../store/documentStore";
import { useWorkspaceStore } from "../../store/workspaceStore";
import type { TEICatalogEntry, TEIDoc, TEIWork } from "../../types/tei";

vi.mock("../../api/tei", () => ({
    listTEIDocs: vi.fn(),
    fetchTEIDoc: vi.fn(),
}));
import { listTEIDocs, fetchTEIDoc } from "../../api/tei";
const mockedList = vi.mocked(listTEIDocs);
const mockedFetch = vi.mocked(fetchTEIDoc);

const acallam: TEIWork = { id: 1, name: "Acallam na Senórach", slug: "acallam" };
const tain: TEIWork = { id: 2, name: "Táin Bó Cúailnge", slug: "tain" };

function entry(id: number, title: string, work: TEIWork | null): TEICatalogEntry {
    return { id, title, language: "ga", work, created_at: "" };
}

const catalogue = [
    entry(1, "Laud Misc. 610", acallam),
    entry(2, "Franciscan A 4", acallam),
    entry(3, "G 126", acallam),
    entry(4, "Book of Leinster", tain),
    entry(5, "Shakespeare", null),
];

function doc(id: number, title: string): TEIDoc {
    return {
        id,
        title,
        language: "ga",
        work: null,
        parsed_json: { tag: "TEI", children: [] },
        created_at: "",
        meta: { title, author: "", language: "ga", pbCount: 0 },
        anchors: [],
        word_array: [],
    };
}

// Occupy n columns, so the cap can be reached without opening real documents.
function fillWith(n: number) {
    useDocumentStore.setState({
        openDocuments: Array.from({ length: n }, (_, i) => ({
            id: `doc-filler-${i}`,
            title: `doc ${i}`,
            format: "txt" as const,
            content: "x",
        })),
    });
}

beforeEach(() => {
    mockedList.mockReset().mockResolvedValue(catalogue);
    mockedFetch.mockReset().mockImplementation(async (id: number) => doc(id, `Doc ${id}`));
    useDocumentStore.setState({
        openDocuments: [],
        visibleDocumentIds: [],
        activeDocumentId: null,
    });
    useWorkspaceStore.setState({ selectedWorkId: null, statusText: "Ready" });
});

// The catalogue is fetched on first open, so every test starts by opening.
async function openMenu() {
    render(<WorkPicker />);
    fireEvent.click(screen.getByRole("button", { name: /works/i }));
    await screen.findByRole("button", { name: /Acallam na Senórach/ });
}

async function expandWork(name: RegExp) {
    fireEvent.click(screen.getByRole("button", { name }));
    await screen.findByRole("button", { name: /open all/i });
}

describe("WorkPicker", () => {
    //Test: the branches are the corpus's own works — the fictional hard-coded
    //list ("The Finn Cycle", "Saltair na Rann") is gone
    it("lists the works the catalogue declares", async () => {
        await openMenu();

        expect(screen.getByRole("button", { name: /Acallam na Senórach/ })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Táin Bó Cúailnge/ })).toBeInTheDocument();
        expect(screen.queryByText("The Finn Cycle")).not.toBeInTheDocument();
    });

    //Test: the manuscripts are the second level, revealed by expanding a work
    it("shows a work's manuscripts when it is expanded", async () => {
        await openMenu();
        expect(screen.queryByLabelText("Laud Misc. 610")).not.toBeInTheDocument();

        await expandWork(/Acallam na Senórach/);

        for (const title of ["Laud Misc. 610", "Franciscan A 4", "G 126"]) {
            expect(screen.getByLabelText(title)).toBeInTheDocument();
        }
        // the other work's manuscript stays behind its own branch
        expect(screen.queryByLabelText("Book of Leinster")).not.toBeInTheDocument();
    });

    //Test: choosing a work is what narrows the Tag Filter (one-way link)
    it("records the chosen work", async () => {
        await openMenu();
        await expandWork(/Acallam na Senórach/);

        expect(useWorkspaceStore.getState().selectedWorkId).toBe(acallam.id);
    });

    //Test: several manuscripts open in one action
    it("opens every ticked manuscript at once", async () => {
        await openMenu();
        await expandWork(/Acallam na Senórach/);

        fireEvent.click(screen.getByLabelText("Laud Misc. 610"));
        fireEvent.click(screen.getByLabelText("G 126"));
        fireEvent.click(screen.getByRole("button", { name: /open selected/i }));

        await waitFor(() =>
            expect(useDocumentStore.getState().openDocuments).toHaveLength(2),
        );
        expect(mockedFetch.mock.calls.map(([id]) => id)).toEqual([1, 3]);
    });

    //Test: "Open all" takes the whole work without ticking anything
    it("opens the whole work at once", async () => {
        await openMenu();
        await expandWork(/Acallam na Senórach/);

        fireEvent.click(screen.getByRole("button", { name: /open all/i }));

        await waitFor(() =>
            expect(useDocumentStore.getState().openDocuments).toHaveLength(3),
        );
    });

    //Test: the cap is answered deliberately — as many as fit, and a status line
    //saying so, never the alert() this control replaces
    it("opens what fits and says what it left out", async () => {
        const alert = vi.spyOn(window, "alert").mockImplementation(() => {});
        fillWith(MAX_OPEN_DOCUMENTS - 1);

        await openMenu();
        await expandWork(/Acallam na Senórach/);
        fireEvent.click(screen.getByRole("button", { name: /open all/i }));

        await waitFor(() =>
            expect(useWorkspaceStore.getState().statusText).toMatch(/1 of 3/),
        );
        expect(useDocumentStore.getState().openDocuments).toHaveLength(
            MAX_OPEN_DOCUMENTS,
        );
        expect(alert).not.toHaveBeenCalled();
    });

    //Test: a full workspace opens nothing and says why
    it("opens nothing when every column is taken", async () => {
        fillWith(MAX_OPEN_DOCUMENTS);

        await openMenu();
        await expandWork(/Acallam na Senórach/);
        fireEvent.click(screen.getByRole("button", { name: /open all/i }));

        await waitFor(() =>
            expect(useWorkspaceStore.getState().statusText).toMatch(/close a column/i),
        );
        expect(mockedFetch).not.toHaveBeenCalled();
    });

    //Test: a manuscript that cannot fit cannot be ticked either
    it("refuses a tick there is no room for", async () => {
        fillWith(MAX_OPEN_DOCUMENTS - 1);

        await openMenu();
        await expandWork(/Acallam na Senórach/);
        fireEvent.click(screen.getByLabelText("Laud Misc. 610"));

        expect(screen.getByLabelText("G 126")).toBeDisabled();
        expect(screen.getByLabelText("Laud Misc. 610")).toBeEnabled();
    });

    //Test: shakespear.xml and the serafin samples belong to no work and would
    //otherwise be unreachable — the opener is the only way into them
    it("keeps documents with no work openable", async () => {
        await openMenu();
        await expandWork(/Unassigned/);

        fireEvent.click(screen.getByLabelText("Shakespeare"));
        fireEvent.click(screen.getByRole("button", { name: /open selected/i }));

        await waitFor(() =>
            expect(useDocumentStore.getState().openDocuments).toHaveLength(1),
        );
        // "no work" is not a work: nothing for the Tag Filter to narrow to
        expect(useWorkspaceStore.getState().selectedWorkId).toBeNull();
    });

    //Test: the trigger reports which work is being worked on
    it("labels the trigger with the chosen work", async () => {
        await openMenu();
        expect(screen.getAllByRole("button")[0]).toHaveTextContent("Works");

        await expandWork(/Acallam na Senórach/);
        expect(screen.getAllByRole("button")[0]).toHaveTextContent("Acallam na Senórach");
    });

    //Test: an empty catalogue says so rather than showing an empty panel
    it("says when the catalogue is empty", async () => {
        mockedList.mockResolvedValue([]);
        render(<WorkPicker />);
        fireEvent.click(screen.getByRole("button", { name: /works/i }));

        expect(await screen.findByText(/no documents/i)).toBeInTheDocument();
    });
});

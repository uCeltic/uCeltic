import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ToolBar from "./ToolBar";
import { useDocumentStore } from "../../store/documentStore";
import { useSearchStore } from "../../store/searchStore";
import type { Document } from "../../types/document";
import type { TEIDoc } from "../../types/tei";

const teiContent: TEIDoc = {
    id: 1,
    title: "t",
    language: "ga",
    parsed_json: { tag: "body", children: [] },
    created_at: "",
    meta: { title: "", author: "", language: "", pbCount: 0 },
    anchors: [],
    word_array: [],
};
const teiDoc: Document = { id: "doc-a", title: "A", format: "tei", content: teiContent };

beforeEach(() => {
    useDocumentStore.setState({
        openDocuments: [teiDoc],
        visibleDocumentIds: ["doc-a"],
        activeDocumentId: "doc-a",
    });
    useSearchStore.setState({
        query: "",
        resultsByDocument: {},
        activeResultIndexByDocument: {},
        isSearchingByDocument: {},
        searchErrorByDocument: {},
    });
});

// The ToolBar holds the AccountMenu, which links to /account/login — so it now needs a router.
function renderToolBar() {
    return render(
        <MemoryRouter>
            <ToolBar onToggleIIIF={() => {}} />
        </MemoryRouter>,
    );
}

describe("ToolBar re-entrancy guard", () => {
    it("does not trigger a search when Enter is pressed in the search box", () => {
        const runSearch = vi.fn();
        useSearchStore.setState({ runSearch });

        renderToolBar();
        fireEvent.keyDown(screen.getByPlaceholderText("Search documents..."), {
            key: "Enter",
        });

        // search is only triggerable from the Search button now
        expect(runSearch).not.toHaveBeenCalled();
    });

    it("disables the Search button while any column is searching", () => {
        useSearchStore.setState({ isSearchingByDocument: { "doc-a": true } });

        renderToolBar();

        expect(screen.getByRole("button", { name: "Search" })).toBeDisabled();
    });
});

describe("ToolBar search button", () => {
    it("searches every visible TEI document and skips uploaded text columns", () => {
        const runSearch = vi.fn();
        useSearchStore.setState({ runSearch });
        const txtDoc: Document = {
            id: "doc-b",
            title: "B",
            format: "txt",
            content: "plain uploaded text",
        };
        useDocumentStore.setState({
            openDocuments: [teiDoc, txtDoc],
            visibleDocumentIds: ["doc-a", "doc-b"],
        });

        renderToolBar();
        fireEvent.click(screen.getByRole("button", { name: "Search" }));

        expect(runSearch).toHaveBeenCalledOnce();
        expect(runSearch).toHaveBeenCalledWith(1, "doc-a");
    });
});

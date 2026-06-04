import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import DocumentArea from "./DocumentArea";
import { useDocumentStore } from "../../store/documentStore";
import { useSearchStore } from "../../store/searchStore";
import { searchDocument } from "../../api/search";
import type { SearchResult } from "../../types/search";
import type { Document } from "../../types/document";

vi.mock("../../api/search", () => ({ searchDocument: vi.fn() }));
const mockedSearch = vi.mocked(searchDocument);

const doc: Document = {
    id: "doc-1",
    title: "Acallam",
    format: "txt",
    content: "the hound of culann hunts",
};

const result: SearchResult = {
    score: 0.1,
    snippet: "the hound of culann",
    word_start: 0,
    word_end: 4,
    anchor_id: null,
    anchor_tag: null,
    line_no: null,
};

beforeEach(() => {
    mockedSearch.mockReset();
    useDocumentStore.setState({
        openDocuments: [doc],
        visibleDocumentIds: ["doc-1"],
        activeDocumentId: "doc-1",
    });
    useSearchStore.setState({
        query: "",
        resultsByDocument: {},
        activeResultIndexByDocument: {},
        isSearching: false,
    });
});

describe("DocumentArea search flow", () => {
    it("renders the result snippet after a search resolves", async () => {
        mockedSearch.mockResolvedValue([result]);
        render(<DocumentArea />);

        // Before searching, the column shows the empty state.
        expect(screen.getByText("No search results")).toBeInTheDocument();

        //"act" means there will be updates to the DOM, so we need to wait for the next tick
        await act(async () => {
            useSearchStore.getState().setQuery("hound");
            await useSearchStore.getState().runSearch(1, "doc-1");
        });

        expect(screen.getByText("the hound of culann")).toBeInTheDocument();
        expect(screen.getByText("Result 1 / 1")).toBeInTheDocument();
        expect(mockedSearch).toHaveBeenCalledOnce();
    });
});
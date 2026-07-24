import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ToolBar from "./ToolBar";
import { useDocumentStore } from "../../store/documentStore";
import { useSearchStore } from "../../store/searchStore";
import { setQuerySourceHighlight } from "../../tei/highlight";
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
        query: "culann",
        resultsByDocument: {},
        activeResultIndexByDocument: {},
        isSearchingByDocument: {},
        searchErrorByDocument: {},
    });
});

// Stand in for a mark an earlier selection search left on some document's text.
function markQuerySource(text: string) {
    const source = document.createElement("p");
    source.textContent = text;
    document.body.appendChild(source);
    const range = document.createRange();
    range.selectNodeContents(source);
    setQuerySourceHighlight(range);
}

const paintedQuerySource = () =>
    [...(CSS.highlights.get("query-source") ?? [])].map((r) => r.toString());

// the highlight registry and the body outlive a single test — both are global
afterEach(() => {
    CSS.highlights.get("query-source")?.clear();
    document.body.innerHTML = "";
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

describe("ToolBar entity controls", () => {
    //Test: the Mode switcher is gone (ADR-0010) — its "Search ▾" label sat next to the
    //real Search button and read as a second search; the Tag Filter has its slot now
    it("shows the Tag Filter instead of the Mode switcher", () => {
        renderToolBar();

        expect(screen.getByRole("button", { name: /All Tags/ })).toBeInTheDocument();
        expect(
            screen.queryByRole("button", { name: /People & Places|Personal/ }),
        ).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Search" })).toBeInTheDocument();
    });
});

describe("ToolBar overflow menu (#123)", () => {
  it("moves font-size and account off the bar and into the hamburger menu", () => {
    renderToolBar();

    // A hamburger button is on the bar...
    expect(screen.getByRole("button", { name: /menu/i })).toBeInTheDocument();
    // ...and the font-size controls are no longer direct toolbar buttons.
    expect(screen.queryByRole("button", { name: "A+" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "A−" })).not.toBeInTheDocument();
  });

  it("keeps Show / Hide Manuscripts as a direct toolbar button", () => {
    renderToolBar();

    expect(
      screen.getByRole("button", { name: /Manuscripts/ }),
    ).toBeInTheDocument();
  });
});

// Icon-only collapse below the `xl` breakpoint must not drop the client-requirement
// term: the manuscript control's accessible name/tooltip stays "Manuscripts", never
// "Books" (ADR-0011, CONTEXT.md → Manuscript).
describe("ToolBar manuscript control label (#124)", () => {
  it("keeps an accessible name and tooltip of 'Manuscripts', never 'Books'", () => {
    renderToolBar();

    // showIIIF defaults on, so the control reads "Hide Manuscripts".
    const btn = screen.getByRole("button", { name: /Manuscripts/ });
    expect(btn).toHaveAttribute("title", expect.stringMatching(/Manuscripts/));
    expect(btn.getAttribute("title")).not.toMatch(/Book/i);
    expect(
      screen.queryByRole("button", { name: /Books?/i }),
    ).not.toBeInTheDocument();
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

    //Test: the query-source mark points at text an EARLIER selection search ran
    //on — a typed search did not come from it, so it must not stay lit (#95)
    it("clears the query-source highlight left by an earlier selection search", () => {
        useSearchStore.setState({ runSearch: vi.fn() });
        markQuerySource("the hound of culann");

        renderToolBar();
        fireEvent.click(screen.getByRole("button", { name: "Search" }));

        expect(paintedQuerySource()).toEqual([]);
    });

    //Test: a blank bar searches nothing, so it must not strip the on-screen
    //results of the mark showing where they came from
    it("keeps the query-source highlight when the search bar is empty", () => {
        useSearchStore.setState({ runSearch: vi.fn(), query: "   " });
        markQuerySource("the hound of culann");

        renderToolBar();
        fireEvent.click(screen.getByRole("button", { name: "Search" }));

        expect(paintedQuerySource()).toEqual(["the hound of culann"]);
    });
});

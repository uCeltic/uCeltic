import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ToolBar from "./ToolBar";
import { ADD_TEXT_TITLE } from "./localDocumentCopy";
import { toolbarLabelFirstToGo, toolbarLabelLastToGo } from "./buttonStyles";
import { MAX_OPEN_COLUMNS, useDocumentStore } from "../../store/documentStore";
import { useSearchStore } from "../../store/searchStore";
import { useTourStore } from "../../store/tourStore";
import { setQuerySourceHighlight } from "../../tei/highlight";
import type { Document } from "../../types/document";
import type { TEIDoc } from "../../types/tei";

const teiContent: TEIDoc = {
    id: 1,
    title: "t",
    language: "ga",
    work: null,
    parsed_json: { tag: "body", children: [] },
    created_at: "",
    meta: { title: "", author: "", language: "", pbCount: 0 },
    anchors: [],
    word_array: [],
    name_index: null,
};
const teiDoc: Document = { id: "doc-a", title: "A", format: "tei", content: teiContent };

beforeEach(() => {
    useDocumentStore.setState({
        openDocuments: [teiDoc],
        openManuscripts: [],
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
            <ToolBar />
        </MemoryRouter>,
    );
}

describe("ToolBar re-entrancy guard", () => {
    it("does not trigger a search when Enter is pressed in the search box", () => {
        const startSearchRun = vi.fn();
        useSearchStore.setState({ startSearchRun });

        renderToolBar();
        fireEvent.keyDown(screen.getByPlaceholderText("Search documents..."), {
            key: "Enter",
        });

        // search is only triggerable from the Search button now
        expect(startSearchRun).not.toHaveBeenCalled();
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

    const btn = screen.getByRole("button", { name: "Manuscripts" });
    expect(btn).toHaveAttribute("title", "Manuscripts");
    expect(
      screen.queryByRole("button", { name: /Books?/i }),
    ).not.toBeInTheDocument();
  });
});

// The Manuscripts control is an opener now, not a toggle for a side panel, and the
// narrow-window auto-hide it was disabled for is gone (ADR-0025, superseding #160).
describe("ToolBar manuscript opener (#201)", () => {
  it("is a dropdown trigger, not a pressed toggle", () => {
    renderToolBar();

    const btn = screen.getByRole("button", { name: "Manuscripts" });
    expect(btn).not.toHaveAttribute("aria-pressed");
    expect(btn).toHaveAttribute("aria-expanded", "false");
  });

  // jsdom has no viewport to narrow, and no media query is read any more: the
  // control is simply never disabled and never explains itself away.
  it("is enabled, with no 'widen the window' explanation", () => {
    renderToolBar();

    const btn = screen.getByRole("button", { name: "Manuscripts" });
    expect(btn).toBeEnabled();
    expect(btn.parentElement).not.toHaveAttribute(
      "title",
      expect.stringMatching(/widen/i),
    );
  });

  it("opens the manuscript list from the toolbar", () => {
    renderToolBar();

    fireEvent.click(screen.getByRole("button", { name: "Manuscripts" }));

    expect(screen.getByLabelText("Book of Lismore (UCC)")).toBeInTheDocument();
  });
});

// One flip at `xl` made icon-only the *normal* state of the toolbar: a 1080p window
// that is not maximised already sits below 1280. Labels now go in two stages, ordered
// by how much the label says that the icon does not (#174).
describe("ToolBar staged label collapse (#174)", () => {
  const labelSpan = (text: string | RegExp) =>
    screen.getByText(text, { selector: "span" });

  it("drops the Manuscripts label first — the book beside the ▾ already says it", () => {
    renderToolBar();

    expect(labelSpan("Manuscripts ▾")).toHaveClass(toolbarLabelFirstToGo);
  });

  it("drops Add Text at the same stage — the file-plus icon says the same thing", () => {
    renderToolBar();

    expect(labelSpan("Add Text")).toHaveClass(toolbarLabelFirstToGo);
  });

  it("keeps Search's label to the narrower stage", () => {
    renderToolBar();

    expect(labelSpan("Search")).toHaveClass(toolbarLabelLastToGo);
  });
});

// `{anySearching ? "..." : "Search"}` put the only sign of a search in flight inside
// the label — so below the collapse breakpoint a running search looked like an idle
// one. The icon carries it now, identically at every width (#174).
describe("ToolBar search busy state (#174)", () => {
  it("spins the icon and marks the button busy while a column is searching", () => {
    useSearchStore.setState({ isSearchingByDocument: { "doc-a": true } });

    renderToolBar();

    const btn = screen.getByRole("button", { name: "Search" });
    expect(btn).toHaveAttribute("aria-busy", "true");
    expect(btn.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("shows the plain magnifier and no busy flag when nothing is in flight", () => {
    renderToolBar();

    const btn = screen.getByRole("button", { name: "Search" });
    expect(btn).toHaveAttribute("aria-busy", "false");
    expect(btn.querySelector(".animate-spin")).not.toBeInTheDocument();
  });

  // A spinner is the whole busy signal now, and it does not spin under
  // `prefers-reduced-motion` — so without a still cue, those readers would be back
  // to a search in flight looking exactly like an idle one, at every width.
  it("dims the button while busy, so the state survives reduced motion", () => {
    useSearchStore.setState({ isSearchingByDocument: { "doc-a": true } });

    renderToolBar();

    const btn = screen.getByRole("button", { name: "Search" });
    expect(btn.className).toMatch(/disabled:bg-/);
    expect(btn.querySelector(".animate-spin")).toHaveClass(
      "motion-reduce:animate-none",
    );
  });

  // The label no longer flickers to "..." — a word that changes width mid-search
  // shifted every control to its right, and said nothing the spinner does not.
  it("keeps the label reading 'Search' throughout", () => {
    useSearchStore.setState({ isSearchingByDocument: { "doc-a": true } });

    renderToolBar();

    expect(screen.getByText("Search", { selector: "span" })).toBeInTheDocument();
  });
});

describe("ToolBar Help button (#125)", () => {
  it("re-opens the onboarding tour on demand", () => {
    useTourStore.setState({ isOpen: false, manualIndex: 3 });

    renderToolBar();
    fireEvent.click(screen.getByRole("button", { name: /help/i }));

    // start() opens the tour and drops the manual pointer back to the first
    // step; where it resumes from there is the workspace's answer (#177).
    expect(useTourStore.getState().isOpen).toBe(true);
    expect(useTourStore.getState().manualIndex).toBe(0);
  });
});

describe("ToolBar search button", () => {
    it("searches every visible TEI document and skips uploaded text columns", () => {
        const startSearchRun = vi.fn();
        useSearchStore.setState({ startSearchRun });
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

        // one search run over the columns it covers, not a call per column (#186)
        expect(startSearchRun).toHaveBeenCalledOnce();
        expect(startSearchRun).toHaveBeenCalledWith([
            { docId: 1, clientDocId: "doc-a" },
        ]);
    });

    //Test: a Manuscript Column is outside search, and so outside the Search
    //History entry built from the run (ADR-0025)
    it("never searches a manuscript column", () => {
        const startSearchRun = vi.fn();
        useSearchStore.setState({ startSearchRun });
        useDocumentStore.setState({
            openManuscripts: ["book-of-lismore"],
            visibleDocumentIds: ["ms-book-of-lismore", "doc-a"],
        });

        renderToolBar();
        fireEvent.click(screen.getByRole("button", { name: "Search" }));

        expect(startSearchRun).toHaveBeenCalledWith([
            { docId: 1, clientDocId: "doc-a" },
        ]);
    });

    //Test: the query-source mark points at text an EARLIER selection search ran
    //on — a typed search did not come from it, so it must not stay lit (#95)
    it("clears the query-source highlight left by an earlier selection search", () => {
        useSearchStore.setState({ startSearchRun: vi.fn() });
        markQuerySource("the hound of culann");

        renderToolBar();
        fireEvent.click(screen.getByRole("button", { name: "Search" }));

        expect(paintedQuerySource()).toEqual([]);
    });

    //Test: a blank bar searches nothing, so it must not strip the on-screen
    //results of the mark showing where they came from
    it("keeps the query-source highlight when the search bar is empty", () => {
        useSearchStore.setState({ startSearchRun: vi.fn(), query: "   " });
        markQuerySource("the hound of culann");

        renderToolBar();
        fireEvent.click(screen.getByRole("button", { name: "Search" }));

        expect(paintedQuerySource()).toEqual(["the hound of culann"]);
    });
});

// The first of the three places a Local Document's limit is stated (#175): before
// the file is even opened, on the control that opens it.
describe("ToolBar Add Text tooltip (#175)", () => {
    const addText = () => screen.getByRole("button", { name: "Add Text" });

    //Test: the limit is stated where a visitor can still act on it — before the
    //file is opened — and the accessible name stays the two words the button is
    //known by, rather than a sentence.
    it("explains the reading-only limit in the tooltip, keeping Add Text as the name", () => {
        renderToolBar();

        const tooltip = addText().getAttribute("title")!;
        expect(tooltip).toBe(ADD_TEXT_TITLE);
        expect(tooltip).toMatch(/reading only/i);
        expect(tooltip).toMatch(/not searchable/i);
        expect(addText()).toHaveAttribute("aria-label", "Add Text");
    });

    //Test: a Local Document is never uploaded and never stored (CONTEXT.md), so
    //the one word that would tell a visitor their private file left the machine
    //must not appear in the sentence that describes the feature.
    it("never calls opening a local file an upload", () => {
        renderToolBar();

        const tooltip = addText().getAttribute("title")!;
        expect(tooltip).not.toMatch(/upload/i);
        expect(tooltip).toMatch(/stay in your browser/i);
    });
});

// Add Text reads the same free-slot count as both openers: Manuscript Columns use
// the strip's width as much as a text does, so they count against the cap (ADR-0025).
describe("ToolBar Add Text and the shared column cap (#201)", () => {
    it("greys out Add Text when manuscripts take the last slot", () => {
        const fillers: Document[] = Array.from(
            { length: MAX_OPEN_COLUMNS - 1 },
            (_, i) => ({ id: `doc-${i}`, title: `${i}`, format: "txt", content: "x" }),
        );
        useDocumentStore.setState({
            openDocuments: fillers,
            openManuscripts: ["book-of-lismore"],
        });

        renderToolBar();

        expect(screen.getByRole("button", { name: "Add Text" }).className).toMatch(
            /cursor-not-allowed/,
        );
    });
});

import type React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ToolBar from "./ToolBar";
import { useDocumentStore } from "../../store/documentStore";
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
// The manuscript props default to the wide case: panel shown, viewport roomy enough for it.
function renderToolBar(
    props: Partial<React.ComponentProps<typeof ToolBar>> = {},
) {
    return render(
        <MemoryRouter>
            <ToolBar
                onToggleIIIF={() => {}}
                iiifVisible
                iiifTooNarrow={false}
                {...props}
            />
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

    // The panel is on screen here, so the control reads "Hide Manuscripts".
    const btn = screen.getByRole("button", { name: /Manuscripts/ });
    expect(btn).toHaveAttribute("title", expect.stringMatching(/Manuscripts/));
    expect(btn.getAttribute("title")).not.toMatch(/Book/i);
    expect(
      screen.queryByRole("button", { name: /Books?/i }),
    ).not.toBeInTheDocument();
  });
});

// Below the narrow breakpoint the panel auto-hides (ADR-0011), so a toggle that still
// flips claims a state it cannot deliver — it must say so instead (#160).
describe("ToolBar manuscript control at narrow widths (#160)", () => {
  it("disables the control and explains that the window must be widened", () => {
    renderToolBar({ iiifVisible: false, iiifTooNarrow: true });

    const btn = screen.getByRole("button", { name: /Manuscripts/ });
    expect(btn).toBeDisabled();
    expect(btn.className).toMatch(/disabled:text-gray-300/);
    // The tooltip lives on the wrapper: Chrome swallows hover on a disabled control,
    // so a `title` on the button itself would never surface there.
    expect(btn.parentElement).toHaveAttribute(
      "title",
      expect.stringMatching(/widen/i),
    );
    // ...and the button drops its own title, which Firefox *does* render on a
    // disabled control and would show instead of the explanation.
    expect(btn).not.toHaveAttribute("title");
  });

  it("reads 'Show Manuscripts' and is unpressed while the panel is force-hidden", () => {
    renderToolBar({ iiifVisible: false, iiifTooNarrow: true });

    const btn = screen.getByRole("button", { name: "Show Manuscripts" });
    expect(btn).toHaveAttribute("aria-pressed", "false");
  });

  // Blocking the click is the whole of the disable: the stored preference is never
  // touched, which is what lets widening the window restore it (see the layout tests).
  it("swallows the click instead of toggling the stored preference", () => {
    const onToggleIIIF = vi.fn();

    renderToolBar({ iiifVisible: false, iiifTooNarrow: true, onToggleIIIF });
    fireEvent.click(screen.getByRole("button", { name: /Manuscripts/ }));

    expect(onToggleIIIF).not.toHaveBeenCalled();
  });

  it("stays clickable and pressed once the window is wide enough", () => {
    const onToggleIIIF = vi.fn();

    renderToolBar({ iiifVisible: true, iiifTooNarrow: false, onToggleIIIF });
    const btn = screen.getByRole("button", { name: "Hide Manuscripts" });
    fireEvent.click(btn);

    expect(btn).toBeEnabled();
    expect(btn).toHaveAttribute("aria-pressed", "true");
    expect(onToggleIIIF).toHaveBeenCalledOnce();
  });
});

// One flip at `xl` made icon-only the *normal* state of the toolbar: a 1080p window
// that is not maximised already sits below 1280. Labels now go in two stages, ordered
// by how much the label says that the icon does not (#174).
describe("ToolBar staged label collapse (#174)", () => {
  const labelSpan = (text: string | RegExp) =>
    screen.getByText(text, { selector: "span" });

  it("drops the manuscript toggle's label first — its state is already in the colour and aria-pressed", () => {
    renderToolBar();

    expect(labelSpan("Hide Manuscripts")).toHaveClass("xl:inline");
  });

  it("drops Add Text at the same stage — the file-plus icon says the same thing", () => {
    renderToolBar();

    expect(labelSpan("Add Text")).toHaveClass("xl:inline");
  });

  it("keeps Search's label to the narrower stage", () => {
    renderToolBar();

    expect(labelSpan("Search")).toHaveClass("lg:inline");
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
    useTourStore.setState({ isOpen: false, stepIndex: 3 });

    renderToolBar();
    fireEvent.click(screen.getByRole("button", { name: /help/i }));

    // start() opens the tour back at the first step, regardless of a prior run.
    expect(useTourStore.getState().isOpen).toBe(true);
    expect(useTourStore.getState().stepIndex).toBe(0);
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

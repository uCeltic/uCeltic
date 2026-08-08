/**
 * These probe the **real panels**, not a fixture of markup written to match the
 * selectors (#178). The three gates here read state no store holds, so the
 * selectors in `tourDomSignals.ts` are a standing coupling to how WorkPicker and
 * DocumentArea render — and the only thing that can catch a break is a test that
 * renders them and asks the probe what it sees.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import WorkPicker from "../panels/WorkPicker";
import DocumentArea from "../panels/DocumentArea";
import { probeTourDom } from "./tourDomSignals";
import { useDocumentStore } from "../../store/documentStore";
import { useSearchStore } from "../../store/searchStore";
import { useWorkspaceStore } from "../../store/workspaceStore";
import type { Document } from "../../types/document";
import type { TEICatalogEntry, TEIWork } from "../../types/tei";

vi.mock("../../api/log", () => ({ logEvent: vi.fn() }));
vi.mock("../../api/tei", () => ({
  listTEIDocs: vi.fn(),
  fetchTEIDoc: vi.fn(),
  // The reading pane's entity menu asks for the Name Register on mount; it is
  // not what these tests are about.
  listNameEntities: vi.fn().mockResolvedValue([]),
}));
import { listTEIDocs } from "../../api/tei";
const mockedList = vi.mocked(listTEIDocs);

const acallam: TEIWork = { id: 1, name: "Acallam na Senórach", slug: "acallam" };
const tain: TEIWork = { id: 2, name: "Táin Bó Cúailnge", slug: "tain" };

const entry = (
  id: number,
  title: string,
  work: TEIWork,
): TEICatalogEntry => ({ id, title, language: "ga", work, created_at: "" });

const catalogue = [
  entry(1, "Laud Misc. 610", acallam),
  entry(2, "Franciscan A 4", acallam),
  entry(3, "G 126", acallam),
  entry(4, "Book of Leinster", tain),
];

beforeEach(() => {
  localStorage.clear();
  mockedList.mockReset();
  mockedList.mockResolvedValue(catalogue);
  useDocumentStore.setState({
    openDocuments: [],
    visibleDocumentIds: [],
    activeDocumentId: null,
  });
  useSearchStore.setState({
    resultsByDocument: {},
    activeResultIndexByDocument: {},
    isSearchingByDocument: {},
    searchErrorByDocument: {},
    lastAttemptByDocument: {},
  });
  useWorkspaceStore.setState({ selectedEntityId: null });
  document.getSelection()?.removeAllRanges();
});

/**
 * The work rows the dropdown is listing, by position — never by name. Which
 * works exist and what order they come in is the corpus's answer (#152), and
 * these tests are about the gates, which ask the same of it: any row will do.
 */
function workBranches(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>('[data-tour="work-branch"]'),
  );
}

async function openWorks() {
  fireEvent.click(screen.getByRole("button", { name: "Works" }));
  await waitFor(() => expect(workBranches().length).toBeGreaterThan(0));
}

describe("probeTourDom against the Works dropdown", () => {
  it("sees nothing while the dropdown is closed", () => {
    render(<WorkPicker />);
    expect(probeTourDom()).toMatchObject({
      worksDropdownOpen: false,
      workExpanded: false,
      versionsTicked: 0,
    });
  });

  it("sees the dropdown open, and closed again", async () => {
    render(<WorkPicker />);

    await openWorks();
    expect(probeTourDom().worksDropdownOpen).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Works" }));
    expect(probeTourDom().worksDropdownOpen).toBe(false);
  });

  it("sees any work expanded — the last row as readily as the first", async () => {
    render(<WorkPicker />);
    await openWorks();
    expect(probeTourDom().workExpanded).toBe(false);

    // Whichever branch the reader opens: the gate is the versions showing, and
    // no row is privileged (#152, #178).
    fireEvent.click(workBranches().at(-1)!);

    expect(probeTourDom().workExpanded).toBe(true);
  });

  it("counts the ticked versions, whichever two they are", async () => {
    render(<WorkPicker />);
    await openWorks();
    fireEvent.click(workBranches()[0]);
    expect(probeTourDom().versionsTicked).toBe(0);

    fireEvent.click(screen.getByRole("checkbox", { name: "G 126" }));
    expect(probeTourDom().versionsTicked).toBe(1);

    fireEvent.click(screen.getByRole("checkbox", { name: "Franciscan A 4" }));
    expect(probeTourDom().versionsTicked).toBe(2);

    fireEvent.click(screen.getByRole("checkbox", { name: "G 126" }));
    expect(probeTourDom().versionsTicked).toBe(1);
  });

  it("counts nothing once the work is collapsed again", async () => {
    render(<WorkPicker />);
    await openWorks();
    const branch = workBranches()[0];
    fireEvent.click(branch);
    fireEvent.click(screen.getByRole("checkbox", { name: "G 126" }));
    expect(probeTourDom().versionsTicked).toBe(1);

    fireEvent.click(branch);

    expect(probeTourDom()).toMatchObject({
      workExpanded: false,
      versionsTicked: 0,
    });
  });
});

describe("probeTourDom against a column's reading pane", () => {
  const doc: Document = {
    id: "doc-1",
    title: "Laud Misc. 610",
    format: "txt",
    content: "Gleand Rois Enaig bīdh dham\nbidh binn guth cluic ann nach tan",
  };

  function selectWithin(node: Node) {
    const range = document.createRange();
    range.selectNodeContents(node);
    const selection = document.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
  }

  it("is false with nothing selected", () => {
    useDocumentStore.setState({
      openDocuments: [doc],
      visibleDocumentIds: ["doc-1"],
    });
    render(<DocumentArea />);
    expect(probeTourDom().passageSelected).toBe(false);
  });

  it("is true for a selection inside the column's text", () => {
    useDocumentStore.setState({
      openDocuments: [doc],
      visibleDocumentIds: ["doc-1"],
    });
    render(<DocumentArea />);

    selectWithin(screen.getByText(/Gleand Rois Enaig/));

    expect(probeTourDom().passageSelected).toBe(true);
  });

  it("ignores a selection outside any reading pane", () => {
    useDocumentStore.setState({
      openDocuments: [doc],
      visibleDocumentIds: ["doc-1"],
    });
    render(
      <div>
        <p>a title somewhere else</p>
        <DocumentArea />
      </div>,
    );

    selectWithin(screen.getByText("a title somewhere else"));

    expect(probeTourDom().passageSelected).toBe(false);
  });
});

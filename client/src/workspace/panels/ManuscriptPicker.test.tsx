/**
 * #201 — the Manuscripts control is an opener like Works, not a show/hide
 * toggle: tick Manuscripts, open them as Columns (ADR-0025).
 */
import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ManuscriptPicker from "./ManuscriptPicker";
import { toolbarLabelFirstToGo } from "./buttonStyles";
import {
  MAX_OPEN_COLUMNS,
  manuscriptColumnId,
  useDocumentStore,
} from "../../store/documentStore";

// Occupy n columns with documents, so the cap can be reached without opening
// real ones.
function fillWith(n: number) {
  const openDocuments = Array.from({ length: n }, (_, i) => ({
    id: `doc-filler-${i}`,
    title: `doc ${i}`,
    format: "txt" as const,
    content: "x",
  }));
  useDocumentStore.setState({
    openDocuments,
    visibleDocumentIds: openDocuments.map((d) => d.id),
  });
}

beforeEach(() => {
  useDocumentStore.setState({
    openDocuments: [],
    openManuscripts: [],
    visibleDocumentIds: [],
    activeDocumentId: null,
  });
});

const trigger = () => screen.getByRole("button", { name: "Manuscripts" });
const openMenu = () => fireEvent.click(trigger());
const openSelected = () =>
  fireEvent.click(screen.getByRole("button", { name: /open selected/i }));

describe("ManuscriptPicker trigger", () => {
  // Client-requirement term: the word stays "Manuscripts", never "Books", in
  // the accessible name and tooltip at every width (CONTEXT.md → Manuscript).
  it("is named and titled 'Manuscripts' and is a dropdown, not a toggle", () => {
    render(<ManuscriptPicker />);

    expect(trigger()).toHaveAttribute("title", "Manuscripts");
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(trigger()).not.toHaveAttribute("aria-pressed");
    expect(screen.queryByRole("button", { name: /Books?/i })).not.toBeInTheDocument();
  });

  // ADR-0020: still the first label to go; the book icon carries it below xl.
  it("collapses its label first", () => {
    render(<ManuscriptPicker />);

    expect(screen.getByText("Manuscripts ▾", { selector: "span" })).toHaveClass(
      toolbarLabelFirstToGo,
    );
  });

  // ADR-0025 retires the narrow-window auto-hide: nothing ever disables it.
  it("is enabled", () => {
    render(<ManuscriptPicker />);

    expect(trigger()).toBeEnabled();
  });

  it("keeps the tour's anchor", () => {
    render(<ManuscriptPicker />);

    expect(trigger()).toHaveAttribute("data-tour", "manuscripts");
  });
});

describe("ManuscriptPicker menu", () => {
  it("lists the three manuscripts flat, each with a checkbox", () => {
    render(<ManuscriptPicker />);
    openMenu();

    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
    expect(screen.getByLabelText("Book of Lismore (UCC)")).toBeInTheDocument();
    expect(screen.getByLabelText("UCD MS A 4")).toBeInTheDocument();
    expect(screen.getByLabelText("Bodleian MS Laud Misc. 610")).toBeInTheDocument();
  });

  it("opens the ticked manuscripts as columns and closes", () => {
    render(<ManuscriptPicker />);
    openMenu();

    fireEvent.click(screen.getByLabelText("Book of Lismore (UCC)"));
    fireEvent.click(screen.getByLabelText("UCD MS A 4"));
    openSelected();

    expect(useDocumentStore.getState().visibleDocumentIds).toEqual([
      manuscriptColumnId("book-of-lismore"),
      manuscriptColumnId("ucd-ms-a-4"),
    ]);
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
  });

  it("disables Open selected until something is ticked", () => {
    render(<ManuscriptPicker />);
    openMenu();

    expect(screen.getByRole("button", { name: /open selected/i })).toBeDisabled();
  });

  it("marks a manuscript that is already open", () => {
    useDocumentStore.getState().openManuscript("ucd-ms-a-4");

    render(<ManuscriptPicker />);
    openMenu();

    const row = screen.getByLabelText("UCD MS A 4").closest("label")!;
    expect(row).toHaveTextContent("open");
    const other = screen.getByLabelText("Book of Lismore (UCC)").closest("label")!;
    expect(other).not.toHaveTextContent(/\bopen\b/);
  });

  // Opening it again brings its Column forward rather than adding a second.
  it("re-focuses an open manuscript instead of adding a column", () => {
    useDocumentStore.getState().openManuscript("ucd-ms-a-4");
    useDocumentStore.getState().addDocument("Notes", "x");

    render(<ManuscriptPicker />);
    openMenu();
    fireEvent.click(screen.getByLabelText("UCD MS A 4"));
    openSelected();

    const s = useDocumentStore.getState();
    expect(s.openManuscripts).toEqual(["ucd-ms-a-4"]);
    expect(s.activeDocumentId).toBe(manuscriptColumnId("ucd-ms-a-4"));
  });

  describe("the shared cap of eight columns", () => {
    it("allows one more tick of either kind with seven columns open", () => {
      fillWith(MAX_OPEN_COLUMNS - 2);
      useDocumentStore.getState().openManuscript("bodleian-ms");

      render(<ManuscriptPicker />);
      openMenu();
      fireEvent.click(screen.getByLabelText("Book of Lismore (UCC)"));

      expect(screen.getByLabelText("UCD MS A 4")).toBeDisabled();
      expect(screen.getByLabelText("Book of Lismore (UCC)")).toBeEnabled();
      // already open, so ticking it costs nothing
      expect(screen.getByLabelText("Bodleian MS Laud Misc. 610")).toBeEnabled();
    });

    it("allows no new tick with eight columns open", () => {
      fillWith(MAX_OPEN_COLUMNS);

      render(<ManuscriptPicker />);
      openMenu();

      for (const box of screen.getAllByRole("checkbox")) {
        expect(box).toBeDisabled();
      }
    });
  });
});

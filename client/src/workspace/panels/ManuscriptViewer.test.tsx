import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ManuscriptViewer from "./ManuscriptViewer";
import { findManuscript } from "../manuscripts";

const book = (id: string) => findManuscript(id)!;

// OpenSeadragon needs a real canvas/WebGL surface, so tests drive a stub viewer
// and assert on the tile sources the panel asks it to open.
const opened: { tileSource: string }[] = [];

vi.mock("openseadragon", () => ({
  default: () => ({
    isOpen: () => true,
    forceResize: () => {},
    viewport: {
      applyConstraints: () => {},
      goHome: () => {},
      zoomBy: () => {},
    },
    addHandler: () => {},
    removeHandler: () => {},
    destroy: () => {},
    open: (opts: { tileSource: string }) => {
      opened.push(opts);
    },
  }),
}));

function lastTileSource() {
  return opened[opened.length - 1]?.tileSource ?? "";
}

beforeEach(() => {
  opened.length = 0;
  // the manifest-backed manuscript fetches on select; never resolve it so the
  // tests stay on the tile sources the panel asks for
  vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ManuscriptViewer", () => {
  it("opens a manuscript on its configured initial page", () => {
    render(<ManuscriptViewer manuscript={book("book-of-lismore")} />);

    expect(screen.getByText(/^325 \//)).toBeInTheDocument();
    expect(lastTileSource()).toContain("325.tif");
  });

  it("uses each manuscript's own initial page", () => {
    render(<ManuscriptViewer manuscript={book("ucd-ms-a-4")} />);

    expect(screen.getByText(/^3 \//)).toBeInTheDocument();
    expect(lastTileSource()).toContain("03.tif");
  });

  it("also honours the initial page of the manifest-backed manuscript", () => {
    render(<ManuscriptViewer manuscript={book("bodleian-ms")} />);

    // no page count until the manifest resolves, so the indicator is bare
    expect(screen.getByText("249")).toBeInTheDocument();
  });

  // One book per Column: changing book is closing one and opening another
  // (ADR-0025), so the viewer offers no way to switch.
  it("has no manuscript switcher", () => {
    render(<ManuscriptViewer manuscript={book("book-of-lismore")} />);

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("steps pages within the manuscript's range", () => {
    render(<ManuscriptViewer manuscript={book("ucd-ms-a-4")} />);

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("4 / 86")).toBeInTheDocument();
    expect(lastTileSource()).toContain("04.tif");

    fireEvent.click(screen.getByRole("button", { name: "Previous page" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous page" }));
    expect(screen.getByText("2 / 86")).toBeInTheDocument();
  });

  // Two Columns, two viewers: a page turn in one is not a page turn in the other.
  it("keeps each open manuscript's page its own", () => {
    render(
      <>
        <ManuscriptViewer manuscript={book("book-of-lismore")} />
        <ManuscriptViewer manuscript={book("ucd-ms-a-4")} />
      </>,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Next page" })[1]);

    expect(screen.getByText("325 / 500")).toBeInTheDocument();
    expect(screen.getByText("4 / 86")).toBeInTheDocument();
  });
});

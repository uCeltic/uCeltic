import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

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

const { default: IIIFPanel } = await import("./IIIFPanel");

function lastTileSource() {
  return opened[opened.length - 1]?.tileSource ?? "";
}

beforeEach(() => {
  opened.length = 0;
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
});

describe("IIIFPanel", () => {
  it("opens the default manuscript on its configured initial page", () => {
    render(<IIIFPanel />);

    expect(screen.getByText(/^325 \//)).toBeInTheDocument();
    expect(lastTileSource()).toContain("325.tif");
  });

  it("uses each manuscript's own initial page when switching", () => {
    render(<IIIFPanel />);

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "ucd-ms-a-4" } });
    expect(screen.getByText(/^3 \//)).toBeInTheDocument();
    expect(lastTileSource()).toContain("03.tif");

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "book-of-lismore" } });
    expect(screen.getByText(/^325 \//)).toBeInTheDocument();
    expect(lastTileSource()).toContain("325.tif");
  });
});

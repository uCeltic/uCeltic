import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import WorkspaceLayout from "./WorkspaceLayout";
import { useWorkspaceStore } from "../../store/workspaceStore";

// The layout's own job is the one line this file is about: fold the stored preference
// together with the viewport override, and hand the answer to the panel and the tool
// bar alike. Its children are heavy (fetching, canvases, overlays) and each is tested
// where it lives, so they stand in as markers here.
vi.mock("../panels/DocumentArea", () => ({ default: () => <div /> }));
vi.mock("../panels/IIIFPanel", () => ({
  default: () => <div data-testid="iiif-panel" />,
}));
vi.mock("../panels/StatusBar", () => ({ default: () => <div /> }));
vi.mock("../panels/QuestionnaireModal", () => ({ default: () => null }));
vi.mock("../panels/FeedbackButton", () => ({ default: () => null }));
vi.mock("../tour/SpotlightTour", () => ({ default: () => null }));

// A controllable matchMedia stand-in: jsdom ships none, so tests must supply one.
function installMatchMedia(initialMatches: boolean) {
  const listeners = new Set<() => void>();
  let matches = initialMatches;
  const mql = {
    get matches() {
      return matches;
    },
    media: "",
    addEventListener: (_: string, cb: () => void) => listeners.add(cb),
    removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
  };
  window.matchMedia = vi.fn(() => mql) as unknown as typeof window.matchMedia;
  return {
    // Flip the query result and fire the change event, as a real resize past the
    // breakpoint would.
    set(next: boolean) {
      matches = next;
      listeners.forEach((cb) => cb());
    },
  };
}

beforeEach(() => {
  useWorkspaceStore.setState({ showIIIF: true });
});

afterEach(() => {
  delete (window as { matchMedia?: unknown }).matchMedia;
});

const renderLayout = () =>
  render(
    <MemoryRouter>
      <WorkspaceLayout />
    </MemoryRouter>,
  );

const manuscriptButton = () =>
  screen.getByRole("button", { name: /Manuscripts/ });

// ADR-0011: below `lg` the panel auto-hides. The toggle must say so rather than claim
// a state no click can deliver, and the stored preference must survive the trip (#160).
describe("WorkspaceLayout manuscript panel at narrow widths", () => {
  it("hides the panel and disables the toggle while the window is too narrow", () => {
    installMatchMedia(true);

    renderLayout();

    expect(screen.queryByTestId("iiif-panel")).not.toBeInTheDocument();
    const btn = manuscriptButton();
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-pressed", "false");
    expect(btn).toHaveAccessibleName("Show Manuscripts");
  });

  it("restores the panel from the untouched preference once the window grows back", () => {
    const media = installMatchMedia(true);

    renderLayout();
    // The override never wrote to the store, so the visitor's last choice is intact.
    expect(useWorkspaceStore.getState().showIIIF).toBe(true);

    act(() => media.set(false));

    expect(screen.getByTestId("iiif-panel")).toBeInTheDocument();
    const btn = manuscriptButton();
    expect(btn).toBeEnabled();
    expect(btn).toHaveAttribute("aria-pressed", "true");
  });

  it("leaves a visitor who turned the panel off with it off when the window grows back", () => {
    useWorkspaceStore.setState({ showIIIF: false });
    const media = installMatchMedia(true);

    renderLayout();
    act(() => media.set(false));

    expect(screen.queryByTestId("iiif-panel")).not.toBeInTheDocument();
    expect(manuscriptButton()).toHaveAccessibleName("Show Manuscripts");
  });
});

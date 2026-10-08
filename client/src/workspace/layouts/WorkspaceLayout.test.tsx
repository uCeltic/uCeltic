import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import WorkspaceLayout from "./WorkspaceLayout";
import { useAuthStore } from "../../store/authStore";

// The layout's children are heavy (fetching, canvases, overlays) and each is tested
// where it lives, so they stand in as markers here.
vi.mock("../panels/DocumentArea", () => ({
  default: () => <div data-testid="document-area" />,
}));
vi.mock("../panels/ManuscriptViewer", () => ({
  default: () => <div data-testid="manuscript-viewer" />,
}));
vi.mock("../panels/StatusBar", () => ({ default: () => <div /> }));
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
    // Flip the query result and fire the change event, as a real resize would.
    set(next: boolean) {
      matches = next;
      listeners.forEach((cb) => cb());
    },
  };
}

afterEach(() => {
  delete (window as { matchMedia?: unknown }).matchMedia;
});

const renderLayout = () =>
  render(
    <MemoryRouter>
      <WorkspaceLayout />
    </MemoryRouter>,
  );

// ADR-0025 replaces the side panel with Manuscript Columns in the strip, and retires
// ADR-0011's auto-hide below `lg` along with #160's disabled toggle. Whatever every
// media query answers, the layout is the same: the strip, and an enabled opener.
describe("WorkspaceLayout has no manuscript side panel (#201)", () => {
  it.each([
    ["narrow", true],
    ["wide", false],
  ])("renders only the column strip when the window is %s", (_, matches) => {
    installMatchMedia(matches);

    renderLayout();

    expect(screen.getByTestId("document-area")).toBeInTheDocument();
    expect(screen.queryByTestId("manuscript-viewer")).not.toBeInTheDocument();
    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Manuscripts" })).toBeEnabled();
  });
});

// ADR-0023: the questionnaire is paused until it has a real question set, so entering the
// workspace asks nothing of anyone. `QuestionnaireModal` is deliberately left unmocked
// here — the store state below is exactly what makes the real component render, so the
// test is only meaningful, and only fails on a re-added render site, without a stand-in.
describe("WorkspaceLayout pre-use questionnaire", () => {
  it.each(["anonymous", "authenticated"] as const)(
    "never overlays the questionnaire for a %s visitor",
    (status) => {
      useAuthStore.setState({
        status,
        user: status === "authenticated" ? { id: 1, email: "visitor@example.com" } : null,
        questionnaireResolved: false,
      });
      installMatchMedia(false);

      renderLayout();

      expect(useAuthStore.getState().shouldShowQuestionnaire()).toBe(true);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.queryByText(/before you start/i)).not.toBeInTheDocument();
    },
  );
});

import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import StudyPrompt from "./StudyPrompt";
import { useAuthStore, STUDY_PROMPT_DISMISSED_KEY } from "../../store/authStore";

const USER = { id: 1, email: "visitor@example.com" };

function renderPrompt() {
  return render(
    <MemoryRouter>
      <StudyPrompt />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  sessionStorage.clear();
  useAuthStore.setState({ status: "anonymous", user: null, promptDismissed: false });
});

describe("StudyPrompt", () => {
  it("invites a signed-out visitor to sign in, and links to both routes", () => {
    renderPrompt();

    expect(screen.getByText(/taking part in the study/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute(
      "href",
      "/account/login",
    );
    expect(screen.getByRole("link", { name: /register/i })).toHaveAttribute(
      "href",
      "/account/signup",
    );
  });

  it("renders nothing at all for a signed-in user", () => {
    useAuthStore.setState({ status: "authenticated", user: USER });

    const { container } = renderPrompt();

    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing while the session probe is still out, so it cannot flash on load", () => {
    useAuthStore.setState({ status: "unknown", user: null });

    const { container } = renderPrompt();

    expect(container).toBeEmptyDOMElement();
  });

  it("disappears when dismissed, and stays gone for the rest of the sitting", () => {
    renderPrompt();

    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));

    expect(screen.queryByText(/taking part in the study/i)).not.toBeInTheDocument();
    expect(sessionStorage.getItem(STUDY_PROMPT_DISMISSED_KEY)).toBe("1");
  });

  it("is an invitation, not a gate: it never blocks pointer events on the workspace", () => {
    renderPrompt();

    // A banner that covers the workspace would be a login wall by another name (ADR-0004),
    // so it must sit in the layout flow — not overlay it.
    const banner = screen.getByRole("status");
    expect(banner.className).not.toMatch(/fixed|absolute|inset-0/);
  });
});

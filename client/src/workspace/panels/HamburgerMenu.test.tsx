import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import HamburgerMenu from "./HamburgerMenu";
import { useWorkspaceStore } from "../../store/workspaceStore";
import { useAuthStore } from "../../store/authStore";
import * as log from "../../api/log";

function renderMenu() {
  return render(
    <MemoryRouter>
      <HamburgerMenu />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useWorkspaceStore.setState({ fontSize: 14 });
  useAuthStore.setState({ status: "anonymous", user: null });
});

afterEach(() => vi.restoreAllMocks());

describe("HamburgerMenu", () => {
  it("keeps the font-size and account controls tucked away until opened", () => {
    renderMenu();

    expect(screen.queryByRole("button", { name: "A+" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: /sign in/i }),
    ).not.toBeInTheDocument();
  });

  it("reveals the font-size and account controls once opened", () => {
    renderMenu();
    fireEvent.click(screen.getByRole("button", { name: /menu/i }));

    expect(screen.getByRole("button", { name: "A−" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "A+" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /sign in/i })).toBeInTheDocument();
  });

  it("still adjusts the font size and fires the event from inside the menu", () => {
    const logEvent = vi.spyOn(log, "logEvent").mockImplementation(() => {});

    renderMenu();
    fireEvent.click(screen.getByRole("button", { name: /menu/i }));
    fireEvent.click(screen.getByRole("button", { name: "A+" }));

    expect(useWorkspaceStore.getState().fontSize).toBe(16);
    expect(logEvent).toHaveBeenCalledWith("font_size_changed", {
      from: 14,
      to: 16,
    });
  });
});

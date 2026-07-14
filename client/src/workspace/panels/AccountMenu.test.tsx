import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AccountMenu from "./AccountMenu";
import { useAuthStore } from "../../store/authStore";
import * as auth from "../../api/auth";

const USER = { id: 1, email: "visitor@example.com" };

function renderMenu() {
  return render(
    <MemoryRouter>
      <AccountMenu />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useAuthStore.setState({ status: "anonymous", user: null, promptDismissed: false });
});

afterEach(() => vi.restoreAllMocks());

describe("AccountMenu", () => {
  it("offers a signed-out visitor a way in", () => {
    renderMenu();

    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute(
      "href",
      "/account/login",
    );
  });

  it("shows nothing until the session probe answers", () => {
    useAuthStore.setState({ status: "unknown", user: null });

    const { container } = renderMenu();

    expect(container).toBeEmptyDOMElement();
  });

  it("shows the signed-in user's email", () => {
    useAuthStore.setState({ status: "authenticated", user: USER });

    renderMenu();

    expect(screen.getByRole("button", { name: /visitor@example\.com/ })).toBeInTheDocument();
  });

  it("signs out from the menu and drops back to anonymous", async () => {
    useAuthStore.setState({ status: "authenticated", user: USER });
    vi.spyOn(auth, "logOut").mockResolvedValue(undefined);

    renderMenu();
    fireEvent.click(screen.getByRole("button", { name: /visitor@example\.com/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: /sign out/i }));

    await waitFor(() => expect(useAuthStore.getState().status).toBe("anonymous"));
    expect(auth.logOut).toHaveBeenCalled();
    expect(await screen.findByRole("link", { name: /sign in/i })).toBeInTheDocument();
  });
});

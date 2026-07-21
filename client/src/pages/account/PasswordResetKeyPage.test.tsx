import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PasswordResetKeyPage from "./PasswordResetKeyPage";
import * as auth from "../../api/auth";
import { AuthError } from "../../api/auth";

/** Render at a URL that carries a key, the only way this page is ever reached. */
function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/account/password/reset/key/abc123"]}>
      <Routes>
        <Route path="/account/password/reset/key/:key" element={<PasswordResetKeyPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function fillAndSubmit(password: string) {
  fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: /set password/i }));
}

afterEach(() => vi.restoreAllMocks());

describe("PasswordResetKeyPage", () => {
  it("redeems the key from the URL and points the visitor at sign-in", async () => {
    vi.spyOn(auth, "resetPassword").mockResolvedValue(undefined);

    renderPage();
    fillAndSubmit("correct-horse");

    expect(auth.resetPassword).toHaveBeenCalledWith("abc123", "correct-horse");
    await screen.findByRole("heading", { name: /password changed/i });
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute(
      "href",
      "/account/login",
    );
  });

  it("shows the server's own message when the key is spent, and stays on the form", async () => {
    vi.spyOn(auth, "resetPassword").mockRejectedValue(
      new AuthError([{ message: "Invalid or expired key.", code: "invalid" }]),
    );

    renderPage();
    fillAndSubmit("correct-horse");

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid or expired key.");
    expect(screen.getByRole("button", { name: /set password/i })).toBeEnabled();
  });

  it("falls back to its own wording when the failure is not an AuthError", async () => {
    vi.spyOn(auth, "resetPassword").mockRejectedValue(new TypeError("network down"));

    renderPage();
    fillAndSubmit("correct-horse");

    expect(await screen.findByRole("alert")).toHaveTextContent(/link may have expired/i);
  });

  it("disables the button while the request is in flight, so a double-click cannot double-submit", async () => {
    let release: () => void = () => {};
    vi.spyOn(auth, "resetPassword").mockReturnValue(
      new Promise<void>((resolve) => {
        release = resolve;
      }),
    );

    renderPage();
    fillAndSubmit("correct-horse");

    expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled();

    release();
    await waitFor(() => expect(auth.resetPassword).toHaveBeenCalledTimes(1));
  });
});

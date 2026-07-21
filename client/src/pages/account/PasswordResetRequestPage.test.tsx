import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PasswordResetRequestPage from "./PasswordResetRequestPage";
import * as auth from "../../api/auth";
import { AuthError } from "../../api/auth";

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/account/password/reset"]}>
      <PasswordResetRequestPage />
    </MemoryRouter>,
  );
}

function fillAndSubmit(email: string) {
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: email } });
  fireEvent.click(screen.getByRole("button", { name: /send reset link/i }));
}

afterEach(() => vi.restoreAllMocks());

describe("PasswordResetRequestPage", () => {
  it("confirms the link is on its way, naming the address it went to", async () => {
    vi.spyOn(auth, "requestPasswordReset").mockResolvedValue(undefined);

    renderPage();
    fillAndSubmit("visitor@example.com");

    expect(auth.requestPasswordReset).toHaveBeenCalledWith("visitor@example.com");
    await screen.findByRole("heading", { name: /check your email/i });
    expect(screen.getByText("visitor@example.com")).toBeInTheDocument();
  });

  it("shows the server's own message when the request is rejected, and stays on the form", async () => {
    vi.spyOn(auth, "requestPasswordReset").mockRejectedValue(
      new AuthError([{ message: "Too many requests.", code: "ratelimited" }]),
    );

    renderPage();
    fillAndSubmit("visitor@example.com");

    expect(await screen.findByRole("alert")).toHaveTextContent("Too many requests.");
    expect(screen.getByRole("button", { name: /send reset link/i })).toBeEnabled();
  });

  it("falls back to its own wording when the failure is not an AuthError", async () => {
    vi.spyOn(auth, "requestPasswordReset").mockRejectedValue(new TypeError("network down"));

    renderPage();
    fillAndSubmit("visitor@example.com");

    expect(await screen.findByRole("alert")).toHaveTextContent(/could not send the link/i);
  });

  it("disables the button while the request is in flight, so a double-click cannot double-submit", async () => {
    let release: () => void = () => {};
    vi.spyOn(auth, "requestPasswordReset").mockReturnValue(
      new Promise<void>((resolve) => {
        release = resolve;
      }),
    );

    renderPage();
    fillAndSubmit("visitor@example.com");

    expect(screen.getByRole("button", { name: /sending/i })).toBeDisabled();

    release();
    await waitFor(() => expect(auth.requestPasswordReset).toHaveBeenCalledTimes(1));
  });
});

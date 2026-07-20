import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import LoginPage from "./LoginPage";
import { useAuthStore } from "../../store/authStore";
import * as auth from "../../api/auth";
import { AuthError } from "../../api/auth";
import { getVerificationCooldownRemainingMs } from "./verifyEmailCooldown";

const USER = { id: 1, email: "visitor@example.com" };

/** Render the form inside a router that reveals where a successful sign-in lands. */
function renderLogin() {
  return render(
    <MemoryRouter initialEntries={["/account/login"]}>
      <Routes>
        <Route path="/account/login" element={<LoginPage />} />
        <Route path="/workspace" element={<h1>Workspace</h1>} />
        <Route path="/account/verify-email/sent" element={<h1>Check your email</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

function fillAndSubmit(email: string, password: string) {
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: email } });
  fireEvent.change(screen.getByLabelText(/password/i), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
}

beforeEach(() => {
  useAuthStore.setState({ status: "anonymous", user: null });
  localStorage.clear();
});

afterEach(() => vi.restoreAllMocks());

describe("LoginPage", () => {
  it("signs the visitor in and sends them to the workspace", async () => {
    vi.spyOn(auth, "logIn").mockResolvedValue({ status: "authenticated", user: USER });

    renderLogin();
    fillAndSubmit("visitor@example.com", "correct-horse");

    expect(auth.logIn).toHaveBeenCalledWith("visitor@example.com", "correct-horse");
    await screen.findByRole("heading", { name: /workspace/i });
    expect(useAuthStore.getState().user).toEqual(USER);
  });

  it("shows the server's message when the credentials are wrong, and stays put", async () => {
    vi.spyOn(auth, "logIn").mockRejectedValue(
      new AuthError([{ message: "Incorrect credentials.", code: "mismatch" }]),
    );

    renderLogin();
    fillAndSubmit("visitor@example.com", "wrong");

    expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect credentials.");
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("routes an unactivated account to 'check your email' rather than showing an error", async () => {
    vi.spyOn(auth, "logIn").mockResolvedValue({ status: "verification_pending" });

    renderLogin();
    fillAndSubmit("visitor@example.com", "correct-horse");

    await screen.findByRole("heading", { name: /check your email/i });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("starts the resend cooldown, since a blocked login re-sends the link server-side", async () => {
    vi.spyOn(auth, "logIn").mockResolvedValue({ status: "verification_pending" });

    renderLogin();
    fillAndSubmit("visitor@example.com", "correct-horse");

    await screen.findByRole("heading", { name: /check your email/i });
    expect(getVerificationCooldownRemainingMs("visitor@example.com")).toBeGreaterThan(0);
  });

  it("disables the button while the request is in flight, so a double-click cannot double-submit", async () => {
    let release: (v: auth.LoginOutcome) => void = () => {};
    vi.spyOn(auth, "logIn").mockReturnValue(
      new Promise<auth.LoginOutcome>((resolve) => {
        release = resolve;
      }),
    );

    renderLogin();
    fillAndSubmit("visitor@example.com", "correct-horse");

    expect(screen.getByRole("button", { name: /signing in/i })).toBeDisabled();

    release({ status: "authenticated", user: USER });
    await waitFor(() => expect(auth.logIn).toHaveBeenCalledTimes(1));
  });

  it("offers the way on to registration and password recovery", () => {
    renderLogin();

    expect(screen.getByRole("link", { name: /register/i })).toHaveAttribute(
      "href",
      "/account/signup",
    );
    expect(screen.getByRole("link", { name: /forgot/i })).toHaveAttribute(
      "href",
      "/account/password/reset",
    );
  });
});

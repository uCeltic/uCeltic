import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import SignupPage from "./SignupPage";
import * as auth from "../../api/auth";
import { getVerificationCooldownRemainingMs } from "./verifyEmailCooldown";

/** Render the form inside a router that reveals where a successful sign-up lands. */
function renderSignup() {
  return render(
    <MemoryRouter initialEntries={["/account/signup"]}>
      <Routes>
        <Route path="/account/signup" element={<SignupPage />} />
        <Route path="/account/verify-email/sent" element={<h1>Check your email</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

function fillEmailAndPasswords(email: string, password: string, confirmPassword: string) {
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: email } });
  fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: password } });
  fireEvent.change(screen.getByLabelText(/confirm password/i), {
    target: { value: confirmPassword },
  });
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("SignupPage", () => {
  it("lists all four rules Django's password validators enforce", () => {
    renderSignup();

    const hint = screen.getByText(/not too similar to your email/i);
    expect(hint).toHaveTextContent(/at least 8 characters/i);
    expect(hint).toHaveTextContent(/not too similar to your email/i);
    expect(hint).toHaveTextContent(/common or breached password/i);
    expect(hint).toHaveTextContent(/entirely numeric/i);
  });

  it("shows a confirm-password field below the password field", () => {
    renderSignup();

    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
  });

  it("flags a mismatch as soon as the confirm field is blurred", () => {
    renderSignup();

    fillEmailAndPasswords("visitor@example.com", "correct-horse", "wrong-horse");
    fireEvent.blur(screen.getByLabelText(/confirm password/i));

    expect(screen.getByRole("alert")).toHaveTextContent(/don't match/i);
  });

  it("does not flag a mismatch while the confirm field is still empty", () => {
    renderSignup();

    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "correct-horse" },
    });
    fireEvent.blur(screen.getByLabelText(/confirm password/i));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("blocks submission and reports the mismatch when the passwords differ", () => {
    vi.spyOn(auth, "signUp").mockResolvedValue(undefined);
    renderSignup();

    fillEmailAndPasswords("visitor@example.com", "correct-horse", "wrong-horse");
    fireEvent.click(screen.getByRole("button", { name: /register/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(/don't match/i);
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it("submits only the password field when the two entries match", async () => {
    vi.spyOn(auth, "signUp").mockResolvedValue(undefined);
    renderSignup();

    fillEmailAndPasswords("visitor@example.com", "correct-horse", "correct-horse");
    fireEvent.click(screen.getByRole("button", { name: /register/i }));

    expect(auth.signUp).toHaveBeenCalledWith("visitor@example.com", "correct-horse");
    expect(auth.signUp).toHaveBeenCalledTimes(1);
    await screen.findByRole("heading", { name: /check your email/i });
  });

  it("starts the resend cooldown, since signup itself just sent the activation mail", async () => {
    vi.spyOn(auth, "signUp").mockResolvedValue(undefined);
    renderSignup();

    fillEmailAndPasswords("visitor@example.com", "correct-horse", "correct-horse");
    fireEvent.click(screen.getByRole("button", { name: /register/i }));

    await screen.findByRole("heading", { name: /check your email/i });
    expect(getVerificationCooldownRemainingMs("visitor@example.com")).toBeGreaterThan(0);
  });
});

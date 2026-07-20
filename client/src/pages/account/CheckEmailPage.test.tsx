import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import CheckEmailPage from "./CheckEmailPage";
import * as auth from "../../api/auth";
import { recordVerificationEmailSent, VERIFY_EMAIL_COOLDOWN_MS } from "./verifyEmailCooldown";

const EMAIL = "visitor@example.com";

function renderCheckEmail(email: string | null = EMAIL) {
  return render(
    <MemoryRouter
      initialEntries={[
        { pathname: "/account/verify-email/sent", state: email ? { email } : null },
      ]}
    >
      <Routes>
        <Route path="/account/verify-email/sent" element={<CheckEmailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("CheckEmailPage", () => {
  it("shows an enabled resend button when no cooldown is on record", () => {
    renderCheckEmail();

    expect(screen.getByRole("button", { name: /resend verification email/i })).toBeEnabled();
  });

  it("has no resend button when the email is unknown (direct navigation, no state)", () => {
    renderCheckEmail(null);

    expect(screen.queryByRole("button", { name: /resend/i })).not.toBeInTheDocument();
  });

  it("calls the resend endpoint and disables itself with a countdown on click", async () => {
    vi.spyOn(auth, "resendVerificationEmail").mockResolvedValue(undefined);
    renderCheckEmail();

    fireEvent.click(screen.getByRole("button", { name: /resend verification email/i }));

    await waitFor(() => expect(auth.resendVerificationEmail).toHaveBeenCalledWith(EMAIL));
    await waitFor(() => expect(screen.getByRole("button")).toBeDisabled());
    expect(screen.getByRole("button")).toHaveTextContent(/resend available in/i);
  });

  it("is disabled with a countdown when a recent send is already on record", () => {
    recordVerificationEmailSent(EMAIL);

    renderCheckEmail();

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("3:00");
  });

  it("restores the correct remaining time after a simulated refresh, rather than resetting it", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    recordVerificationEmailSent(EMAIL);
    // "Refresh" a minute later: a fresh render reading the same localStorage record.
    vi.setSystemTime(new Date("2026-01-01T00:01:00Z"));

    renderCheckEmail();

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("2:00");
  });

  it("re-enables once the cooldown elapses", () => {
    vi.useFakeTimers();
    recordVerificationEmailSent(EMAIL);
    renderCheckEmail();
    expect(screen.getByRole("button")).toBeDisabled();

    act(() => {
      vi.advanceTimersByTime(VERIFY_EMAIL_COOLDOWN_MS + 1000);
    });

    expect(screen.getByRole("button", { name: /resend verification email/i })).toBeEnabled();
  });

  it("shows an error and re-enables the button when the resend request fails", async () => {
    vi.spyOn(auth, "resendVerificationEmail").mockRejectedValue(new Error("network down"));
    renderCheckEmail();

    fireEvent.click(screen.getByRole("button", { name: /resend verification email/i }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /resend verification email/i })).toBeEnabled();
  });
});

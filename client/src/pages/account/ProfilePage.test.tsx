import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ProfilePage from "./ProfilePage";
import { useAuthStore } from "../../store/authStore";
import * as auth from "../../api/auth";
import { AuthError } from "../../api/auth";
import * as profileApi from "../../api/profile";
import * as searchHistoryApi from "../../api/searchHistory";
import { ProfileError } from "../../api/profile";

const USER = { id: 1, email: "visitor@example.com" };

function renderProfile() {
  return render(
    <MemoryRouter initialEntries={["/account/profile"]}>
      <Routes>
        <Route path="/account/profile" element={<ProfilePage />} />
        <Route path="/account/login" element={<h1>Sign in</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useAuthStore.setState({ status: "authenticated", user: USER });
  // The page reads the history alongside the profile; every test below needs it to
  // answer, and only the one that is about it cares what it answers with.
  vi.spyOn(searchHistoryApi, "fetchSearchHistory").mockResolvedValue([]);
});

afterEach(() => vi.restoreAllMocks());

describe("ProfilePage", () => {
  it("sends an anonymous visitor to sign in instead", async () => {
    useAuthStore.setState({ status: "anonymous", user: null });

    renderProfile();

    await screen.findByRole("heading", { name: /sign in/i });
  });

  it("does not offer 'Continue as a Visitor' — the visitor is already signed in", async () => {
    vi.spyOn(profileApi, "fetchProfile").mockResolvedValue({
      email: USER.email,
      display_name: "Ada",
    });

    renderProfile();

    await screen.findByDisplayValue("Ada");
    expect(
      screen.queryByRole("link", { name: /continue as a visitor/i }),
    ).not.toBeInTheDocument();
  });

  it("shows the read-only email and the current display name", async () => {
    vi.spyOn(profileApi, "fetchProfile").mockResolvedValue({
      email: USER.email,
      display_name: "Ada",
    });

    renderProfile();

    expect(await screen.findByDisplayValue("Ada")).toBeInTheDocument();
    expect(screen.getByText(USER.email)).toBeInTheDocument();
  });

  it("suggests the email's local part as a placeholder when no display name is set", async () => {
    vi.spyOn(profileApi, "fetchProfile").mockResolvedValue({
      email: USER.email,
      display_name: "",
    });

    renderProfile();

    expect(await screen.findByPlaceholderText("visitor")).toBeInTheDocument();
  });

  it("saves an edited display name", async () => {
    vi.spyOn(profileApi, "fetchProfile").mockResolvedValue({
      email: USER.email,
      display_name: "Ada",
    });
    vi.spyOn(profileApi, "updateDisplayName").mockResolvedValue({
      email: USER.email,
      display_name: "Ada Lovelace",
    });

    renderProfile();
    const nameInput = await screen.findByDisplayValue("Ada");
    fireEvent.change(nameInput, { target: { value: "Ada Lovelace" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    expect(profileApi.updateDisplayName).toHaveBeenCalledWith("Ada Lovelace");
    await screen.findByRole("status");
  });

  it("shows the server's message when saving the display name fails", async () => {
    vi.spyOn(profileApi, "fetchProfile").mockResolvedValue({
      email: USER.email,
      display_name: "Ada",
    });
    vi.spyOn(profileApi, "updateDisplayName").mockRejectedValue(
      new ProfileError("Could not save. Please try again."),
    );

    renderProfile();
    fireEvent.click(await screen.findByRole("button", { name: /save/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not save.");
  });

  it("changes the password", async () => {
    vi.spyOn(profileApi, "fetchProfile").mockResolvedValue({
      email: USER.email,
      display_name: "Ada",
    });
    vi.spyOn(auth, "changePassword").mockResolvedValue(undefined);

    renderProfile();
    await screen.findByDisplayValue("Ada");
    fireEvent.change(screen.getByLabelText(/current password/i), {
      target: { value: "old-pw" },
    });
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: "new-pw" } });
    fireEvent.click(screen.getByRole("button", { name: /change password/i }));

    await waitFor(() =>
      expect(auth.changePassword).toHaveBeenCalledWith("old-pw", "new-pw"),
    );
    await screen.findByText(/password changed/i);
  });

  it("shows the server's message when the current password is wrong", async () => {
    vi.spyOn(profileApi, "fetchProfile").mockResolvedValue({
      email: USER.email,
      display_name: "Ada",
    });
    vi.spyOn(auth, "changePassword").mockRejectedValue(
      new AuthError([{ message: "Incorrect password.", code: "mismatch" }]),
    );

    renderProfile();
    await screen.findByDisplayValue("Ada");
    fireEvent.change(screen.getByLabelText(/current password/i), { target: { value: "wrong" } });
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: "new-pw" } });
    fireEvent.click(screen.getByRole("button", { name: /change password/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect password.");
  });
});

describe("ProfilePage search history", () => {
  it("shows the signed-in user their own Search History (#188)", async () => {
    vi.spyOn(profileApi, "fetchProfile").mockResolvedValue({
      email: USER.email,
      display_name: "Ada",
    });
    vi.spyOn(searchHistoryApi, "fetchSearchHistory").mockResolvedValue([
      {
        id: 1,
        query: "ro gab in ri",
        query_origin: "typed",
        window_size_ratio: 1.3,
        step_size: 1,
        dissimilarity_threshold: 0.5,
        top_k: 10,
        created_at: "2026-09-01T10:00:00Z",
        versions: [{ title: "Lebor na hUidre", hits: [{ snippet: "ro gab", score: 0.12 }] }],
      },
    ]);

    renderProfile();

    await screen.findByRole("button", { name: /ro gab in ri/ });
  });

  it("does not read the history for a visitor who is being sent to sign in", async () => {
    useAuthStore.setState({ status: "anonymous", user: null });

    renderProfile();

    await screen.findByRole("heading", { name: /sign in/i });
    expect(searchHistoryApi.fetchSearchHistory).not.toHaveBeenCalled();
  });
});

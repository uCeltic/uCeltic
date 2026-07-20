import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "./authStore";
import * as auth from "../api/auth";
import { AuthError } from "../api/auth";

const USER = { id: 1, email: "visitor@example.com" };

function resetStore() {
  useAuthStore.setState({
    status: "unknown",
    user: null,
    questionnaireResolved: false,
  });
}

beforeEach(() => {
  resetStore();
});

afterEach(() => vi.restoreAllMocks());

describe("probing the session on app load", () => {
  it("starts in 'unknown', so the UI can hold off on claiming either way", () => {
    expect(useAuthStore.getState().status).toBe("unknown");
    expect(useAuthStore.getState().user).toBeNull();
  });

  it("lands on 'authenticated' with the user when a session exists", async () => {
    vi.spyOn(auth, "getSession").mockResolvedValue(USER);

    await useAuthStore.getState().probe();

    expect(useAuthStore.getState().status).toBe("authenticated");
    expect(useAuthStore.getState().user).toEqual(USER);
  });

  it("lands on 'anonymous' when there is no session — the workspace stays open (ADR-0004)", async () => {
    vi.spyOn(auth, "getSession").mockResolvedValue(null);

    await useAuthStore.getState().probe();

    expect(useAuthStore.getState().status).toBe("anonymous");
    expect(useAuthStore.getState().user).toBeNull();
  });
});

describe("signing in", () => {
  it("stores the user and reports success", async () => {
    vi.spyOn(auth, "logIn").mockResolvedValue({ status: "authenticated", user: USER });

    const outcome = await useAuthStore.getState().signIn("visitor@example.com", "pw");

    expect(outcome).toEqual({ status: "authenticated", user: USER });
    expect(useAuthStore.getState().status).toBe("authenticated");
    expect(useAuthStore.getState().user).toEqual(USER);
  });

  it("stays anonymous when the account still needs activating", async () => {
    vi.spyOn(auth, "logIn").mockResolvedValue({ status: "verification_pending" });

    const outcome = await useAuthStore.getState().signIn("visitor@example.com", "pw");

    expect(outcome).toEqual({ status: "verification_pending" });
    expect(useAuthStore.getState().status).toBe("anonymous");
    expect(useAuthStore.getState().user).toBeNull();
  });

  it("lets a rejected sign-in bubble up for the form to render, and stays anonymous", async () => {
    vi.spyOn(auth, "logIn").mockRejectedValue(
      new AuthError([{ message: "Incorrect credentials.", code: "mismatch" }]),
    );

    await expect(
      useAuthStore.getState().signIn("visitor@example.com", "nope"),
    ).rejects.toThrow("Incorrect credentials.");
    expect(useAuthStore.getState().status).toBe("anonymous");
  });
});

describe("signing out", () => {
  it("drops the user and returns to anonymous", async () => {
    useAuthStore.setState({ status: "authenticated", user: USER });
    vi.spyOn(auth, "logOut").mockResolvedValue(undefined);

    await useAuthStore.getState().signOut();

    expect(useAuthStore.getState().status).toBe("anonymous");
    expect(useAuthStore.getState().user).toBeNull();
  });

  it("still drops the local session when the server call fails, so the UI cannot get stuck signed in", async () => {
    useAuthStore.setState({ status: "authenticated", user: USER });
    vi.spyOn(auth, "logOut").mockRejectedValue(new Error("network down"));

    await useAuthStore.getState().signOut();

    expect(useAuthStore.getState().status).toBe("anonymous");
    expect(useAuthStore.getState().user).toBeNull();
  });
});

describe("the pre-use questionnaire (#67, ADR-0007)", () => {
  it("never shows before the probe lands, so it can't flash ahead of the session check", () => {
    useAuthStore.setState({ status: "unknown", user: null });
    expect(useAuthStore.getState().shouldShowQuestionnaire()).toBe(false);
  });

  it("shows to an anonymous visitor who hasn't resolved it yet, and stops once resolved", () => {
    useAuthStore.setState({ status: "anonymous", user: null });
    expect(useAuthStore.getState().shouldShowQuestionnaire()).toBe(true);

    useAuthStore.getState().resolveQuestionnaire();

    expect(useAuthStore.getState().shouldShowQuestionnaire()).toBe(false);
  });

  it("shows to a signed-in visitor who hasn't resolved it yet, and stops once resolved", () => {
    useAuthStore.setState({ status: "authenticated", user: USER });
    expect(useAuthStore.getState().shouldShowQuestionnaire()).toBe(true);

    useAuthStore.getState().resolveQuestionnaire();

    expect(useAuthStore.getState().shouldShowQuestionnaire()).toBe(false);
  });

  it("resets on sign-out, so a different account signing in on the same tab is still asked", async () => {
    useAuthStore.setState({ status: "authenticated", user: USER, questionnaireResolved: true });
    vi.spyOn(auth, "logOut").mockResolvedValue(undefined);

    await useAuthStore.getState().signOut();
    vi.spyOn(auth, "logIn").mockResolvedValue({
      status: "authenticated",
      user: { id: 2, email: "someone-else@example.com" },
    });
    await useAuthStore.getState().signIn("someone-else@example.com", "pw");

    expect(useAuthStore.getState().shouldShowQuestionnaire()).toBe(true);
  });
});

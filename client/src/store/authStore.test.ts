import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore, STUDY_PROMPT_DISMISSED_KEY } from "./authStore";
import * as auth from "../api/auth";
import { AuthError } from "../api/auth";

const USER = { id: 1, email: "visitor@example.com" };

function resetStore() {
  useAuthStore.setState({
    status: "unknown",
    user: null,
    promptDismissed: false,
    questionnaireResolved: false,
  });
}

beforeEach(() => {
  resetStore();
  sessionStorage.clear();
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

describe("the study prompt", () => {
  it("is hidden while the session is still unknown, so it never flashes on load", () => {
    expect(useAuthStore.getState().shouldShowStudyPrompt()).toBe(false);
  });

  it("shows to a signed-out visitor", async () => {
    vi.spyOn(auth, "getSession").mockResolvedValue(null);
    await useAuthStore.getState().probe();

    expect(useAuthStore.getState().shouldShowStudyPrompt()).toBe(true);
  });

  it("never shows to a signed-in user", async () => {
    vi.spyOn(auth, "getSession").mockResolvedValue(USER);
    await useAuthStore.getState().probe();

    expect(useAuthStore.getState().shouldShowStudyPrompt()).toBe(false);
  });

  it("stays dismissed for the rest of the sitting", async () => {
    vi.spyOn(auth, "getSession").mockResolvedValue(null);
    await useAuthStore.getState().probe();

    useAuthStore.getState().dismissStudyPrompt();

    expect(useAuthStore.getState().shouldShowStudyPrompt()).toBe(false);
    expect(sessionStorage.getItem(STUDY_PROMPT_DISMISSED_KEY)).toBe("1");
  });

  it("comes back on the next sitting: dismissal lives in sessionStorage, not localStorage", async () => {
    useAuthStore.getState().dismissStudyPrompt();
    expect(localStorage.getItem(STUDY_PROMPT_DISMISSED_KEY)).toBeNull();

    // A new sitting: fresh store, and sessionStorage the browser has already cleared.
    sessionStorage.clear();
    resetStore();
    vi.spyOn(auth, "getSession").mockResolvedValue(null);
    await useAuthStore.getState().probe();

    expect(useAuthStore.getState().shouldShowStudyPrompt()).toBe(true);
  });

  it("honours a dismissal made before a reload within the same sitting", async () => {
    // A reload rebuilds the store from scratch, so sessionStorage — not the in-memory
    // flag — is what has to carry the dismissal across it.
    sessionStorage.setItem(STUDY_PROMPT_DISMISSED_KEY, "1");
    resetStore();
    vi.spyOn(auth, "getSession").mockResolvedValue(null);
    await useAuthStore.getState().probe();

    expect(useAuthStore.getState().shouldShowStudyPrompt()).toBe(false);
  });
});

describe("the pre-use questionnaire (#67)", () => {
  it("never shows to an anonymous visitor or before the probe lands", () => {
    useAuthStore.setState({ status: "anonymous", user: null });
    expect(useAuthStore.getState().shouldShowQuestionnaire()).toBe(false);

    useAuthStore.setState({ status: "unknown", user: null });
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

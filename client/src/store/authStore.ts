import { create } from "zustand";
import { getSession, logIn, logOut, type AuthUser, type LoginOutcome } from "../api/auth";

/**
 * `unknown` until the session probe answers. The UI must not claim "signed out" before
 * then, or a signed-in user sees stale UI flash on every load.
 */
export type AuthStatus = "unknown" | "anonymous" | "authenticated";

interface AuthStore {
  status: AuthStatus;
  user: AuthUser | null;
  questionnaireResolved: boolean;

  probe: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<LoginOutcome>;
  signOut: () => Promise<void>;
  resolveQuestionnaire: () => void;
  shouldShowQuestionnaire: () => boolean;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  status: "unknown",
  user: null,
  // A "Session" is a session_id (client/src/api/log.ts), regenerated on every app load,
  // and this flag lives in the same in-memory module — so a reload naturally means a new
  // session and re-prompts.
  questionnaireResolved: false,

  /** Ask the server who we are. Never throws — see getSession. */
  probe: async () => {
    const user = await getSession();
    set({ status: user ? "authenticated" : "anonymous", user });
  },

  /**
   * The AuthError from a rejected sign-in is left to propagate: the form owns the
   * wording. The store still settles on `anonymous` first, so a failure can never strand
   * the UI in `unknown`.
   */
  signIn: async (email, password) => {
    let outcome: LoginOutcome;
    try {
      outcome = await logIn(email, password);
    } catch (error) {
      set({ status: "anonymous", user: null });
      throw error;
    }

    if (outcome.status === "authenticated") {
      // Reset even if the sign-in outcome resolves the *same* user re-entering: a
      // fresh sign-in is itself "the start of a session" for that identity, and it
      // guards against a stale resolution surviving an account switch within one tab.
      set({ status: "authenticated", user: outcome.user, questionnaireResolved: false });
    } else {
      set({ status: "anonymous", user: null });
    }
    return outcome;
  },

  /**
   * Drop the session locally whatever the server says. A logout that fails on the wire
   * must still leave the UI signed out — the alternative is a user stuck looking at an
   * account they have asked to leave.
   */
  signOut: async () => {
    try {
      await logOut();
    } catch {
      // Swallowed on purpose: the server may already have expired the session, and a
      // failed round-trip is no reason to keep showing an account the user has left.
    }
    // Also clears questionnaireResolved: the next sign-in in this tab is a different
    // identity's "start of a session" and must not inherit this one's resolution.
    set({ status: "anonymous", user: null, questionnaireResolved: false });
  },

  resolveQuestionnaire: () => set({ questionnaireResolved: true }),

  /**
   * Only for a signed-in user this session hasn't answered or skipped yet. Anonymous
   * visitors are never prompted (#67, ADR-0004) — status must be exactly "authenticated",
   * not merely "not anonymous", so the "unknown" gap before the probe lands shows nothing.
   */
  shouldShowQuestionnaire: () => {
    const { status, questionnaireResolved } = get();
    return status === "authenticated" && !questionnaireResolved;
  },
}));

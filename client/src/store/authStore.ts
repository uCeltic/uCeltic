import { create } from "zustand";
import { getSession, logIn, logOut, type AuthUser, type LoginOutcome } from "../api/auth";

/**
 * Dismissing the study prompt lasts one sitting: sessionStorage, so a participant who
 * closes it today is reminded again on their next visit, but never nagged twice in the
 * same sitting. (localStorage would silence it forever on that browser.)
 */
export const STUDY_PROMPT_DISMISSED_KEY = "uceltic:study-prompt-dismissed";

/**
 * `unknown` until the session probe answers. The UI must not claim "signed out" before
 * then, or a signed-in user sees the study prompt flash on every load.
 */
export type AuthStatus = "unknown" | "anonymous" | "authenticated";

function dismissedThisSitting(): boolean {
  try {
    return sessionStorage.getItem(STUDY_PROMPT_DISMISSED_KEY) === "1";
  } catch {
    // Private-mode browsers can throw on storage access; a missing dismissal is harmless.
    return false;
  }
}

interface AuthStore {
  status: AuthStatus;
  user: AuthUser | null;
  promptDismissed: boolean;
  questionnaireResolved: boolean;

  probe: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<LoginOutcome>;
  signOut: () => Promise<void>;
  dismissStudyPrompt: () => void;
  shouldShowStudyPrompt: () => boolean;
  resolveQuestionnaire: () => void;
  shouldShowQuestionnaire: () => boolean;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  status: "unknown",
  user: null,
  promptDismissed: dismissedThisSitting(),
  // No sessionStorage here, unlike promptDismissed: a "Session" is a session_id
  // (client/src/api/log.ts), regenerated on every app load, and this flag lives in the
  // same in-memory module — so a reload naturally means a new session and re-prompts.
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
      set({ status: "authenticated", user: outcome.user });
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
    set({ status: "anonymous", user: null });
  },

  dismissStudyPrompt: () => {
    try {
      sessionStorage.setItem(STUDY_PROMPT_DISMISSED_KEY, "1");
    } catch {
      // Storage unavailable: the prompt simply returns on the next load.
    }
    set({ promptDismissed: true });
  },

  /**
   * Only for a visitor we know to be signed out. The prompt is an invitation, never a
   * gate: the workspace renders identically whether or not this returns true (ADR-0004).
   */
  shouldShowStudyPrompt: () => {
    const { status, promptDismissed } = get();
    return status === "anonymous" && !promptDismissed && !dismissedThisSitting();
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

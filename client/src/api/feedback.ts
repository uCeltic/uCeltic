import { csrfHeaders, ensureCsrfToken } from "./csrf";
import { firstFieldError } from "./fieldError";
import { getSessionId } from "./log";

const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";
const FEEDBACK_URL = `${API_BASE}/feedback/`;
const APP_VERSION = import.meta.env.APP_VERSION ?? "unknown";

// Closed set, mirroring FEEDBACK_CATEGORIES in apps/analytics/models.py — anything else
// is a 400. `other` is the default so writing something never starts with classifying it.
export const FEEDBACK_CATEGORIES = ["bug", "feature", "other"] as const;

export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

// Mirrors the serializer guard (FEEDBACK_BODY_MAX_LENGTH). Kept client-side too so the
// textarea can stop a visitor before a long write is rejected, not after.
export const FEEDBACK_BODY_MAX_LENGTH = 5000;
export const FEEDBACK_CONTACT_MAX_LENGTH = 200;

export interface FeedbackSubmission {
  category: FeedbackCategory;
  /** The message itself — the only prose the visitor authored, along with `contact`. */
  body: string;
  contact?: string;
  /** Tool-usage snapshot (open documents, work, viewport, url); never search or selection text. */
  context?: Record<string, unknown>;
}

/** A feedback that did not reach the store — shown inline so the typed body can be retried. */
export class FeedbackError extends Error {}

/**
 * Send one piece of feedback (#137, ADR-0014).
 *
 * Open to guests, like the questionnaire: the CSRF cookie is planted first so a
 * signed-in visitor's session-authenticated POST passes, while an anonymous visitor —
 * who has no session for Django to CSRF-check — is let through either way.
 *
 * Awaited rather than fire-and-forget (unlike `logEvent`): the visitor is watching this
 * one, so a failure has to come back and be shown.
 */
export async function submitFeedback(submission: FeedbackSubmission): Promise<void> {
  await ensureCsrfToken();

  let response: Response;
  try {
    response = await fetch(FEEDBACK_URL, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...csrfHeaders() },
      body: JSON.stringify({
        session_id: getSessionId(),
        app_version: APP_VERSION,
        ...submission,
      }),
    });
  } catch {
    // Offline, or the server never answered — indistinguishable from here, and the
    // visitor's move is the same either way.
    throw new FeedbackError("Could not send. Please try again.");
  }

  if (!response.ok) {
    throw new FeedbackError((await firstFieldError(response)) ?? "Could not send. Please try again.");
  }
}

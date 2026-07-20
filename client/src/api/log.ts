import { csrfHeaders } from "./csrf";
import { useAuthStore } from "../store/authStore";

const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";
const APP_VERSION = import.meta.env.APP_VERSION ?? "unknown";

// closed taxonomy per ADR-0003 — mirrors the server-side allow-set in apps/analytics/models.py
export const EVENT_TYPES = [
  "session_started",
  "document_opened",
  "document_closed",
  "search_performed",
  "search_param_changed",
  "result_navigated",
  "scope_changed",
  "mode_changed",
  "iiif_toggled",
  "font_size_changed",
  "feedback_submitted",
] as const;

export type BehaviorEventType = (typeof EVENT_TYPES)[number];

// generated once per app load, held in memory only — never localStorage
let sessionId = crypto.randomUUID();

// A tab left open past this gap without any logged activity reads as a new sitting
// (ADR-0007) — checked and, if needed, rotated on the next logEvent call, never on a
// standalone timer. Not persisted (e.g. sessionStorage) on purpose: a reload already
// starts a new session today, and this must stay additive to that, not change it.
const SESSION_IDLE_MS = 6 * 60 * 60 * 1000;
let lastActivityAt = Date.now();

function rotateSessionIfIdle(now: number): void {
  if (now - lastActivityAt <= SESSION_IDLE_MS) return;
  sessionId = crypto.randomUUID();
  // The new session hasn't been asked its purpose yet — re-arm the questionnaire the
  // same way a fresh sign-in/sign-out already does.
  useAuthStore.setState({ questionnaireResolved: false });
}

// Shared with the questionnaire (#67): same sitting, same session_id, so a
// QuestionnaireResponse and its Behavior Events line up under one id.
export function getSessionId(): string {
  return sessionId;
}

export function logEvent(
  eventType: BehaviorEventType,
  payload: Record<string, unknown> = {},
): void {
  const now = Date.now();
  rotateSessionIfIdle(now);
  lastActivityAt = now;
  try {
    // Stays fire-and-forget: the CSRF header is read straight from the cookie rather than
    // awaited, so a signed-in visitor's event passes CSRF and an anonymous one sends no
    // token at all — which the server does not ask for.
    fetch(`${API_BASE}/events/`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...csrfHeaders() },
      body: JSON.stringify({
        session_id: sessionId,
        event_type: eventType,
        payload,
        client_ts: new Date().toISOString(),
        app_version: APP_VERSION,
      }),
    }).catch(() => {});
  } catch {
    // fetch throwing synchronously must never break the caller
  }
}

// guards against React StrictMode's dev-only double-invoked mount effect
// emitting two session_started rows for what is really one app load
let sessionStarted = false;

export function logSessionStarted(payload: Record<string, unknown> = {}): void {
  if (sessionStarted) return;
  sessionStarted = true;
  logEvent("session_started", payload);
}
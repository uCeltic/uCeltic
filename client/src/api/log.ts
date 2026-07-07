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
const sessionId = crypto.randomUUID();

export function logEvent(
  eventType: BehaviorEventType,
  payload: Record<string, unknown> = {},
): void {
  try {
    fetch(`${API_BASE}/events/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
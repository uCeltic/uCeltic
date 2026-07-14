const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";

/** The `csrftoken` cookie Django plants; readable from JS by design (CSRF_COOKIE_HTTPONLY=False). */
export function readCsrfToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Headers for an unsafe request. Empty for anonymous visitors — no session, so Django's
 * SessionAuthentication skips CSRF entirely and the public POSTs (/api/search/, /api/events/)
 * keep working without a token (ADR-0004).
 */
export function csrfHeaders(): Record<string, string> {
  const token = readCsrfToken();
  return token ? { "X-CSRFToken": token } : {};
}

/**
 * Obtain a CSRF token, asking the server to plant the cookie if it is not there yet.
 * Sign-in / sign-up must await this: those POSTs are CSRF-protected even while anonymous,
 * and a single-page app renders no Django template that would have set the cookie.
 */
export async function ensureCsrfToken(): Promise<string | null> {
  const existing = readCsrfToken();
  if (existing) return existing;

  await fetch(`${API_BASE}/auth/csrf/`, { credentials: "same-origin" });
  return readCsrfToken();
}

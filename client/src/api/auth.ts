import { csrfHeaders, ensureCsrfToken } from "./csrf";

const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";

/** allauth headless, mounted under /api/ so Caddy and Vite proxy it to Django unchanged (#64). */
const AUTH_BASE = `${API_BASE}/auth/browser/v1/auth`;

/** No display name yet: #64 collects only email + password, and #66 adds a real one. */
export interface AuthUser {
  id: number;
  email: string;
}

/** One field-scoped complaint from allauth; `param` names the input that caused it. */
export interface AuthFieldError {
  message: string;
  code: string;
  param?: string;
}

/**
 * A rejected request — bad credentials, a taken email, a spent key. Carries the server's
 * own wording, which forms show as-is rather than inventing a second set of messages.
 */
export class AuthError extends Error {
  readonly errors: AuthFieldError[];

  constructor(errors: AuthFieldError[]) {
    super(errors.map((e) => e.message).join(" ") || "Something went wrong. Please try again.");
    this.name = "AuthError";
    this.errors = errors;
  }
}

/**
 * Every allauth reply carries the session envelope. A 401 means "this request left you
 * signed out" — which is the *expected* answer to signup, email verification, password
 * reset and logout, since none of them may hand out a session (see #64's API tests).
 *
 * So 200 and 401 are the two success statuses, and *everything else* is a failure. It is
 * not enough to reject only 400: allauth rate-limits activation mail (1 per 3 minutes per
 * address) and answers 429, and a 429 read as success would send the visitor off to wait
 * for an email that was never sent — or tell them a password changed when it did not.
 */
interface AuthResponse {
  status: number;
  meta?: { is_authenticated?: boolean };
  data?: { user?: AuthUser; flows?: { id: string; is_pending?: boolean }[] };
  errors?: AuthFieldError[];
}

async function call(
  path: string,
  init: { method: "POST" | "DELETE"; body?: unknown },
): Promise<AuthResponse> {
  // Sign-in and sign-up are CSRF-protected even while anonymous, and an SPA renders no
  // Django template that would have planted the cookie — so ask for one before the first
  // unsafe call. Cheap after that: ensureCsrfToken() short-circuits on the existing cookie.
  await ensureCsrfToken();

  const response = await fetch(`${AUTH_BASE}${path}`, {
    method: init.method,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...csrfHeaders() },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });

  const body: AuthResponse = await response.json().catch(() => ({ status: response.status }));

  if (response.status !== 200 && response.status !== 401) {
    // AuthError's own fallback wording covers the statuses that carry no `errors` to
    // quote — 429 and 5xx among them.
    throw new AuthError(body.errors ?? []);
  }
  return body;
}

function isPendingVerification(body: AuthResponse): boolean {
  return (body.data?.flows ?? []).some((f) => f.id === "verify_email" && f.is_pending);
}

/**
 * Who, if anyone, is signed in. Never throws: an unreachable API must not keep the
 * workspace from loading, and "we could not tell" degrades to "anonymous" (ADR-0004).
 */
export async function getSession(): Promise<AuthUser | null> {
  try {
    const response = await fetch(`${AUTH_BASE}/session`, { credentials: "same-origin" });
    if (!response.ok) return null;
    const body: AuthResponse = await response.json();
    return body.data?.user ?? null;
  } catch {
    return null;
  }
}

export type LoginOutcome =
  | { status: "authenticated"; user: AuthUser }
  | { status: "verification_pending" };

/**
 * Sign in. A correct password on an unactivated account is not a failure — allauth
 * withholds the session, re-sends the activation link, and says so; the caller sends the
 * visitor to "check your email" rather than showing an error.
 */
export async function logIn(email: string, password: string): Promise<LoginOutcome> {
  const body = await call("/login", { method: "POST", body: { email, password } });

  const user = body.data?.user;
  if (body.meta?.is_authenticated && user) return { status: "authenticated", user };
  if (isPendingVerification(body)) return { status: "verification_pending" };

  // Signed out, and allauth named no pending stage we know how to drive. Rather than
  // guess (and strand the visitor on a "check your email" page for an email that will
  // never arrive), fail loudly.
  throw new AuthError([{ message: "Could not sign in. Please try again.", code: "unexpected" }]);
}

/** Register. Resolves once the account exists and the activation email is on its way. */
export async function signUp(email: string, password: string): Promise<void> {
  await call("/signup", { method: "POST", body: { email, password } });
}

/** Redeem an activation key from the emailed link. The visitor then signs in. */
export async function verifyEmail(key: string): Promise<void> {
  await call("/email/verify", { method: "POST", body: { key } });
}

export async function requestPasswordReset(email: string): Promise<void> {
  await call("/password/request", { method: "POST", body: { email } });
}

export async function resetPassword(key: string, password: string): Promise<void> {
  await call("/password/reset", { method: "POST", body: { key, password } });
}

export async function logOut(): Promise<void> {
  await call("/session", { method: "DELETE" });
}

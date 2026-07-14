import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AuthError,
  getSession,
  logIn,
  logOut,
  requestPasswordReset,
  resetPassword,
  signUp,
  verifyEmail,
} from "./auth";

/** allauth answers every call with this envelope; `data.user` only appears once signed in. */
function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

const USER = { id: 1, email: "visitor@example.com" };

function sessionBody(authenticated: boolean) {
  return {
    status: authenticated ? 200 : 401,
    meta: { is_authenticated: authenticated },
    data: authenticated ? { user: USER } : {},
  };
}

/** allauth's validation shape: 400 with a list of field-scoped errors. */
function errorBody(...errors: { message: string; code: string; param?: string }[]) {
  return { status: 400, errors };
}

function stubFetch(...responses: ReturnType<typeof jsonResponse>[]) {
  const fetchMock = vi.fn();
  for (const response of responses) fetchMock.mockResolvedValueOnce(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  // A token already in the jar, so the CSRF pre-flight never fires and each test's
  // fetch mock sees only the auth call it is about.
  Object.defineProperty(document, "cookie", {
    value: "csrftoken=tok123",
    writable: true,
    configurable: true,
  });
});

afterEach(() => vi.restoreAllMocks());

describe("getSession", () => {
  it("returns the user when allauth reports an authenticated session", async () => {
    const fetchMock = stubFetch(jsonResponse(200, sessionBody(true)));

    await expect(getSession()).resolves.toEqual(USER);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/auth/browser/v1/auth/session");
    expect(init.credentials).toBe("same-origin");
  });

  it("returns null on 401 — an anonymous visitor is not an error (ADR-0004)", async () => {
    stubFetch(jsonResponse(401, sessionBody(false)));

    await expect(getSession()).resolves.toBeNull();
  });

  it("returns null when the probe fails outright, so the workspace still loads offline", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    await expect(getSession()).resolves.toBeNull();
  });
});

describe("logIn", () => {
  it("signs in and returns the user", async () => {
    const fetchMock = stubFetch(jsonResponse(200, sessionBody(true)));

    await expect(logIn("visitor@example.com", "pw")).resolves.toEqual({
      status: "authenticated",
      user: USER,
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/auth/browser/v1/auth/login");
    expect(init.method).toBe("POST");
    expect(init.headers["X-CSRFToken"]).toBe("tok123");
    expect(JSON.parse(init.body)).toEqual({
      email: "visitor@example.com",
      password: "pw",
    });
  });

  it("reports a pending activation rather than an error when the account is not yet verified", async () => {
    // The password was right; allauth withholds the session and names what is still owed.
    stubFetch(
      jsonResponse(401, {
        status: 401,
        meta: { is_authenticated: false },
        data: { flows: [{ id: "verify_email", is_pending: true }] },
      }),
    );

    await expect(logIn("visitor@example.com", "pw")).resolves.toEqual({
      status: "verification_pending",
    });
  });

  it("throws the server's message when the credentials are wrong", async () => {
    stubFetch(
      jsonResponse(
        400,
        errorBody({ message: "Incorrect credentials.", code: "email_password_mismatch" }),
      ),
    );

    const error = await logIn("visitor@example.com", "nope").catch((e) => e);

    expect(error).toBeInstanceOf(AuthError);
    expect(error.message).toBe("Incorrect credentials.");
  });
});

describe("signUp", () => {
  it("treats 401 as success: the account exists and the activation email is on its way", async () => {
    const fetchMock = stubFetch(
      jsonResponse(401, {
        status: 401,
        meta: { is_authenticated: false },
        data: { flows: [{ id: "verify_email", is_pending: true }] },
      }),
    );

    await expect(signUp("visitor@example.com", "pw")).resolves.toBeUndefined();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/auth/browser/v1/auth/signup");
    expect(JSON.parse(init.body)).toEqual({
      email: "visitor@example.com",
      password: "pw",
    });
  });

  it("surfaces a field error, so the form can name the offending input", async () => {
    stubFetch(
      jsonResponse(
        400,
        errorBody({
          message: "A user is already registered with this email address.",
          code: "email_taken",
          param: "email",
        }),
      ),
    );

    await expect(signUp("taken@example.com", "pw")).rejects.toMatchObject({
      errors: [expect.objectContaining({ param: "email" })],
    });
  });

  it("fetches a CSRF token first when the cookie jar is empty", async () => {
    Object.defineProperty(document, "cookie", {
      value: "",
      writable: true,
      configurable: true,
    });
    const fetchMock = vi.fn();
    // The CSRF pre-flight plants the cookie the signup call then reads.
    fetchMock.mockImplementationOnce(async () => {
      Object.defineProperty(document, "cookie", {
        value: "csrftoken=planted",
        writable: true,
        configurable: true,
      });
      return { ok: true };
    });
    fetchMock.mockResolvedValueOnce(jsonResponse(401, sessionBody(false)));
    vi.stubGlobal("fetch", fetchMock);

    await signUp("visitor@example.com", "pw");

    expect(fetchMock.mock.calls[0][0]).toBe("/api/auth/csrf/");
    expect(fetchMock.mock.calls[1][1].headers["X-CSRFToken"]).toBe("planted");
  });
});

describe("statuses that are neither success nor a 400", () => {
  // allauth rate-limits activation mail (1 per 3 minutes per address) and answers 429.
  // Reading only 400 as failure would let that through as success — and the caller would
  // then promise an email that was never sent, or announce a password that never changed.
  it("throws when signup is rate-limited, rather than promising an email", async () => {
    stubFetch(jsonResponse(429, { status: 429 }));

    await expect(signUp("visitor@example.com", "pw")).rejects.toThrow(AuthError);
  });

  it("throws when the password reset is rate-limited, rather than reporting a changed password", async () => {
    stubFetch(jsonResponse(429, { status: 429 }));

    await expect(resetPassword("the-key", "new-pw")).rejects.toThrow(AuthError);
  });

  it("carries a fallback message when the server sends no errors to quote", async () => {
    stubFetch(jsonResponse(429, { status: 429 }));

    const error = await verifyEmail("the-key").catch((e) => e);

    expect(error).toBeInstanceOf(AuthError);
    expect(error.message).toMatch(/\w/);
  });

  it("throws on a server error", async () => {
    stubFetch(jsonResponse(500, { status: 500 }));

    await expect(logIn("visitor@example.com", "pw")).rejects.toThrow(AuthError);
  });
});

describe("verifyEmail", () => {
  it("activates the account; 401 is expected, because a mailed key hands out no session", async () => {
    const fetchMock = stubFetch(jsonResponse(401, sessionBody(false)));

    await expect(verifyEmail("the-key")).resolves.toBeUndefined();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/auth/browser/v1/auth/email/verify");
    expect(JSON.parse(init.body)).toEqual({ key: "the-key" });
  });

  it("throws on a spent or expired key", async () => {
    stubFetch(
      jsonResponse(400, errorBody({ message: "Invalid or expired key.", code: "invalid_key" })),
    );

    await expect(verifyEmail("stale")).rejects.toThrow("Invalid or expired key.");
  });
});

describe("password reset", () => {
  it("requests a link", async () => {
    const fetchMock = stubFetch(jsonResponse(200, { status: 200 }));

    await expect(requestPasswordReset("visitor@example.com")).resolves.toBeUndefined();

    expect(fetchMock.mock.calls[0][0]).toBe("/api/auth/browser/v1/auth/password/request");
  });

  it("sets the new password; 401 again, since the key alone does not sign you in", async () => {
    const fetchMock = stubFetch(jsonResponse(401, sessionBody(false)));

    await expect(resetPassword("the-key", "new-pw")).resolves.toBeUndefined();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/auth/browser/v1/auth/password/reset");
    expect(JSON.parse(init.body)).toEqual({ key: "the-key", password: "new-pw" });
  });

  it("throws when the new password is rejected", async () => {
    stubFetch(
      jsonResponse(
        400,
        errorBody({ message: "This password is too short.", code: "password_too_short", param: "password" }),
      ),
    );

    await expect(resetPassword("the-key", "x")).rejects.toThrow("This password is too short.");
  });
});

describe("logOut", () => {
  it("ends the session with DELETE; allauth answers 401, which is the point", async () => {
    const fetchMock = stubFetch(jsonResponse(401, sessionBody(false)));

    await expect(logOut()).resolves.toBeUndefined();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/auth/browser/v1/auth/session");
    expect(init.method).toBe("DELETE");
    expect(init.headers["X-CSRFToken"]).toBe("tok123");
  });
});

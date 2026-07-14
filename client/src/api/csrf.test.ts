import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { csrfHeaders, ensureCsrfToken, readCsrfToken } from "./csrf";

function setCookie(value: string) {
  Object.defineProperty(document, "cookie", {
    value,
    writable: true,
    configurable: true,
  });
}

beforeEach(() => setCookie(""));
afterEach(() => vi.restoreAllMocks());

describe("readCsrfToken", () => {
  it("returns null when no csrftoken cookie is present", () => {
    setCookie("sessionid=abc");
    expect(readCsrfToken()).toBeNull();
  });

  it("picks csrftoken out of a cookie string holding several cookies", () => {
    setCookie("sessionid=abc; csrftoken=tok123; other=x");
    expect(readCsrfToken()).toBe("tok123");
  });

  it("does not mistake a cookie whose name merely ends in csrftoken", () => {
    setCookie("not_csrftoken=wrong; csrftoken=right");
    expect(readCsrfToken()).toBe("right");
  });
});

describe("csrfHeaders", () => {
  it("sends no header when there is no token, so anonymous POSTs stay header-free", () => {
    expect(csrfHeaders()).toEqual({});
  });

  it("sends X-CSRFToken once the cookie exists", () => {
    setCookie("csrftoken=tok123");
    expect(csrfHeaders()).toEqual({ "X-CSRFToken": "tok123" });
  });
});

describe("ensureCsrfToken", () => {
  it("fetches /api/auth/csrf/ when the cookie is missing and returns the planted token", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => {
      setCookie("csrftoken=fresh");
      return { ok: true };
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(ensureCsrfToken()).resolves.toBe("fresh");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/csrf/",
      expect.objectContaining({ credentials: "same-origin" }),
    );
  });

  it("does not call the server when the cookie is already there", async () => {
    setCookie("csrftoken=tok123");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(ensureCsrfToken()).resolves.toBe("tok123");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

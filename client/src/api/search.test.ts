import { afterEach, describe, expect, it, vi } from "vitest";
import { searchDocument } from "./search";

afterEach(() => vi.restoreAllMocks());

describe("searchDocument request contract", () => {
  //Test: omitting the ratio falls back to the canonical 1.3, not the old 0.5
  it("defaults window_size_ratio to the canonical 1.3 when omitted", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await searchDocument({ docId: 1, query: "rex" });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.window_size_ratio).toBe(1.3);
  });

  //Test: search stays usable without an account (#64) — no cookie, no CSRF header
  it("sends no CSRF header when the visitor is anonymous", async () => {
    Object.defineProperty(document, "cookie", { value: "", writable: true });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await searchDocument({ docId: 1, query: "rex" });

    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty("X-CSRFToken");
  });

  it("echoes the CSRF token once a session cookie exists", async () => {
    Object.defineProperty(document, "cookie", {
      value: "csrftoken=tok123",
      writable: true,
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await searchDocument({ docId: 1, query: "rex" });

    expect(fetchMock.mock.calls[0][1].headers["X-CSRFToken"]).toBe("tok123");
  });
});

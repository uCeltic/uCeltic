import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchSearchHistory,
  saveSearchHistoryEntry,
  SearchHistoryReadError,
  type SearchHistoryEntry,
} from "./searchHistory";

afterEach(() => vi.restoreAllMocks());

const entry: SearchHistoryEntry = {
  query: "ro gab in ri",
  query_origin: "typed",
  window_size_ratio: 1.3,
  step_size: 1,
  dissimilarity_threshold: 0.5,
  top_k: 10,
  versions: [
    { title: "Lebor na hUidre", hits: [{ snippet: "ro gab in ri", score: 0.12 }] },
  ],
};

describe("saveSearchHistoryEntry", () => {
  it("posts the snapshot to the search-history endpoint with the CSRF token", async () => {
    Object.defineProperty(document, "cookie", {
      value: "csrftoken=tok",
      writable: true,
    });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await saveSearchHistoryEntry(entry);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/search-history/");
    expect(init.method).toBe("POST");
    // Signed-in only, so the session is always there and Django always CSRF-checks it.
    expect(init.headers["X-CSRFToken"]).toBe("tok");
    expect(JSON.parse(init.body)).toEqual(entry);
    // Nothing the client claims about who this belongs to — the server stamps that.
    expect(JSON.parse(init.body)).not.toHaveProperty("user");
  });

  it("swallows a failed save: nobody asked for it and nobody is waiting", async () => {
    Object.defineProperty(document, "cookie", {
      value: "csrftoken=tok",
      writable: true,
    });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await expect(saveSearchHistoryEntry(entry)).resolves.toBeUndefined();
  });

  it("reports a refused snapshot, which means the client and the endpoint disagree", async () => {
    Object.defineProperty(document, "cookie", {
      value: "csrftoken=tok",
      writable: true,
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 400 }));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    await saveSearchHistoryEntry(entry);

    expect(error).toHaveBeenCalledWith("search history not saved: 400");
  });
});

describe("fetchSearchHistory", () => {
  it("reads the signed-in user's own entries from the search-history endpoint", async () => {
    const stored = [
      {
        id: 7,
        ...entry,
        created_at: "2026-09-01T10:00:00Z",
      },
    ];
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => stored });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchSearchHistory()).resolves.toEqual(stored);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/search-history/");
    // Whose history it is comes from the session cookie, never from a parameter.
    expect(init.credentials).toBe("same-origin");
  });

  it("raises when the history cannot be read, so the page can say so", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    await expect(fetchSearchHistory()).rejects.toBeInstanceOf(SearchHistoryReadError);
  });
});

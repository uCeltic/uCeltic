import { afterEach, describe, expect, it, vi } from "vitest";
import { saveSearchHistoryEntry, type SearchHistoryEntry } from "./searchHistory";

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
});

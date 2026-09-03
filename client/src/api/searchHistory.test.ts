import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearSearchHistory,
  deleteSearchHistoryEntry,
  fetchSearchHistory,
  saveSearchHistoryEntry,
  exportSearchHistoryEntry,
  SearchHistoryDeleteError,
  SearchHistoryExportError,
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

describe("deleteSearchHistoryEntry", () => {
  it("deletes the one entry by its id, with the CSRF token", async () => {
    Object.defineProperty(document, "cookie", {
      value: "csrftoken=tok",
      writable: true,
    });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await deleteSearchHistoryEntry(7);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/search-history/7/");
    expect(init.method).toBe("DELETE");
    expect(init.headers["X-CSRFToken"]).toBe("tok");
    expect(init.credentials).toBe("same-origin");
  });

  it("raises when the entry could not be deleted, so nothing is removed on screen", async () => {
    Object.defineProperty(document, "cookie", {
      value: "csrftoken=tok",
      writable: true,
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));

    await expect(deleteSearchHistoryEntry(7)).rejects.toBeInstanceOf(
      SearchHistoryDeleteError,
    );
  });
});

describe("clearSearchHistory", () => {
  it("deletes the whole collection, with the CSRF token", async () => {
    Object.defineProperty(document, "cookie", {
      value: "csrftoken=tok",
      writable: true,
    });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await clearSearchHistory();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/search-history/");
    expect(init.method).toBe("DELETE");
    expect(init.headers["X-CSRFToken"]).toBe("tok");
    expect(init.credentials).toBe("same-origin");
  });

  it("raises when the history could not be cleared", async () => {
    Object.defineProperty(document, "cookie", {
      value: "csrftoken=tok",
      writable: true,
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    await expect(clearSearchHistory()).rejects.toBeInstanceOf(SearchHistoryDeleteError);
  });
});

describe("exportSearchHistoryEntry", () => {
  /** The bits of the browser a download touches, stubbed so the test can watch it. */
  function stubDownload() {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn().mockReturnValue("blob:the-file"),
      revokeObjectURL: vi.fn(),
    });
    return click;
  }

  function docxResponse(disposition: string | null) {
    return {
      ok: true,
      blob: vi.fn().mockResolvedValue(new Blob(["docx"])),
      headers: { get: () => disposition },
    };
  }

  it("asks the backend for the one entry's document and saves it under the name it came with", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(docxResponse('attachment; filename="search-2026-09-01-1000.docx"'));
    vi.stubGlobal("fetch", fetchMock);
    const click = stubDownload();

    await exportSearchHistoryEntry(7);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/search-history/7/export/");
    // The session cookie is what says whose entry this is; nothing about the user
    // travels in the request.
    expect(init.credentials).toBe("same-origin");
    expect(click).toHaveBeenCalledOnce();
    const link = click.mock.instances[0] as HTMLAnchorElement;
    expect(link.download).toBe("search-2026-09-01-1000.docx");
    expect(link.href).toContain("blob:the-file");
  });

  it("still names the file when the response carries no filename", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(docxResponse(null)));
    const click = stubDownload();

    await exportSearchHistoryEntry(7);

    expect((click.mock.instances[0] as HTMLAnchorElement).download).toMatch(/\.docx$/);
  });

  it("raises when the document could not be exported — the user asked for this one", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));

    await expect(exportSearchHistoryEntry(7)).rejects.toBeInstanceOf(
      SearchHistoryExportError,
    );
  });
});

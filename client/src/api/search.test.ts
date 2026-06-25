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
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FeedbackError, submitFeedback } from "./feedback";

function setCookie(value: string) {
  Object.defineProperty(document, "cookie", { value, writable: true, configurable: true });
}

beforeEach(() => setCookie("csrftoken=tok123"));
afterEach(() => vi.restoreAllMocks());

const SUBMISSION = { category: "bug" as const, body: "Retry re-runs the wrong search." };

describe("submitFeedback", () => {
  it("posts the category, body and this sitting's session id", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await submitFeedback(SUBMISSION);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/feedback/");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("same-origin");
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ category: "bug", body: "Retry re-runs the wrong search." });
    expect(typeof body.session_id).toBe("string");
    expect(typeof body.app_version).toBe("string");
  });

  it("sends the CSRF header a signed-in visitor's session needs", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await submitFeedback(SUBMISSION);

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers["X-CSRFToken"]).toBe("tok123");
  });

  it("passes an optional contact and context snapshot through", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    const context = { open_document_ids: [3], url: "http://localhost/workspace" };

    await submitFeedback({ ...SUBMISSION, contact: "ada@example.com", context });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.contact).toBe("ada@example.com");
    expect(body.context).toEqual(context);
  });

  it("throws FeedbackError carrying the server's own field message on a 400", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: { body: ["This field may not be blank."] } }),
      }),
    );

    await expect(submitFeedback(SUBMISSION)).rejects.toThrow("This field may not be blank.");
  });

  it("throws FeedbackError with a generic message when the server says nothing useful", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }),
    );

    await expect(submitFeedback(SUBMISSION)).rejects.toThrow(FeedbackError);
  });

  it("throws FeedbackError when the request never reaches the server", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network down")));

    await expect(submitFeedback(SUBMISSION)).rejects.toThrow(FeedbackError);
  });
});

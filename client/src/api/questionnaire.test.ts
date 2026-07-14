import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchQuestionnaire,
  skipQuestionnaire,
  submitQuestionnaireAnswers,
  QuestionnaireError,
} from "./questionnaire";

function setCookie(value: string) {
  Object.defineProperty(document, "cookie", { value, writable: true, configurable: true });
}

beforeEach(() => setCookie("csrftoken=tok123"));
afterEach(() => vi.restoreAllMocks());

describe("fetchQuestionnaire", () => {
  it("returns the parsed definition on success", async () => {
    const definition = { version: 1, questions: [{ id: "purpose", prompt: "Why?", type: "text" }] };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => definition }),
    );

    await expect(fetchQuestionnaire()).resolves.toEqual(definition);
  });

  it("throws QuestionnaireError on a failed response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 403 }));

    await expect(fetchQuestionnaire()).rejects.toThrow(QuestionnaireError);
  });
});

describe("submitQuestionnaireAnswers / skipQuestionnaire", () => {
  it("sends skipped: false with the answers and the session id", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await submitQuestionnaireAnswers({ purpose: "reading" });

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ skipped: false, answers: { purpose: "reading" } });
    expect(typeof body.session_id).toBe("string");
  });

  it("sends skipped: true with no answers", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await skipQuestionnaire();

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toMatchObject({ skipped: true });
  });

  it("surfaces the server's own field error message on a validation failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: { answers: ["Required unless skipped."] } }),
      }),
    );

    await expect(submitQuestionnaireAnswers({})).rejects.toThrow("Required unless skipped.");
  });

  it("falls back to a generic message when the response carries no field error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));

    await expect(skipQuestionnaire()).rejects.toThrow("Could not save. Please try again.");
  });
});

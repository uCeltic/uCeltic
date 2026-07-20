import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logEvent, logSessionStarted } from "./log";
import { useAuthStore } from "../store/authStore";

afterEach(() => vi.restoreAllMocks());

describe("logEvent request contract", () => {
  it("posts an envelope with session_id, event_type, payload, client_ts, and app_version", () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    logEvent("session_started", { screen: "workspace" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/events/");

    const body = JSON.parse(init.body);
    expect(body.event_type).toBe("session_started");
    expect(body.payload).toEqual({ screen: "workspace" });
    expect(typeof body.session_id).toBe("string");
    expect(body.session_id.length).toBeGreaterThan(0);
    expect(typeof body.client_ts).toBe("string");
    expect(typeof body.app_version).toBe("string");
    expect(body.app_version.length).toBeGreaterThan(0);
  });

  it("keeps the same session_id across multiple events in one load", () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    logEvent("session_started");
    logEvent("mode_changed", { from: "text", to: "entities" });

    const first = JSON.parse(fetchMock.mock.calls[0][1].body).session_id;
    const second = JSON.parse(fetchMock.mock.calls[1][1].body).session_id;
    expect(first).toBe(second);
  });

  //Test: logging still works for visitors without an account (#64)
  it("sends no CSRF header when the visitor is anonymous", () => {
    Object.defineProperty(document, "cookie", { value: "", writable: true });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    logEvent("mode_changed", { to: "entities" });

    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty("X-CSRFToken");
  });

  it("echoes the CSRF token once a session cookie exists", () => {
    Object.defineProperty(document, "cookie", {
      value: "csrftoken=tok123",
      writable: true,
    });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    logEvent("mode_changed", { to: "entities" });

    expect(fetchMock.mock.calls[0][1].headers["X-CSRFToken"]).toBe("tok123");
  });

  it("never throws and drops the event silently when fetch rejects", () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    expect(() => logEvent("session_started")).not.toThrow();
  });
});

describe("idle-based session rotation (ADR-0007)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-20T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    useAuthStore.setState({ questionnaireResolved: false });
  });

  it("keeps the same session_id across events under 6 hours apart", () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    logEvent("mode_changed", { to: "entities" });
    vi.setSystemTime(new Date("2026-07-20T05:59:00Z"));
    logEvent("mode_changed", { to: "search" });

    const first = JSON.parse(fetchMock.mock.calls[0][1].body).session_id;
    const second = JSON.parse(fetchMock.mock.calls[1][1].body).session_id;
    expect(first).toBe(second);
  });

  it("rotates the session_id on the next event once idle exceeds 6 hours", () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    logEvent("mode_changed", { to: "entities" });
    vi.setSystemTime(new Date("2026-07-20T06:00:01Z"));
    logEvent("mode_changed", { to: "search" });

    const first = JSON.parse(fetchMock.mock.calls[0][1].body).session_id;
    const second = JSON.parse(fetchMock.mock.calls[1][1].body).session_id;
    expect(first).not.toBe(second);
  });

  it("resets questionnaireResolved so the prompt can show again once idle exceeds 6 hours", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    logEvent("mode_changed", { to: "entities" }); // anchors the idle clock at this instant
    useAuthStore.setState({ questionnaireResolved: true });

    vi.setSystemTime(new Date("2026-07-20T06:00:01Z"));
    logEvent("mode_changed", { to: "search" });

    expect(useAuthStore.getState().questionnaireResolved).toBe(false);
  });

  it("leaves questionnaireResolved untouched when the gap is under 6 hours", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    logEvent("mode_changed", { to: "entities" }); // anchors the idle clock at this instant
    useAuthStore.setState({ questionnaireResolved: true });

    vi.setSystemTime(new Date("2026-07-20T01:00:00Z"));
    logEvent("mode_changed", { to: "search" });

    expect(useAuthStore.getState().questionnaireResolved).toBe(true);
  });
});

describe("logSessionStarted", () => {
  // regression guard: React StrictMode double-invokes the mount effect in dev,
  // which must not turn into two session_started rows for one app load
  it("only emits once even when called multiple times in the same load", () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    logSessionStarted({ screen: "/workspace" });
    logSessionStarted({ screen: "/workspace" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
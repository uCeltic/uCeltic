import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getVerificationCooldownRemainingMs,
  recordVerificationEmailSent,
  VERIFY_EMAIL_COOLDOWN_MS,
} from "./verifyEmailCooldown";

const EMAIL = "visitor@example.com";

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("verifyEmailCooldown", () => {
  it("reports no cooldown before anything has been recorded", () => {
    expect(getVerificationCooldownRemainingMs(EMAIL)).toBe(0);
  });

  it("reports the full window right after recording a send", () => {
    recordVerificationEmailSent(EMAIL);

    expect(getVerificationCooldownRemainingMs(EMAIL)).toBe(VERIFY_EMAIL_COOLDOWN_MS);
  });

  it("counts down as time passes", () => {
    recordVerificationEmailSent(EMAIL);

    vi.setSystemTime(new Date("2026-01-01T00:01:00Z"));

    expect(getVerificationCooldownRemainingMs(EMAIL)).toBe(VERIFY_EMAIL_COOLDOWN_MS - 60_000);
  });

  it("reaches zero once the window elapses, never going negative", () => {
    recordVerificationEmailSent(EMAIL);

    vi.setSystemTime(new Date("2026-01-01T01:00:00Z"));

    expect(getVerificationCooldownRemainingMs(EMAIL)).toBe(0);
  });

  it("keys the cooldown by email, so a different address is unaffected", () => {
    recordVerificationEmailSent(EMAIL);

    expect(getVerificationCooldownRemainingMs("someone-else@example.com")).toBe(0);
  });

  it("survives being read back after a simulated reload (a fresh call, same localStorage)", () => {
    recordVerificationEmailSent(EMAIL);
    vi.setSystemTime(new Date("2026-01-01T00:00:30Z"));

    // Nothing re-records; this call alone must see the state left by the first.
    const remaining = getVerificationCooldownRemainingMs(EMAIL);

    expect(remaining).toBe(VERIFY_EMAIL_COOLDOWN_MS - 30_000);
  });
});

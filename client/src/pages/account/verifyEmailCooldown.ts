/**
 * allauth silently drops a verification-email resend once its own 3-minute
 * rate limit is hit — the API answers as if it succeeded either way, so the
 * frontend can't tell from the response whether an email actually went out.
 * The cooldown is tracked here instead, client-side, keyed by email so a
 * shared browser doesn't cross-contaminate visitors. localStorage (not
 * sessionStorage) so the cooldown survives a refresh or a new tab.
 */
export const VERIFY_EMAIL_COOLDOWN_MS = 3 * 60 * 1000;

function cooldownKey(email: string): string {
  return `verify_email_last_sent:${email}`;
}

export function recordVerificationEmailSent(email: string): void {
  try {
    localStorage.setItem(cooldownKey(email), String(Date.now()));
  } catch {
    // Private-mode browsers can throw on storage access; the cooldown simply
    // won't persist, and the button falls back to always-enabled.
  }
}

export function getVerificationCooldownRemainingMs(email: string): number {
  try {
    const lastSent = localStorage.getItem(cooldownKey(email));
    if (!lastSent) return 0;
    return Math.max(0, VERIFY_EMAIL_COOLDOWN_MS - (Date.now() - Number(lastSent)));
  } catch {
    return 0;
  }
}

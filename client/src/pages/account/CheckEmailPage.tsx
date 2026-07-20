import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { resendVerificationEmail } from "../../api/auth";
import AccountShell, { FormError, link, primaryBtn } from "./AccountShell";
import { getVerificationCooldownRemainingMs, recordVerificationEmailSent } from "./verifyEmailCooldown";

function formatRemaining(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * The interstitial after registering — and after a sign-in blocked on an unactivated
 * account, which allauth answers by re-sending the link. Hence "we've sent" rather than
 * "we've just created": both paths land here.
 */
export default function CheckEmailPage() {
  const { state } = useLocation();
  const email = (state as { email?: string } | null)?.email;

  const [remainingMs, setRemainingMs] = useState(() =>
    email ? getVerificationCooldownRemainingMs(email) : 0,
  );
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Recomputed from the localStorage timestamp every tick, rather than decremented
  // in memory, so a stale in-memory counter can never drift from the recorded send —
  // the same value a refresh or a new tab would derive from scratch.
  useEffect(() => {
    if (!email) return;
    const interval = setInterval(() => {
      setRemainingMs(getVerificationCooldownRemainingMs(email));
    }, 1000);
    return () => clearInterval(interval);
  }, [email]);

  async function handleResend() {
    if (!email) return;
    setError(null);
    setSending(true);
    try {
      await resendVerificationEmail(email);
      // allauth silently drops this if its own rate limit is already hit, with no way
      // for the response to say so — so the cooldown starts on every click regardless.
      recordVerificationEmailSent(email);
      setRemainingMs(getVerificationCooldownRemainingMs(email));
    } catch {
      setError("Could not resend the verification email. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <AccountShell title="Check your email">
      <p className="text-sm text-[#52524F]">
        We've sent an activation link to{" "}
        {email ? <strong className="font-medium">{email}</strong> : "your email address"}. Open it
        to activate your account, then sign in.
      </p>
      <p className="mt-3 text-sm text-[#6B6B67]">
        No email? Check your spam folder{email ? ", or resend it below." : "."}
      </p>

      {email && (
        <div className="mt-5">
          <FormError message={error} />
          <button
            type="button"
            className={primaryBtn}
            onClick={handleResend}
            disabled={sending || remainingMs > 0}
          >
            {sending
              ? "Sending…"
              : remainingMs > 0
                ? `Resend available in ${formatRemaining(remainingMs)}`
                : "Resend verification email"}
          </button>
        </div>
      )}

      <p className="mt-5 text-sm text-[#6B6B67]">
        <Link to="/account/login" className={link}>
          Back to sign in
        </Link>
      </p>
    </AccountShell>
  );
}

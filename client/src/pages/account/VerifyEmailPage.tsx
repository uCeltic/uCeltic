import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AuthError, verifyEmail } from "../../api/auth";
import AccountShell, { FormError, link } from "./AccountShell";

/**
 * The landing page for the emailed activation link. Redeeming the key activates the
 * account but hands out no session — the link can be opened in a different browser than
 * the one that registered — so the way on from here is the sign-in form.
 */
export default function VerifyEmailPage() {
  // Router-decoded: allauth percent-encodes the key into the URL, and the API wants it raw.
  const { key } = useParams<{ key: string }>();

  const [state, setState] = useState<"verifying" | "verified" | "failed">("verifying");
  const [error, setError] = useState<string | null>(null);

  // The key is single-use, and StrictMode mounts effects twice in dev — without this
  // guard the second redemption fails against a key the first one just spent.
  const redeemed = useRef(false);

  useEffect(() => {
    if (!key || redeemed.current) return;
    redeemed.current = true;

    verifyEmail(key)
      .then(() => setState("verified"))
      .catch((caught) => {
        setError(
          caught instanceof AuthError
            ? caught.message
            : "Could not activate your account. The link may have expired.",
        );
        setState("failed");
      });
  }, [key]);

  if (state === "verifying") {
    return (
      <AccountShell title="Activating your account…">
        <p className="text-sm text-[#6B6B67]">One moment.</p>
      </AccountShell>
    );
  }

  if (state === "failed") {
    return (
      <AccountShell title="That link did not work">
        <FormError message={error} />
        <p className="text-sm text-[#6B6B67]">
          Activation links expire. Signing in with your email and password sends a fresh one.
        </p>
        <p className="mt-5 text-sm text-[#6B6B67]">
          <Link to="/account/login" className={link}>
            Back to sign in
          </Link>
        </p>
      </AccountShell>
    );
  }

  return (
    <AccountShell title="Account activated">
      <p className="text-sm text-[#52524F]">Your email address is confirmed. You can sign in now.</p>
      <p className="mt-5 text-sm text-[#6B6B67]">
        <Link to="/account/login" className={link}>
          Sign in
        </Link>
      </p>
    </AccountShell>
  );
}

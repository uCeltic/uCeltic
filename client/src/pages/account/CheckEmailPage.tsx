import { Link, useLocation } from "react-router-dom";
import AccountShell, { link } from "./AccountShell";

/**
 * The interstitial after registering — and after a sign-in blocked on an unactivated
 * account, which allauth answers by re-sending the link. Hence "we've sent" rather than
 * "we've just created": both paths land here.
 */
export default function CheckEmailPage() {
  const { state } = useLocation();
  const email = (state as { email?: string } | null)?.email;

  return (
    <AccountShell title="Check your email">
      <p className="text-sm text-[#52524F]">
        We've sent an activation link to{" "}
        {email ? <strong className="font-medium">{email}</strong> : "your email address"}. Open it
        to activate your account, then sign in.
      </p>
      <p className="mt-3 text-sm text-[#6B6B67]">
        No email? Check your spam folder. Signing in again re-sends the link.
      </p>

      <p className="mt-5 text-sm text-[#6B6B67]">
        <Link to="/account/login" className={link}>
          Back to sign in
        </Link>
      </p>
    </AccountShell>
  );
}

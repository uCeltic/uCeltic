import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { AuthError, resetPassword } from "../../api/auth";
import AccountShell, { FormError, input, label, link, primaryBtn } from "./AccountShell";

/**
 * The landing page for the emailed reset link. Like activation, redeeming the key changes
 * the password but hands out no session, so the visitor signs in afterwards.
 */
export default function PasswordResetKeyPage() {
  const { key } = useParams<{ key: string }>();

  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!key) return;

    setError(null);
    setSubmitting(true);

    try {
      await resetPassword(key, password);
      setDone(true);
    } catch (caught) {
      setError(
        caught instanceof AuthError
          ? caught.message
          : "Could not set the password. The link may have expired.",
      );
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <AccountShell title="Password changed">
        <p className="text-sm text-[#52524F]">You can sign in with your new password now.</p>
        <p className="mt-5 text-sm text-[#6B6B67]">
          <Link to="/account/login" className={link}>
            Sign in
          </Link>
        </p>
      </AccountShell>
    );
  }

  return (
    <AccountShell title="Set a new password">
      <FormError message={error} />

      <form onSubmit={handleSubmit} noValidate>
        <div className="mb-5">
          <label className={label} htmlFor="password">
            New password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            className={input}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button type="submit" className={primaryBtn} disabled={submitting}>
          {submitting ? "Saving…" : "Set password"}
        </button>
      </form>
    </AccountShell>
  );
}

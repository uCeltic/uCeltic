import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { AuthError, requestPasswordReset } from "../../api/auth";
import AccountShell, { FormError, input, label, link, primaryBtn } from "./AccountShell";

export default function PasswordResetRequestPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (caught) {
      setError(
        caught instanceof AuthError
          ? caught.message
          : "Could not send the link. Please try again.",
      );
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <AccountShell title="Check your email">
        <p className="text-sm text-[#52524F]">
          If an account exists for <strong className="font-medium">{email}</strong>, a
          password-reset link is on its way.
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
    <AccountShell title="Reset your password" subtitle="We'll email you a link to set a new one.">
      <FormError message={error} />

      <form onSubmit={handleSubmit} noValidate>
        <div className="mb-5">
          <label className={label} htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            className={input}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <button type="submit" className={primaryBtn} disabled={submitting}>
          {submitting ? "Sending…" : "Send reset link"}
        </button>
      </form>

      <p className="mt-4 text-sm text-[#6B6B67]">
        <Link to="/account/login" className={link}>
          Back to sign in
        </Link>
      </p>
    </AccountShell>
  );
}

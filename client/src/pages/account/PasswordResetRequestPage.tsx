import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { requestPasswordReset } from "../../api/auth";
import AccountShell, { Field, FormError, link, primaryBtn } from "./AccountShell";
import { useAuthSubmit } from "./useAuthSubmit";

export default function PasswordResetRequestPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const { error, submitting, run } = useAuthSubmit("Could not send the link. Please try again.");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    await run(async () => {
      await requestPasswordReset(email);
      setSent(true);
    });
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
        <Field
          id="email"
          label="Email"
          spacing="mb-5"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

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

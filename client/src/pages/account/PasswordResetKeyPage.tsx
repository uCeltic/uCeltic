import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { resetPassword } from "../../api/auth";
import AccountShell, { Field, FormError, link, primaryBtn } from "./AccountShell";
import { useAuthSubmit } from "./useAuthSubmit";

/**
 * The landing page for the emailed reset link. Like activation, redeeming the key changes
 * the password but hands out no session, so the visitor signs in afterwards.
 */
export default function PasswordResetKeyPage() {
  const { key } = useParams<{ key: string }>();

  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const { error, submitting, run } = useAuthSubmit(
    "Could not set the password. The link may have expired.",
  );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!key) return;

    await run(async () => {
      await resetPassword(key, password);
      setDone(true);
    });
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
        <Field
          id="password"
          label="New password"
          spacing="mb-5"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button type="submit" className={primaryBtn} disabled={submitting}>
          {submitting ? "Saving…" : "Set password"}
        </button>
      </form>
    </AccountShell>
  );
}

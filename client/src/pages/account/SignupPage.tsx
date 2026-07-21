import { useState, type FocusEvent, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signUp } from "../../api/auth";
import AccountShell, { Field, FormError, link, primaryBtn } from "./AccountShell";
import { useAuthSubmit } from "./useAuthSubmit";
import { recordVerificationEmailSent } from "./verifyEmailCooldown";

const MISMATCH_MESSAGE = "Passwords don't match.";

export default function SignupPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mismatch, setMismatch] = useState(false);
  const { error, submitting, run, clearError } = useAuthSubmit(
    "Could not register. Please try again.",
  );

  function syncMismatch(confirmValue: string) {
    const mismatched = confirmValue !== "" && confirmValue !== password;
    setMismatch(mismatched);
    return mismatched;
  }

  function handleConfirmBlur(event: FocusEvent<HTMLInputElement>) {
    syncMismatch(event.target.value);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    // A mismatch is caught here rather than by the server, so it clears any standing
    // server error itself — nothing was sent that could have replaced it.
    clearError();
    if (syncMismatch(confirmPassword)) return;

    await run(async () => {
      await signUp(email, password);
      // Registration never signs you in: activation is mandatory, so the only place to
      // go from here is the inbox. Signup itself sent the first activation mail, so the
      // resend cooldown starts now — CheckEmailPage never re-records this on its own,
      // since it can't tell a fresh arrival from a refresh of the same one.
      recordVerificationEmailSent(email);
      navigate("/account/verify-email/sent", { state: { email }, replace: true });
    });
  }

  return (
    <AccountShell
      title="Register"
      subtitle="An account is optional — the workspace is fully usable without one."
    >
      <FormError message={error} />

      <form onSubmit={handleSubmit} noValidate>
        <Field
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <Field
          id="password"
          label="Password"
          className="mb-5"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        >
          <p className="mt-1 text-sm text-[#6B6B67]">
            At least 8 characters, not too similar to your email address, not a common or
            breached password, and not entirely numeric.
          </p>
        </Field>

        <Field
          id="confirmPassword"
          label="Confirm password"
          className="mb-5"
          type="password"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value);
            if (mismatch) syncMismatch(e.target.value);
          }}
          onBlur={handleConfirmBlur}
        >
          {mismatch && (
            <div className="mt-1">
              <FormError message={MISMATCH_MESSAGE} />
            </div>
          )}
        </Field>

        <button type="submit" className={primaryBtn} disabled={submitting}>
          {submitting ? "Registering…" : "Register"}
        </button>
      </form>

      <p className="mt-4 text-sm text-[#6B6B67]">
        Already registered?{" "}
        <Link to="/account/login" className={link}>
          Sign in
        </Link>
      </p>
    </AccountShell>
  );
}

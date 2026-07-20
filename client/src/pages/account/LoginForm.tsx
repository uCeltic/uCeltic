import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { AuthError } from "../../api/auth";
import { FormError, input, label, primaryBtn } from "./AccountShell";
import { recordVerificationEmailSent } from "./verifyEmailCooldown";

/** Email/password sign-in, shared between the /account/login page and any future embed. */
export default function LoginForm() {
  const navigate = useNavigate();
  const signIn = useAuthStore((s) => s.signIn);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const outcome = await signIn(email, password);

      if (outcome.status === "verification_pending") {
        // The password was right but the account is not activated. allauth has just
        // re-sent the link, so this is the same interstitial as a fresh sign-up — not
        // an error the visitor can act on by retyping.
        recordVerificationEmailSent(email);
        navigate("/account/verify-email/sent", { state: { email }, replace: true });
        return;
      }
      navigate("/workspace", { replace: true });
    } catch (caught) {
      setError(
        caught instanceof AuthError ? caught.message : "Could not sign in. Please try again.",
      );
      setSubmitting(false);
    }
  }

  return (
    <>
      <FormError message={error} />

      <form onSubmit={handleSubmit} noValidate>
        <div className="mb-4">
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

        <div className="mb-5">
          <label className={label} htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            className={input}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button type="submit" className={primaryBtn} disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </>
  );
}

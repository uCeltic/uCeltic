import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { Field, FormError, primaryBtn } from "./AccountShell";
import { useAuthSubmit } from "./useAuthSubmit";
import { recordVerificationEmailSent } from "./verifyEmailCooldown";

/** Email/password sign-in, shared between the /account/login page and any future embed. */
export default function LoginForm() {
  const navigate = useNavigate();
  const signIn = useAuthStore((s) => s.signIn);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { error, submitting, run } = useAuthSubmit("Could not sign in. Please try again.");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    await run(async () => {
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
    });
  }

  return (
    <>
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
          spacing="mb-5"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button type="submit" className={primaryBtn} disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </>
  );
}

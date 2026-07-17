import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthError, signUp } from "../../api/auth";
import AccountShell, { FormError, input, label, link, primaryBtn } from "./AccountShell";

export default function SignupPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await signUp(email, password);
      // Registration never signs you in: activation is mandatory, so the only place to
      // go from here is the inbox.
      navigate("/account/verify-email/sent", { state: { email }, replace: true });
    } catch (caught) {
      setError(
        caught instanceof AuthError ? caught.message : "Could not register. Please try again.",
      );
      setSubmitting(false);
    }
  }

  return (
    <AccountShell
      title="Register"
      subtitle="An account is optional — the workspace is fully usable without one."
    >
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
            autoComplete="new-password"
            required
            className={input}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="mt-1 text-sm text-[#6B6B67]">At least 8 characters.</p>
        </div>

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

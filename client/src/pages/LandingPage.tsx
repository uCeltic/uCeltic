import { Link } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import AccountShell, { link, primaryBtn } from "./account/AccountShell";
import LoginForm from "./account/LoginForm";

export default function LandingPage() {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);

  // Mirrors ProfilePage: nothing renders until the session probe lands, so a
  // signed-in visitor never sees the login form flash ahead of it (ADR-0004).
  if (status === "unknown") return null;

  if (status === "authenticated") {
    return (
      <AccountShell title="uCeltic" hideAccountLink>
        <p className="text-sm text-[#52524F]">Signed in as {user?.email}</p>
        <Link to="/workspace" className={`mt-4 block text-center ${primaryBtn}`}>
          Enter workspace
        </Link>
      </AccountShell>
    );
  }

  return (
    <AccountShell title="uCeltic" hideAccountLink>
      <LoginForm />
      <p className="mt-4 text-sm text-[#6B6B67]">
        <Link to="/workspace" className={link}>
          Continue as a Visitor
        </Link>
      </p>
      <p className="mt-1 text-sm text-[#6B6B67]">
        No account?{" "}
        <Link to="/account/signup" className={link}>
          Register
        </Link>
      </p>
    </AccountShell>
  );
}

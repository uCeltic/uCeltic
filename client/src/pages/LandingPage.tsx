import { Link } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { link, primaryBtn } from "./account/AccountShell";
import LoginForm from "./account/LoginForm";

/** Right column of the homepage split: brand title + illustration, shared by both auth states.
 * The title is set in Uncial Antiqua — the same insular-script tradition the app's own
 * subject matter (digitised medieval Irish manuscripts) draws on, echoing the hand-lettered
 * roundel in the artwork below it. */
function BrandPanel() {
  return (
    <div className="flex flex-col items-center justify-center p-6 text-center md:w-1/2">
      <h1
        className="text-4xl tracking-wide text-[#52524F] md:text-5xl"
        style={{ fontFamily: "'Uncial Antiqua', serif" }}
      >
        uCeltic
      </h1>
      <img
        src="/index_pic_illustration.png"
        alt=""
        className="mt-6 max-h-[320px] w-auto md:max-h-[560px]"
      />
    </div>
  );
}

export default function LandingPage() {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);

  // Mirrors ProfilePage: nothing renders until the session probe lands, so a
  // signed-in visitor never sees the login form flash ahead of it (ADR-0004).
  if (status === "unknown") return null;

  if (status === "authenticated") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F0EEE6] px-4 py-10 md:flex-row">
        <div className="w-full max-w-sm rounded-lg border border-[#D8D4C3] bg-white p-6 shadow-sm md:w-1/2">
          <p className="text-sm text-[#52524F]">Signed in as {user?.email}</p>
          <Link to="/workspace" className={`mt-4 block text-center ${primaryBtn}`}>
            Enter workspace
          </Link>
        </div>
        <BrandPanel />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F0EEE6] px-4 py-10 md:flex-row">
      <div className="w-full max-w-sm rounded-lg border border-[#D8D4C3] bg-white p-6 shadow-sm md:w-1/2">
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
      </div>
      <BrandPanel />
    </div>
  );
}

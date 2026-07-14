import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { secondaryBtn } from "./buttonStyles";

/**
 * The account entry point in the toolbar. Shows the signed-in user's email — #64 collects
 * no display name, and #66 is where a real one arrives to replace this.
 */
export default function AccountMenu() {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);

  // Say nothing until the probe lands: a "Sign in" button that flips to an email a beat
  // later is worse than a beat of nothing.
  if (status === "unknown") return null;

  if (status === "anonymous") {
    return (
      <Link to="/account/login" className={secondaryBtn}>
        Sign in
      </Link>
    );
  }

  async function handleSignOut() {
    setOpen(false);
    await signOut();
    // Stay in the workspace: signing out costs you attribution, not the tool (ADR-0004).
    navigate("/workspace");
  }

  return (
    <div className="relative">
      <button
        type="button"
        className={secondaryBtn}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {user?.email} ▾
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 min-w-full rounded-md border border-[#D8D4C3] bg-white py-1 shadow-md"
        >
          <Link
            to="/account/profile"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block w-full px-3 py-1.5 text-left text-sm text-[#52524F] hover:bg-[#F0EEE6]"
          >
            Profile
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            className="w-full px-3 py-1.5 text-left text-sm text-[#52524F] cursor-pointer hover:bg-[#F0EEE6]"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

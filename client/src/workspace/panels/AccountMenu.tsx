import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";

// A row inside the hamburger menu (#123) — the menu owns the dropdown chrome now, so
// these are flat items, not a self-contained dropdown of their own.
const menuItem =
  "block w-full px-3 py-1.5 text-left text-sm text-[#52524F] hover:bg-[#F0EEE6]";

/**
 * The account section of the hamburger menu. Shows the signed-in user's email — #64
 * collects no display name, and #66 is where a real one arrives to replace this.
 */
export default function AccountMenu() {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const navigate = useNavigate();

  // Say nothing until the probe lands: a "Sign in" link that flips to an email a beat
  // later is worse than a beat of nothing.
  if (status === "unknown") return null;

  if (status === "anonymous") {
    return (
      <Link to="/account/login" role="menuitem" className={menuItem}>
        Sign in
      </Link>
    );
  }

  async function handleSignOut() {
    await signOut();
    // Stay in the workspace: signing out costs you attribution, not the tool (ADR-0004).
    navigate("/workspace");
  }

  return (
    <>
      <div className="px-3 py-1.5 text-xs text-[#8A8778]">{user?.email}</div>
      <Link
        to="/account/profile"
        role="menuitem"
        className={menuItem}
      >
        Profile
      </Link>
      <button
        type="button"
        role="menuitem"
        onClick={handleSignOut}
        className={`${menuItem} cursor-pointer`}
      >
        Sign out
      </button>
    </>
  );
}

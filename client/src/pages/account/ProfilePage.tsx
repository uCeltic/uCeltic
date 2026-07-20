import { useEffect, useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { AuthError, changePassword } from "../../api/auth";
import { fetchProfile, updateDisplayName, ProfileError } from "../../api/profile";
import AccountShell, { FormError, input, label, primaryBtn } from "./AccountShell";

function localPart(email: string): string {
  return email.split("@")[0];
}

export default function ProfilePage() {
  const status = useAuthStore((s) => s.status);
  const authUser = useAuthStore((s) => s.user);

  const [displayName, setDisplayName] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSaved, setNameSaved] = useState(false);
  const [savingName, setSavingName] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetchProfile().then((profile) => {
      setDisplayName(profile.display_name);
      setLoaded(true);
    });
  }, [status]);

  // Signed-in only (#66) — the profile page has nothing to show an anonymous visitor.
  if (status === "anonymous") return <Navigate to="/account/login" replace />;
  if (status === "unknown" || (status === "authenticated" && !loaded)) return null;

  async function handleSaveName(event: FormEvent) {
    event.preventDefault();
    setNameError(null);
    setNameSaved(false);
    setSavingName(true);
    try {
      const profile = await updateDisplayName(displayName);
      setDisplayName(profile.display_name);
      setNameSaved(true);
    } catch (caught) {
      setNameError(caught instanceof ProfileError ? caught.message : "Could not save. Please try again.");
    } finally {
      setSavingName(false);
    }
  }

  async function handleChangePassword(event: FormEvent) {
    event.preventDefault();
    setPasswordError(null);
    setPasswordSaved(false);
    setChangingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setPasswordSaved(true);
    } catch (caught) {
      setPasswordError(
        caught instanceof AuthError ? caught.message : "Could not change your password. Please try again.",
      );
    } finally {
      setChangingPassword(false);
    }
  }

  return (
    // The visitor is already signed in here, so "Continue as a Visitor" is meaningless.
    <AccountShell title="Your profile" hideAccountLink>
      <section className="mb-6">
        <span className={label}>Email</span>
        <p className="mt-1 text-sm text-[#52524F]">{authUser?.email}</p>
      </section>

      <section className="mb-6">
        <FormError message={nameError} />
        <form onSubmit={handleSaveName} noValidate>
          <div className="mb-3">
            <label className={label} htmlFor="display-name">
              Display name
            </label>
            <input
              id="display-name"
              type="text"
              maxLength={150}
              placeholder={authUser ? localPart(authUser.email) : ""}
              className={input}
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value);
                setNameSaved(false);
              }}
            />
          </div>
          <button type="submit" className={primaryBtn} disabled={savingName}>
            {savingName ? "Saving…" : "Save"}
          </button>
          {nameSaved && (
            <p role="status" className="mt-2 text-sm text-[#6B6B67]">
              Saved.
            </p>
          )}
        </form>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-[#52524F]">Change password</h2>
        <FormError message={passwordError} />
        <form onSubmit={handleChangePassword} noValidate>
          <div className="mb-3">
            <label className={label} htmlFor="current-password">
              Current password
            </label>
            <input
              id="current-password"
              type="password"
              autoComplete="current-password"
              required
              className={input}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div className="mb-3">
            <label className={label} htmlFor="new-password">
              New password
            </label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              required
              className={input}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <button type="submit" className={primaryBtn} disabled={changingPassword}>
            {changingPassword ? "Changing…" : "Change password"}
          </button>
          {passwordSaved && (
            <p role="status" className="mt-2 text-sm text-[#6B6B67]">
              Password changed.
            </p>
          )}
        </form>
      </section>
    </AccountShell>
  );
}

import { Link } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";

/**
 * The study's nudge to sign in — an invitation, never a gate. It sits in the layout flow
 * under the ToolBar, so the workspace below it stays fully usable and fully clickable for
 * anyone who ignores it; the August cohort is funneled by the invitation protocol, not by
 * a wall (ADR-0004).
 */
export default function StudyPrompt() {
  // Called inside the selector, not after it: the selector re-runs on every store change,
  // so the strip appears when the probe lands and vanishes the moment it is dismissed.
  const shouldShow = useAuthStore((s) => s.shouldShowStudyPrompt());
  const dismiss = useAuthStore((s) => s.dismissStudyPrompt);

  if (!shouldShow) return null;

  return (
    <div
      role="status"
      className="flex items-center justify-between gap-4 border-b border-[#D8D4C3] bg-[#F5F1DF] px-4 py-1.5 text-sm text-[#52524F]"
    >
      <p>
        Taking part in the study? Please{" "}
        <Link to="/account/login" className="font-medium underline hover:text-[#3F3F3C]">
          sign in
        </Link>{" "}
        or{" "}
        <Link to="/account/signup" className="font-medium underline hover:text-[#3F3F3C]">
          register
        </Link>{" "}
        so your sessions can be attributed to you. Otherwise, carry on — everything works
        without an account.
      </p>

      <button
        type="button"
        aria-label="Dismiss"
        onClick={dismiss}
        className="shrink-0 rounded-md px-2 py-0.5 text-[#6B6B67] cursor-pointer transition-all hover:bg-[#E8E3CE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#52524F]/30"
      >
        ✕
      </button>
    </div>
  );
}

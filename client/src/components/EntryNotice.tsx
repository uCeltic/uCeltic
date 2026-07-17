import { useState } from "react";

/**
 * Dismissed for good once acknowledged — ADR-0005 calls for a persistent, client-side-
 * only record, not a per-sitting nag.
 */
export const ENTRY_NOTICE_DISMISSED_KEY = "uceltic:entry-notice-dismissed";

function dismissedBefore(): boolean {
  try {
    return localStorage.getItem(ENTRY_NOTICE_DISMISSED_KEY) === "1";
  } catch {
    // Private-mode browsers can throw on storage access; a missing dismissal is harmless.
    return false;
  }
}

/**
 * ADR-0005: one generic usage-recording notice, worded identically for guest and
 * signed-in visitors — no per-account promises, no link-out. Mounted once at the app
 * root (see App.tsx) so it shows at the entry point regardless of which route a
 * visitor lands on first.
 */
export default function EntryNotice() {
  const [dismissed, setDismissed] = useState(dismissedBefore);

  if (dismissed) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(ENTRY_NOTICE_DISMISSED_KEY, "1");
    } catch {
      // Storage unavailable: the notice simply returns on the next load.
    }
    setDismissed(true);
  };

  return (
    <div
      role="status"
      className="flex items-center justify-between gap-4 border-b border-[#D8D4C3] bg-[#F5F1DF] px-4 py-1.5 text-sm text-[#52524F]"
    >
      <p>
        To help make this tool better, we record your activity while using it (such as
        searches performed, documents opened, and settings changed). This data is used
        to improve the software and as material for a research project. Whether you're
        a guest or signed in, the same data is recorded. If you don't want to be
        recorded, please don't continue using this site.
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

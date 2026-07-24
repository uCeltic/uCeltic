/**
 * Dismissed for good once the tour is finished or skipped — same client-side-only,
 * persistent pattern as ENTRY_NOTICE_DISMISSED_KEY (components/EntryNotice.tsx) and
 * DRAG_REORDER_HINT_DISMISSED_KEY (panels/dragReorderHint.ts). The Help button can
 * still re-open the tour on demand; this only governs the first-run auto-show.
 */
export const TOUR_DISMISSED_KEY = "uceltic:onboarding-tour-dismissed";

export function tourDismissedBefore(): boolean {
  try {
    return localStorage.getItem(TOUR_DISMISSED_KEY) === "1";
  } catch {
    // Private-mode browsers can throw on storage access; a missing dismissal is
    // harmless — the tour simply auto-shows again next load.
    return false;
  }
}

export function markTourDismissed() {
  try {
    localStorage.setItem(TOUR_DISMISSED_KEY, "1");
  } catch {
    // Storage unavailable: the tour simply auto-shows again on the next load.
  }
}

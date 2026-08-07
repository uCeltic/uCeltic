import { useMemo } from "react";
import { useDocumentStore } from "../../store/documentStore";
import { useSearchStore } from "../../store/searchStore";
import { DEFAULT_FONT_SIZE, useWorkspaceStore } from "../../store/workspaceStore";
import type { TourSignals } from "./tourProgress";

type SearchState = ReturnType<typeof useSearchStore.getState>;

type SearchSignalState = Pick<
  SearchState,
  | "lastAttemptByDocument"
  | "isSearchingByDocument"
  | "searchErrorByDocument"
  | "activeResultIndexByDocument"
>;

/**
 * What the tour's gates read (#177): the workspace boiled down to four facts.
 *
 * The one seam between the stores and the tour, so the derivation itself stays a
 * pure function over four values (tourProgress.ts) and can be tested without a
 * store or an overlay in sight. Nothing here is recorded for the tour's benefit
 * — every signal is read off state the workspace already keeps for its own
 * reasons, and the two that need explaining are pure functions of one store, so
 * what counts as "a search completed" is asserted directly.
 */

/**
 * At least one column has a search that ran to completion — any number of
 * matches, including none.
 *
 * A recorded attempt that is neither in flight nor failed is a search that came
 * back. Results are deliberately not consulted: a search that found nothing has
 * still taught the reader what searching does, and an empty result list is also
 * what a column looks like before it has searched at all. A failed search does
 * not count — the column offers its own Retry, and nothing has been shown yet.
 */
export function searchCompleted(search: SearchSignalState): boolean {
  return Object.keys(search.lastAttemptByDocument).some(
    (id) =>
      !search.isSearchingByDocument[id] && !search.searchErrorByDocument[id],
  );
}

/**
 * At least one column is sitting on something other than its first match. Every
 * search resets its column to index 0, so a column sitting anywhere else was
 * moved there by the reader.
 */
export function resultNavigated(search: SearchSignalState): boolean {
  return Object.values(search.activeResultIndexByDocument).some(
    (index) => index > 0,
  );
}

/**
 * The live signals, re-read whenever any of the three stores changes.
 *
 * Each store is selected down to a single value, and the object is rebuilt only
 * when one of them actually changes: the overlay folds these into the tour's
 * latches from an effect, and a fresh object every render would run that effect
 * every render.
 */
export function useTourSignals(): TourSignals {
  const openDocumentCount = useDocumentStore((s) => s.openDocuments.length);
  const searched = useSearchStore(searchCompleted);
  const navigated = useSearchStore(resultNavigated);
  const fontSize = useWorkspaceStore((s) => s.fontSize);

  return useMemo(
    () => ({
      openDocumentCount,
      searchCompleted: searched,
      resultNavigated: navigated,
      fontSizeChanged: fontSize !== DEFAULT_FONT_SIZE,
    }),
    [openDocumentCount, searched, navigated, fontSize],
  );
}

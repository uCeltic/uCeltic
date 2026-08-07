import { useMemo } from "react";
import { useDocumentStore } from "../../store/documentStore";
import { useSearchStore } from "../../store/searchStore";
import { DEFAULT_FONT_SIZE, useWorkspaceStore } from "../../store/workspaceStore";
import type { TourSignals } from "./tourProgress";
import type { TourDomSignals } from "./tourDomSignals";

type SearchState = ReturnType<typeof useSearchStore.getState>;

type DocumentState = ReturnType<typeof useDocumentStore.getState>;

type SearchSignalState = Pick<
  SearchState,
  | "lastAttemptByDocument"
  | "isSearchingByDocument"
  | "searchErrorByDocument"
  | "activeResultIndexByDocument"
>;

/**
 * A search has been fired from at least one column.
 *
 * The attempt is recorded before the request goes out (ADR-0012), so this is
 * true the instant the reader clicks Search — which is what the step asking for
 * that click is waiting for. Whether anything came back is the next step's
 * question.
 */
export function searchFired(
  search: Pick<SearchSignalState, "lastAttemptByDocument">,
): boolean {
  return Object.keys(search.lastAttemptByDocument).length > 0;
}

/**
 * The columns are no longer in the order they were opened in.
 *
 * Derived rather than recorded: opening a document appends it to both lists, and
 * closing one filters both, so the two orders agree until a drag-reorder writes
 * a new one. Nothing has to be remembered for the tour, and a reader who drags a
 * column back where it came from has genuinely undone the reorder — which is why
 * the step latches instead (tourProgress.ts).
 */
export function columnsReordered(
  documents: Pick<DocumentState, "openDocuments" | "visibleDocumentIds">,
): boolean {
  const openOrder = documents.openDocuments
    .map((doc) => doc.id)
    .filter((id) => documents.visibleDocumentIds.includes(id));
  return documents.visibleDocumentIds.some((id, i) => openOrder[i] !== id);
}

/**
 * The half of what the tour's gates read that the stores do hold (#177); the
 * other half is probed from the rendered panels (`tourDomSignals.ts`, #178).
 *
 * The one seam between the stores and the tour, so the derivation itself stays a
 * pure function over a snapshot (tourProgress.ts) and can be tested without a
 * store or an overlay in sight. Nothing here is recorded for the tour's benefit
 * — every signal is read off state the workspace already keeps for its own
 * reasons, and the ones that need explaining are pure functions of one store, so
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

/** Everything the gates need that a store does hold; the rest is probed (#178). */
export type TourStoreSignals = Omit<TourSignals, keyof TourDomSignals>;

/**
 * The live store signals, re-read whenever any of the three stores changes.
 *
 * Each store is selected down to a single value, and the object is rebuilt only
 * when one of them actually changes: the overlay folds these into the tour's
 * latches from an effect, and a fresh object every render would run that effect
 * every render.
 */
export function useTourStoreSignals(): TourStoreSignals {
  const openDocumentCount = useDocumentStore((s) => s.openDocuments.length);
  const reordered = useDocumentStore(columnsReordered);
  const fired = useSearchStore(searchFired);
  const searched = useSearchStore(searchCompleted);
  const navigated = useSearchStore(resultNavigated);
  const fontSize = useWorkspaceStore((s) => s.fontSize);

  return useMemo(
    () => ({
      openDocumentCount,
      searchFired: fired,
      searchCompleted: searched,
      resultNavigated: navigated,
      columnsReordered: reordered,
      fontSizeChanged: fontSize !== DEFAULT_FONT_SIZE,
    }),
    [openDocumentCount, fired, searched, navigated, reordered, fontSize],
  );
}

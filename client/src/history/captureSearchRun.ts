import {
  saveSearchHistoryEntry,
  type SearchHistoryEntry,
  type SearchHistoryVersion,
} from "../api/searchHistory";
import { toWireParams } from "../api/searchParams";
import { useAuthStore } from "../store/authStore";
import { useDocumentStore } from "../store/documentStore";
import type { SearchRun } from "../store/searchStore";
import type { DocumentId } from "../types/document";
import type { SearchResult } from "../types/search";

/**
 * Freeze one settled search run onto the signed-in user's Search History (#187,
 * ADR-0024).
 *
 * Called once per user-initiated search, from the seam where the whole fan-out settles.
 * A Retry never reaches here: it repairs one column of a search that is already over, so
 * it goes straight to `runSearch` and is not a run of its own (ADR-0012).
 *
 * The snapshot is assembled here rather than server-side because this is where the facts
 * are: the search API computes results per request and stores none, and the Version
 * titles are the workspace's own. What the client does *not* decide is whose history
 * this is — the server stamps that from the session.
 *
 * `resultsByDocument` is passed in rather than read off the search store, so the entry
 * holds the results as they stood the moment the run settled.
 */
export function captureSearchRun(
  run: SearchRun,
  resultsByDocument: Record<DocumentId, SearchResult[]>,
): void {
  // Signed-in only: an anonymous visitor keeps no history, and `unknown` means the
  // session probe has not answered yet — not a reason to guess (ADR-0004).
  if (useAuthStore.getState().status !== "authenticated") return;

  const { openDocuments } = useDocumentStore.getState();
  const versions = run.columns
    // An errored column is left out entirely — its failure is an Error Report, not a
    // second home in a user-facing log (ADR-0013). A zero-hit column stays: a search
    // that found nothing is still a search.
    .filter((column) => column.outcome !== "errored")
    .map((column): SearchHistoryVersion | null => {
      const document = openDocuments.find((doc) => doc.id === column.clientDocId);
      if (!document) return null;
      return {
        title: document.title,
        hits: (resultsByDocument[column.clientDocId] ?? []).map((result) => ({
          snippet: result.snippet,
          score: result.score,
        })),
      };
    })
    .filter((version) => version !== null);

  // Nothing came back from anywhere — every column errored, or the search covered none.
  // That is not a search to look back on, and the endpoint refuses it anyway.
  if (versions.length === 0) return;

  const entry: SearchHistoryEntry = {
    query: run.query,
    query_origin: run.origin,
    // Named as the search API names them, through the same renaming the search itself
    // goes through, so an entry and the search that made it describe the same knobs.
    ...toWireParams(run.params),
    versions,
  };
  void saveSearchHistoryEntry(entry);
}
